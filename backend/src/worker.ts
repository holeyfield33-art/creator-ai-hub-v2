import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const MAX_RETRIES = 3

interface JobProcessor {
  [key: string]: (payload: any) => Promise<any>
}

// Job processors by type
const jobProcessors: JobProcessor = {
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
