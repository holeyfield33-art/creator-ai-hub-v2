import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestJob() {
  try {
    const job = await prisma.job.create({
      data: {
        type: 'analysis',
        status: 'pending',
        payload: {
          message: 'Test analysis job',
          timestamp: new Date().toISOString(),
        },
      },
    })

    console.log('✅ Test job created:')
    console.log(JSON.stringify(job, null, 2))
    console.log('\nRun the worker to process it:')
    console.log('  npm run backend:worker')
  } catch (error) {
    console.error('❌ Failed to create test job:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestJob()
