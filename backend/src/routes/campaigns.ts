import { FastifyRequest, FastifyReply } from 'fastify'
import { SUPPORTED_CHANNELS } from '../prompts/generate-assets'
import prisma from '../lib/prisma'
import { requireAuth } from '../lib/auth'

// POST /api/campaigns - Create new campaign
export async function createCampaignHandler(
  request: FastifyRequest<{
    Body: { name: string; description?: string; budget?: number }
  }>,
  reply: FastifyReply
) {
  const userId = await requireAuth(request, reply)
  if (!userId) return

  const { name, description, budget } = request.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return reply.status(400).send({ error: 'Campaign name is required' })
  }

  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || budget < 0)) {
    return reply.status(400).send({ error: 'Budget must be a non-negative number' })
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        budget: budget ?? null,
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
  const userId = await requireAuth(request, reply)
  if (!userId) return

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
  const userId = await requireAuth(request, reply)
  if (!userId) return

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
  const userId = await requireAuth(request, reply)
  if (!userId) return

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

// POST /api/campaigns/:id/sources - Register uploaded video source
export async function registerCampaignSourceHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: {
      sourceType: string
      sourceUrl: string
      fileName?: string
      mimeType?: string
      size?: number
    }
  }>,
  reply: FastifyReply
) {
  const userId = await requireAuth(request, reply)
  if (!userId) return

  const { id } = request.params
  const { sourceType, sourceUrl, fileName, mimeType, size } = request.body

  if (!sourceUrl || sourceUrl.trim().length === 0) {
    return reply.status(400).send({ error: 'Source URL is required' })
  }

  try {
    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    // Create source record
    const source = await prisma.campaignSource.create({
      data: {
        campaignId: id,
        sourceType: sourceType || 'video',
        sourceUrl: sourceUrl.trim(),
        metadata: {
          fileName,
          mimeType,
          size,
          uploadedAt: new Date().toISOString(),
        },
      },
    })

    // Create stub analysis to unlock Generate Assets
    // This will be replaced with real AI analysis later
    const analysis = await prisma.campaignAnalysis.create({
      data: {
        campaignId: id,
        analysisType: 'content_summary',
        results: {
          summary: 'Video content uploaded and ready for processing. AI analysis will be performed soon.',
          key_points: [
            'Video file successfully uploaded',
            'Content ready for AI analysis',
            'Generate assets is now available',
          ],
          hooks: [
            'Engaging video content detected',
            'Ready to create multi-channel assets',
          ],
        },
        summary: 'Video uploaded - stub analysis',
        score: 0.8,
      },
    })

    request.log.info(`Created source ${source.id} and stub analysis ${analysis.id} for campaign ${id}`)

    // Update campaign status to ready
    await prisma.campaign.update({
      where: { id },
      data: { status: 'ready' },
    })

    return reply.status(201).send({
      source,
      analysis,
      campaign: { status: 'ready' },
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to register source' })
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
  const userId = await requireAuth(request, reply)
  if (!userId) return

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

// DELETE /api/campaigns/:id - Delete campaign
export async function deleteCampaignHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = await requireAuth(request, reply)
  if (!userId) return

  const { id } = request.params

  try {
    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    // Delete campaign (cascade will delete related records)
    await prisma.campaign.delete({
      where: { id },
    })

    return reply.send({ success: true })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to delete campaign' })
  }
}

// GET /api/jobs/:id - Get job status
export async function getJobStatusHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = await requireAuth(request, reply)
  if (!userId) return

  const { id } = request.params

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        result: true,
        error: true,
        payload: true,
        createdAt: true,
        completedAt: true,
      },
    })

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' })
    }

    // Verify the job belongs to the requesting user's campaign
    const payload = job.payload as Record<string, unknown> | null
    const campaignId = payload?.campaignId as string | undefined
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
        select: { id: true },
      })
      if (!campaign) {
        return reply.status(404).send({ error: 'Job not found' })
      }
    }

    // Don't expose raw payload to the client
    const { payload: _payload, ...jobResponse } = job
    return reply.send(jobResponse)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to get job status' })
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
  const userId = await requireAuth(request, reply)
  if (!userId) return

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
