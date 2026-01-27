import Fastify from 'fastify'
import cors from '@fastify/cors'
import { getMeHandler } from './routes/me'
import {
  createCampaignHandler,
  listCampaignsHandler,
  getCampaignHandler,
  uploadCampaignSourceHandler,
} from './routes/campaigns'

const fastify = Fastify({
  logger: true,
})

// Register CORS with Authorization header support
fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { ok: true }
})

// Auth endpoint
fastify.get('/api/me', getMeHandler)

// Campaign endpoints
fastify.post('/api/campaigns', createCampaignHandler)
fastify.get('/api/campaigns', listCampaignsHandler)
fastify.get('/api/campaigns/:id', getCampaignHandler)
fastify.post('/api/campaigns/:id/upload', uploadCampaignSourceHandler)

// Start server
const start = async () => {
  try {
    const port = 3001
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Backend server listening on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
