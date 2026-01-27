import { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Auth middleware helper
async function getUserFromToken(request: FastifyRequest): Promise<string | null> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return null
    }
    return data.user.id
  } catch (err) {
    return null
  }
}

// POST /api/campaigns - Create new campaign
export async function createCampaignHandler(
  request: FastifyRequest<{
    Body: { name: string; description?: string; budget?: number }
  }>,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { name, description, budget } = request.body

  if (!name || name.trim().length === 0) {
    return reply.status(400).send({ error: 'Campaign name is required' })
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        budget,
        userId,
        status: 'draft',
      },
    })

    return reply.status(201).send(campaign)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to create campaign' })
  }
}

// GET /api/campaigns - List campaigns for user
export async function listCampaignsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sources: true,
        _count: {
          select: {
            sources: true,
            analyses: true,
            generatedAssets: true,
          },
        },
      },
    })

    return reply.send(campaigns)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to fetch campaigns' })
  }
}

// GET /api/campaigns/:id - Get campaign detail
export async function getCampaignHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { id } = request.params

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        sources: {
          orderBy: { createdAt: 'desc' },
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
        },
        generatedAssets: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    return reply.send(campaign)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to fetch campaign' })
  }
}

// POST /api/campaigns/:id/upload - Upload text or file
export async function uploadCampaignSourceHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: {
      sourceType: 'text' | 'file'
      text?: string
      fileName?: string
      fileSize?: number
    }
  }>,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { id } = request.params
  const { sourceType, text, fileName, fileSize } = request.body

  // Verify campaign belongs to user
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    // Validate based on source type
    if (sourceType === 'text') {
      if (!text || text.trim().length === 0) {
        return reply.status(400).send({ error: 'Text content is required' })
      }

      const source = await prisma.campaignSource.create({
        data: {
          campaignId: id,
          sourceType: 'text',
          sourceText: text.trim(),
        },
      })

      // Create a summarize job for this text
      const job = await prisma.job.create({
        data: {
          type: 'summarize',
          status: 'pending',
          payload: {
            campaignId: id,
            sourceId: source.id,
            text: text.trim(),
          },
        },
      })

      request.log.info(`Created summarize job ${job.id} for campaign ${id}`)

      return reply.status(201).send({
        source,
        job: {
          id: job.id,
          status: job.status,
          type: job.type,
        },
      })
    } else if (sourceType === 'file') {
      if (!fileName) {
        return reply.status(400).send({ error: 'File name is required' })
      }

      // For now, store file metadata with placeholder URL
      const source = await prisma.campaignSource.create({
        data: {
          campaignId: id,
          sourceType: 'file',
          sourceUrl: `placeholder://files/${fileName}`,
          metadata: {
            fileName,
            fileSize,
            status: 'not_implemented',
            message: 'File storage not yet implemented',
          },
        },
      })

      return reply.status(201).send(source)
    } else {
      return reply.status(400).send({ error: 'Invalid source type' })
    }
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to upload source' })
  }
}
