/**
 * Processing Pipeline - Auto transcribe and generate assets
 * Phase 13: Auto processing flow
 */

import { PrismaClient } from '@prisma/client'
import { createAIProvider } from './ai-provider'
import {
  SAFETY_CONFIG,
  incrementTranscriptionUsage,
  incrementGenerationUsage,
  shouldTranscribe,
  shouldGenerateAssets,
} from './safety-guards'

const prisma = new PrismaClient()

/**
 * Process a source: transcribe → generate assets
 */
export async function processSource(sourceId: string, campaignId: string, userId: string) {
  try {
    // Check kill switches
    if (SAFETY_CONFIG.AI_DISABLED) {
      console.log('[Pipeline] AI is disabled via env')
      await prisma.campaign_sources.update({
        where: { id: sourceId },
        data: {
          status: 'error',
          processingError: 'AI processing is temporarily disabled',
        },
      })
      return
    }

    if (!SAFETY_CONFIG.AUTO_PROCESSING) {
      console.log('[Pipeline] Auto processing is disabled')
      return
    }

    // Step 1: Transcribe
    await transcribeSource(sourceId, userId)

    // Step 2: Generate assets
    await generateAssetsForCampaign(campaignId, userId)

    // Mark as ready
    await prisma.campaign_sources.update({
      where: { id: sourceId },
      data: { status: 'ready' },
    })

    console.log(`[Pipeline] Successfully processed source ${sourceId}`)
  } catch (error) {
    console.error('[Pipeline] Processing error:', error)
    
    await prisma.campaign_sources.update({
      where: { id: sourceId },
      data: {
        status: 'error',
        processingError: error instanceof Error ? error.message : 'Unknown processing error',
      },
    })
  }
}

/**
 * Transcribe audio/video source
 */
async function transcribeSource(sourceId: string, userId: string) {
  const source = await prisma.campaign_sources.findUnique({
    where: { id: sourceId },
  })

  if (!source || !source.sourceUrl) {
    throw new Error('Source not found or missing URL')
  }

  // Check idempotency
  if (!(await shouldTranscribe(sourceId))) {
    console.log('[Pipeline] Transcript already exists, skipping')
    return
  }

  // Update status
  await prisma.campaign_sources.update({
    where: { id: sourceId },
    data: { status: 'transcribing' },
  })

  console.log(`[Pipeline] Starting transcription for source ${sourceId}`)

  try {
    const aiProvider = createAIProvider()

    if (!aiProvider.transcribe) {
      throw new Error('AI provider does not support transcription')
    }

    const result = await aiProvider.transcribe(source.sourceUrl)

    // Save transcript
    await prisma.campaign_sources.update({
      where: { id: sourceId },
      data: {
        transcriptText: result.text,
        language: result.language,
        duration: result.duration,
      },
    })

    // Increment usage
    await incrementTranscriptionUsage(userId)

    console.log(`[Pipeline] Transcription complete: ${result.text.length} chars`)
  } catch (error) {
    console.error('[Pipeline] Transcription failed:', error)
    throw error
  }
}

/**
 * Generate content assets from transcript
 */
async function generateAssetsForCampaign(campaignId: string, userId: string) {
  // Get source with transcript
  const source = await prisma.campaign_sources.findFirst({
    where: {
      campaignId,
      transcriptText: { not: null },
    },
  })

  if (!source || !source.transcriptText) {
    throw new Error('No transcript available for generation')
  }

  // Check idempotency
  if (!(await shouldGenerateAssets(campaignId))) {
    console.log('[Pipeline] Assets already exist, skipping')
    return
  }

  console.log(`[Pipeline] Generating assets for campaign ${campaignId}`)

  const aiProvider = createAIProvider()

  // Generate 5 captions
  const captionsPrompt = `Based on this transcript, create 5 short-form social media captions (max 280 chars each). Make them engaging and platform-ready.

Transcript:
${source.transcriptText.substring(0, 3000)}

Return as JSON array: ["caption1", "caption2", ...]`

  const captionsResponse = await aiProvider.complete(captionsPrompt, { maxTokens: 800 })
  const captions = parseCaptionsResponse(captionsResponse.content)

  // Save captions
  for (let i = 0; i < captions.length; i++) {
    await prisma.generated_assets.create({
      data: {
        campaignId,
        assetType: 'caption',
        content: captions[i],
        status: 'completed',
        metadata: { index: i + 1 },
      },
    })
  }

  // Generate Twitter thread
  const threadPrompt = `Create a Twitter/X thread (3-5 tweets) from this transcript. Make it punchy and engaging.

Transcript:
${source.transcriptText.substring(0, 3000)}

Return as JSON array: ["tweet1", "tweet2", ...]`

  const threadResponse = await aiProvider.complete(threadPrompt, { maxTokens: 500 })
  const thread = parseCaptionsResponse(threadResponse.content)

  await prisma.generated_assets.create({
    data: {
      campaignId,
      assetType: 'thread',
      content: thread.join('\n\n---\n\n'),
      status: 'completed',
    },
  })

  // Generate 3 hooks
  const hooksPrompt = `Create 3 attention-grabbing hooks based on this transcript. Each hook should be 1-2 sentences.

Transcript:
${source.transcriptText.substring(0, 2000)}

Return as JSON array: ["hook1", "hook2", "hook3"]`

  const hooksResponse = await aiProvider.complete(hooksPrompt, { maxTokens: 300 })
  const hooks = parseCaptionsResponse(hooksResponse.content)

  for (let i = 0; i < hooks.length; i++) {
    await prisma.generated_assets.create({
      data: {
        campaignId,
        assetType: 'hook',
        content: hooks[i],
        status: 'completed',
        metadata: { index: i + 1 },
      },
    })
  }

  // Generate summary
  const summaryPrompt = `Summarize this transcript in 2-3 paragraphs suitable for a blog post or newsletter.

Transcript:
${source.transcriptText.substring(0, 4000)}`

  const summaryResponse = await aiProvider.complete(summaryPrompt, { maxTokens: 500 })

  await prisma.generated_assets.create({
    data: {
      campaignId,
      assetType: 'summary',
      content: summaryResponse.content,
      status: 'completed',
    },
  })

  // Increment usage
  await incrementGenerationUsage(userId)

  console.log('[Pipeline] Asset generation complete')
}

/**
 * Parse AI response that should contain JSON array
 */
function parseCaptionsResponse(content: string): string[] {
  try {
    // Try to extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // Fallback: parse as newline-separated
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 5)
  } catch (error) {
    console.error('[Pipeline] Failed to parse AI response:', error)
    return [content]
  }
}

/**
 * Get campaign processing status
 */
export async function getCampaignStatus(campaignId: string) {
  const sources = await prisma.campaign_sources.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
  })

  const assets = await prisma.generated_assets.findMany({
    where: { campaignId },
  })

  const activeSource = sources.find(s => 
    s.status === 'transcribing' || s.status === 'generating'
  )

  return {
    isProcessing: !!activeSource,
    currentStatus: activeSource?.status,
    sources,
    assets,
  }
}
