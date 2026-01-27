import { PrismaClient } from '@prisma/client'
import { createAIProvider, chunkText } from './lib/ai-provider'
import { buildSummarizePrompt } from './prompts/summarize'
import { buildGenerateAssetPrompt } from './prompts/generate-assets'

const prisma = new PrismaClient()
const aiProvider = createAIProvider()

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const MAX_RETRIES = 3

interface JobProcessor {
  [key: string]: (payload: any) => Promise<any>
}

// Job processors by type
const jobProcessors: JobProcessor = {
  summarize: async (payload: any) => {
    console.log('Processing summarize job:', payload)
    
    const { campaignId, sourceId, text } = payload
    
    if (!campaignId || !text) {
      throw new Error('Missing required fields: campaignId, text')
    }
    
    // Chunk text if needed
    const chunks = chunkText(text, 4000)
    console.log(`Text split into ${chunks.length} chunk(s)`)
    
    // For simplicity, summarize the first chunk or combine chunks
    const textToSummarize = chunks.length > 1 
      ? chunks.slice(0, 3).join('\n\n...\n\n') // Take first 3 chunks
      : chunks[0]
    
    // Build prompt and call AI
    const prompt = buildSummarizePrompt(textToSummarize)
    const response = await aiProvider.complete(prompt, {
      maxTokens: 1000,
      temperature: 0.7,
    })
    
    // Parse JSON response
    let analysis
    try {
      analysis = JSON.parse(response.content)
    } catch (err) {
      // If JSON parsing fails, try to extract from markdown code blocks
      const jsonMatch = response.content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse AI response as JSON')
      }
    }
    
    // Store analysis in campaign_analysis table
    const campaignAnalysis = await prisma.campaignAnalysis.create({
      data: {
        campaignId,
        analysisType: 'content_summary',
        results: {
          summary: analysis.summary,
          key_points: analysis.key_points,
          hooks: analysis.hooks,
          sourceId,
          textLength: text.length,
          chunksProcessed: chunks.length,
        },
        summary: analysis.summary,
        score: null,
      },
    })
    
    // Update campaign status to 'ready'
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ready' },
    })
    
    console.log(`✅ Campaign ${campaignId} analyzed and set to ready`)
    
    return {
      status: 'completed',
      analysisId: campaignAnalysis.id,
      summary: analysis.summary,
      tokenUsage: response.usage,
    }
  },
  
  generate_asset: async (payload: any) => {
    console.log('Processing generate_asset job:', payload)
    
    const { campaignId, channel, summary, keyPoints, hooks } = payload
    
    if (!campaignId || !channel || !summary) {
      throw new Error('Missing required fields: campaignId, channel, summary')
    }
    
    // Build prompt for asset generation
    const prompt = buildGenerateAssetPrompt(
      channel,
      summary,
      keyPoints || [],
      hooks || []
    )
    
    // Generate content using AI
    const response = await aiProvider.complete(prompt, {
      maxTokens: 500,
      temperature: 0.8, // Higher temperature for more creative output
    })
    
    const content = response.content.trim()
    
    // Create generated asset in database
    const asset = await prisma.generatedAsset.create({
      data: {
        campaignId,
        assetType: channel,
        content,
        status: 'generated',
        metadata: {
          channel,
          generatedAt: new Date().toISOString(),
          tokenUsage: response.usage,
        },
      },
    })
    
    console.log(`✅ Generated ${channel} asset for campaign ${campaignId}`)
    
    return {
      status: 'completed',
      assetId: asset.id,
      channel,
      contentLength: content.length,
      tokenUsage: response.usage,
    }
  },
  
  analysis: async (payload: any) => {
    console.log('Processing analysis job:', payload)
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 2000))
    return { status: 'completed', summary: 'Analysis complete' }
  },
  
  generation: async (payload: any) => {
    console.log('Processing generation job:', payload)
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 3000))
    return { status: 'completed', generated: true }
  },
  
  processing: async (payload: any) => {
    console.log('Processing generic job:', payload)
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1500))
    return { status: 'completed' }
  },
}

async function claimJob() {
  try {
    // Find a pending job that hasn't exceeded max attempts
    const job = await prisma.job.findFirst({
      where: {
        status: 'pending',
        attempts: {
          lt: MAX_RETRIES,
        },
      },
      orderBy: {
        createdAt: 'asc', // FIFO
      },
    })

    if (!job) {
      return null
    }

    // Atomically claim the job by updating to running
    // This prevents double-processing even with multiple workers
    const updatedJob = await prisma.job.updateMany({
      where: {
        id: job.id,
        status: 'pending', // Only update if still pending
      },
      data: {
        status: 'running',
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    })

    // If count is 0, another worker claimed it
    if (updatedJob.count === 0) {
      console.log(`Job ${job.id} was claimed by another worker`)
      return null
    }

    // Fetch the updated job
    return await prisma.job.findUnique({
      where: { id: job.id },
    })
  } catch (error) {
    console.error('Error claiming job:', error)
    return null
  }
}

async function processJob(job: any) {
  console.log(`[${new Date().toISOString()}] Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts})`)

  try {
    const processor = jobProcessors[job.type]
    
    if (!processor) {
      throw new Error(`No processor found for job type: ${job.type}`)
    }

    // Process the job
    const result = await processor(job.payload)

    // Mark as completed
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
      },
    })

    console.log(`[${new Date().toISOString()}] Job ${job.id} completed successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[${new Date().toISOString()}] Job ${job.id} failed:`, errorMessage)

    // Check if we should retry or mark as failed
    const shouldFail = job.attempts >= job.maxAttempts

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: shouldFail ? 'failed' : 'pending',
        error: errorMessage,
        completedAt: shouldFail ? new Date() : null,
      },
    })

    if (shouldFail) {
      console.log(`[${new Date().toISOString()}] Job ${job.id} failed permanently after ${job.attempts} attempts`)
    } else {
      console.log(`[${new Date().toISOString()}] Job ${job.id} will be retried (attempt ${job.attempts}/${job.maxAttempts})`)
    }
  }
}

async function pollJobs() {
  try {
    const job = await claimJob()
    
    if (job) {
      await processJob(job)
    }
  } catch (error) {
    console.error('Error in poll cycle:', error)
  }
}

async function startWorker() {
  console.log('='.repeat(60))
  console.log('Job Worker Started')
  console.log(`Polling interval: ${POLL_INTERVAL_MS}ms`)
  console.log(`Max retries: ${MAX_RETRIES}`)
  console.log('='.repeat(60))

  // Initial poll
  await pollJobs()

  // Poll periodically
  setInterval(async () => {
    await pollJobs()
  }, POLL_INTERVAL_MS)
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down worker...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\nShutting down worker...')
  await prisma.$disconnect()
  process.exit(0)
})

// Start the worker
startWorker().catch((error) => {
  console.error('Failed to start worker:', error)
  process.exit(1)
})
