import { PrismaClient } from '@prisma/client'
import { createAIProvider, chunkText } from './lib/ai-provider'
import { buildSummarizePrompt } from './prompts/summarize'
import { buildGenerateAssetPrompt } from './prompts/generate-assets'
import { fetchMetricsFromPlatform, calculateEngagementRate } from './lib/social-metrics'

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
    const campaignAnalysis = await prisma.campaign_analysis.create({
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
    await prisma.campaigns.update({
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
    const asset = await prisma.generated_assets.create({
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
  
  collect_metrics: async (payload: any) => {
    console.log('Processing collect_metrics job:', payload)
    
    const { scheduledPostId } = payload
    
    if (!scheduledPostId) {
      throw new Error('Missing required field: scheduledPostId')
    }
    
    // Get the scheduled post with social connection
    const post = await prisma.scheduled_posts.findUnique({
      where: { id: scheduledPostId },
      include: { social_connections: true },
    })
    
    if (!post) {
      throw new Error(`Scheduled post ${scheduledPostId} not found`)
    }
    
    if (post.status !== 'posted') {
      throw new Error(`Post ${scheduledPostId} has not been posted yet (status: ${post.status})`)
    }
    
    if (!post.platformPostId) {
      throw new Error(`Post ${scheduledPostId} has no platform post ID`)
    }
    
    // Fetch metrics from the social platform
    const metricsData = await fetchMetricsFromPlatform(
      post.platform,
      post.platformPostId,
      post.social_connections.accessToken
    )
    
    // Calculate engagement rate
    const engagementRate = calculateEngagementRate(metricsData)
    
    // Create or update post metric
    const existingMetric = await prisma.post_metrics.findFirst({
      where: { scheduledPostId },
      orderBy: { fetchedAt: 'desc' },
    })
    
    // Always create a new metric entry (for historical tracking)
    const metric = await prisma.post_metrics.create({
      data: {
        scheduledPostId,
        platform: post.platform,
        externalId: post.platformPostId,
        impressions: metricsData.impressions,
        engagements: metricsData.engagements,
        likes: metricsData.likes,
        shares: metricsData.shares,
        comments: metricsData.comments,
        clicks: metricsData.clicks,
        engagementRate,
      },
    })
    
    console.log(`✅ Collected metrics for post ${scheduledPostId}:`, {
      impressions: metricsData.impressions,
      engagements: metricsData.engagements,
      rate: `${engagementRate.toFixed(2)}%`,
    })
    
    return {
      status: 'completed',
      metricId: metric.id,
      metrics: metricsData,
      engagementRate,
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
    const job = await prisma.jobs.findFirst({
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
    const updatedJob = await prisma.jobs.updateMany({
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
    return await prisma.jobs.findUnique({
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
    await prisma.jobs.update({
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

    await prisma.jobs.update({
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
    
    // Also check for due scheduled posts
    await processScheduledPosts()
  } catch (error) {
    console.error('Error in poll cycle:', error)
  }
}

// Process scheduled posts that are due
async function processScheduledPosts() {
  try {
    // Find all pending posts that are due
    const duePosts = await prisma.scheduled_posts.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date(),
        },
      },
      include: {
        socialConnection: true,
      },
      take: 10, // Process 10 at a time
    })

    if (duePosts.length === 0) {
      return
    }

    console.log(`Found ${duePosts.length} scheduled post(s) due for posting`)

    for (const post of duePosts) {
      try {
        // Mark as processing
        await prisma.scheduled_posts.update({
          where: { id: post.id },
          data: { status: 'posting' },
        })

        // Post to platform
        if (post.platform === 'x') {
          await postToX(post, post.social_connections)
        } else {
          throw new Error(`Unsupported platform: ${post.platform}`)
        }

        // Mark as posted
        await prisma.scheduled_posts.update({
          where: { id: post.id },
          data: {
            status: 'posted',
            postedAt: new Date(),
          },
        })

        console.log(`✅ Posted scheduled post ${post.id} to ${post.platform}`)
      } catch (error: any) {
        console.error(`Failed to post ${post.id}:`, error.message)
        
        // Mark as failed
        await prisma.scheduled_posts.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            error: error.message,
          },
        })
      }
    }
  } catch (error) {
    console.error('Error processing scheduled posts:', error)
  }
}

// Refresh X/Twitter token if expired
async function refreshXToken(connection: any): Promise<string> {
  // Check if token is expired or about to expire (within 5 minutes)
  if (connection.tokenExpiry && new Date(connection.tokenExpiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.accessToken // Token still valid
  }

  if (!connection.refreshToken) {
    throw new Error('Token expired and no refresh token available')
  }

  console.log(`Refreshing expired X token for connection ${connection.id}`)

  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('X OAuth credentials not configured')
  }

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`)
  }

  const tokenData = await response.json() as any
  const { access_token, refresh_token, expires_in } = tokenData

  // Calculate new expiry
  const tokenExpiry = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null

  // Update connection with new tokens
  await prisma.social_connections.update({
    where: { id: connection.id },
    data: {
      accessToken: access_token,
      refreshToken: refresh_token || connection.refreshToken,
      tokenExpiry,
    },
  })

  console.log(`Successfully refreshed X token for connection ${connection.id}`)
  return access_token
}

// Post to X/Twitter
async function postToX(post: any, connection: any) {
  // Refresh token if needed
  const accessToken = await refreshXToken(connection)

  // Create tweet
  const tweetData: any = {
    text: post.content,
  }

  // Add media if present (would need to upload first)
  // For now, we'll just post text

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tweetData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Twitter API error: ${response.status} ${errorText}`)
  }

  const result = await response.json() as any

  // Update post with platform post ID
  await prisma.scheduled_posts.update({
    where: { id: post.id },
    data: {
      platformPostId: result.data.id,
      metadata: result as any,
    },
  })

  return result
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
