import Fastify from 'fastify'
import cors from '@fastify/cors'
import { getMeHandler } from './routes/me'
import {
  createCampaignHandler,
  listCampaignsHandler,
  getCampaignHandler,
  uploadCampaignSourceHandler,
  registerCampaignSourceHandler,
  generateAssetsHandler,
  updateAssetHandler,
  deleteCampaignHandler,
  getJobStatusHandler,
} from './routes/campaigns'
import {
  connectXHandler,
  xCallbackHandler,
  listConnectionsHandler,
  disconnectHandler,
  schedulePostHandler,
  listScheduledPostsHandler,
  cancelScheduledPostHandler,
} from './routes/social'
import { analyticsRoutes } from './routes/analytics'

const fastify = Fastify({
  logger: true,
})

// Register CORS with Authorization header support
// Allow frontend origin from env or default to localhost
const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:3000',
  /\.app\.github\.dev$/,
]

// Add production frontend URL if configured
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

fastify.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
fastify.delete('/api/campaigns/:id', deleteCampaignHandler)
fastify.post('/api/campaigns/:id/upload', uploadCampaignSourceHandler)
fastify.post('/api/campaigns/:id/sources', registerCampaignSourceHandler)
fastify.post('/api/campaigns/:id/generate-assets', generateAssetsHandler)

// Asset endpoints
fastify.put('/api/assets/:id', updateAssetHandler)

// Job endpoints
fastify.get('/api/jobs/:id', getJobStatusHandler)

// Social/Scheduling endpoints
fastify.get('/api/social/x/connect', connectXHandler)
fastify.get('/api/social/x/callback', xCallbackHandler)
fastify.get('/api/social/connections', listConnectionsHandler)
fastify.delete('/api/social/connections/:connectionId', disconnectHandler)
fastify.post('/api/schedule', schedulePostHandler)
fastify.get('/api/schedule', listScheduledPostsHandler)
fastify.delete('/api/schedule/:postId', cancelScheduledPostHandler)

// Analytics endpoints
fastify.register(analyticsRoutes)

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10)
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Backend server listening on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
