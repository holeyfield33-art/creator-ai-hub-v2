import { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { SUPPORTED_CHANNELS } from '../prompts/generate-assets'

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

// POST /api/campaigns/:id/generate-assets - Generate assets for channels
export async function generateAssetsHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: { channels: string[] }
  }>,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { id } = request.params
  const { channels } = request.body

  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return reply.status(400).send({ error: 'Channels array is required' })
  }

  // Validate that all channels are supported
  const invalidChannels = channels.filter(
    (channel) => !SUPPORTED_CHANNELS.includes(channel as typeof SUPPORTED_CHANNELS[number])
  )
  if (invalidChannels.length > 0) {
    return reply.status(400).send({
      error: `Unsupported channel(s): ${invalidChannels.join(', ')}. Supported channels: ${SUPPORTED_CHANNELS.join(', ')}`,
    })
  }

  try {
    // Verify campaign belongs to user and has analysis
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        analyses: {
          where: { analysisType: 'content_summary' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    if (!campaign.analyses || campaign.analyses.length === 0) {
      return reply.status(400).send({ error: 'Campaign must be analyzed first (upload text)' })
    }

    const analysis = campaign.analyses[0]

    // Create a generation job for each channel
    const jobs = await Promise.all(
      channels.map((channel) =>
        prisma.job.create({
          data: {
            type: 'generate_asset',
            status: 'pending',
            payload: {
              campaignId: id,
              analysisId: analysis.id,
              channel,
              summary: (analysis.results as any)?.summary,
              keyPoints: (analysis.results as any)?.key_points,
              hooks: (analysis.results as any)?.hooks,
            },
          },
        })
      )
    )

    request.log.info(`Created ${jobs.length} asset generation jobs for campaign ${id}`)

    return reply.status(201).send({
      message: `Created ${jobs.length} asset generation job(s)`,
      jobs: jobs.map((j) => ({ id: j.id, type: j.type, status: j.status })),
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to generate assets' })
  }
}

// PUT /api/assets/:id - Update asset content
export async function updateAssetHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: { content: string }
  }>,
  reply: FastifyReply
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { id } = request.params
  const { content } = request.body

  if (!content || content.trim().length === 0) {
    return reply.status(400).send({ error: 'Content is required' })
  }

  try {
    // Verify asset belongs to user's campaign
    const asset = await prisma.generatedAsset.findFirst({
      where: { id },
      include: {
        campaign: {
          select: { userId: true },
        },
      },
    })

    if (!asset || asset.campaign.userId !== userId) {
      return reply.status(404).send({ error: 'Asset not found' })
    }

    // Update asset content
    const updatedAsset = await prisma.generatedAsset.update({
      where: { id },
      data: {
        content: content.trim(),
        status: 'approved', // Mark as approved when manually edited
      },
    })

    return reply.send(updatedAsset)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to update asset' })
  }
}
