import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { PrismaClient } from '@prisma/client'
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
import { globalRateLimit, rateLimitTiers, rateLimitExceededResponse } from './middleware/rate-limit'
import {
  createValidator,
  createCampaignSchema,
  uploadSourceSchema,
  registerSourceSchema,
  generateAssetsSchema,
  updateAssetSchema,
  schedulePostSchema,
  idParamSchema,
  connectionIdParamSchema,
  postIdParamSchema,
} from './middleware/validation'

// Initialize Prisma client for health checks
const prisma = new PrismaClient()

const fastify = Fastify({
  logger: true,
  // Request size limits - prevent large payload attacks
  bodyLimit: 10 * 1024 * 1024, // 10MB max body size
})

// ==================== Security Headers (Helmet) ====================
// Configure helmet with production-ready security headers
fastify.register(helmet, {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for API responses
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Cross-Origin settings
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for API
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },
  // Hide X-Powered-By
  hidePoweredBy: true,
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open
  ieNoOpen: true,
  // No Sniff (X-Content-Type-Options)
  noSniff: true,
  // Origin Agent Cluster
  originAgentCluster: true,
  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // XSS Filter (legacy, but still good to have)
  xssFilter: true,
})

// ==================== Rate Limiting ====================
// Global rate limiter with tiered limits
fastify.register(rateLimit, {
  global: true,
  max: globalRateLimit.max,
  timeWindow: globalRateLimit.timeWindow,
  keyGenerator: globalRateLimit.keyGenerator,
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: rateLimitExceededResponse.message,
    retryAfter: Math.ceil(context.ttl / 1000),
  }),
  // Skip rate limiting for certain conditions (e.g., internal health checks)
  allowList: (request) => {
    // Allow localhost health checks without rate limiting
    const isLocalHealthCheck = request.url === '/health' &&
      (request.ip === '127.0.0.1' || request.ip === '::1')
    return isLocalHealthCheck
  },
})

// ==================== CORS Configuration ====================
// Register CORS with Authorization header support
// Allow frontend origin from env or default to localhost
const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:3000',
  'https://glowing-dollop-5gp9pvwjpprpfp7q9-3000.app.github.dev',
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

// ==================== Health Check Endpoint ====================
// Enhanced health check with database connectivity and system info
fastify.get('/health', {
  config: {
    rateLimit: rateLimitTiers.health,
  },
}, async (request, reply) => {
  const healthStatus: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    uptime: number
    version: string
    checks: {
      database: { status: string; latency?: number; error?: string }
      memory: { status: string; used: number; total: number; percentage: number }
    }
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'unknown' },
      memory: { status: 'unknown', used: 0, total: 0, percentage: 0 },
    },
  }

  // Database health check
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart
    healthStatus.checks.database = {
      status: 'healthy',
      latency: dbLatency,
    }
  } catch (error) {
    healthStatus.status = 'unhealthy'
    healthStatus.checks.database = {
      status: 'unhealthy',
      error: 'Database connection failed',
    }
  }

  // Memory health check
  const memUsage = process.memoryUsage()
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const memPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

  healthStatus.checks.memory = {
    status: memPercentage > 90 ? 'degraded' : 'healthy',
    used: memUsedMB,
    total: memTotalMB,
    percentage: memPercentage,
  }

  if (memPercentage > 90 && healthStatus.status === 'healthy') {
    healthStatus.status = 'degraded'
  }

  // Return appropriate status code
  const statusCode = healthStatus.status === 'healthy' ? 200 :
    healthStatus.status === 'degraded' ? 200 : 503

  return reply.status(statusCode).send(healthStatus)
})

// Simple liveness probe (for k8s/container orchestration)
fastify.get('/health/live', {
  config: {
    rateLimit: rateLimitTiers.health,
  },
}, async () => ({ status: 'alive' }))

// Readiness probe (for k8s/container orchestration)
fastify.get('/health/ready', {
  config: {
    rateLimit: rateLimitTiers.health,
  },
}, async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ready' }
  } catch {
    return reply.status(503).send({ status: 'not ready', error: 'Database unavailable' })
  }
})

// ==================== API Routes ====================

// Auth endpoint
fastify.get('/api/me', {
  config: {
    rateLimit: rateLimitTiers.auth,
  },
}, getMeHandler)

// Campaign endpoints with validation
fastify.post('/api/campaigns', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: createValidator(createCampaignSchema),
}, createCampaignHandler)

fastify.get('/api/campaigns', {
  config: { rateLimit: rateLimitTiers.read },
}, listCampaignsHandler)

fastify.get('/api/campaigns/:id', {
  config: { rateLimit: rateLimitTiers.read },
  preValidation: createValidator(idParamSchema, 'params'),
}, getCampaignHandler)

fastify.delete('/api/campaigns/:id', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: createValidator(idParamSchema, 'params'),
}, deleteCampaignHandler)

fastify.post('/api/campaigns/:id/upload', {
  config: { rateLimit: rateLimitTiers.expensive },
  preValidation: [
    createValidator(idParamSchema, 'params'),
    createValidator(uploadSourceSchema),
  ],
}, uploadCampaignSourceHandler)

fastify.post('/api/campaigns/:id/sources', {
  config: { rateLimit: rateLimitTiers.expensive },
  preValidation: [
    createValidator(idParamSchema, 'params'),
    createValidator(registerSourceSchema),
  ],
}, registerCampaignSourceHandler)

fastify.post('/api/campaigns/:id/generate-assets', {
  config: { rateLimit: rateLimitTiers.expensive },
  preValidation: [
    createValidator(idParamSchema, 'params'),
    createValidator(generateAssetsSchema),
  ],
}, generateAssetsHandler)

// Asset endpoints
fastify.put('/api/assets/:id', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: [
    createValidator(idParamSchema, 'params'),
    createValidator(updateAssetSchema),
  ],
}, updateAssetHandler)

// Job endpoints
fastify.get('/api/jobs/:id', {
  config: { rateLimit: rateLimitTiers.read },
  preValidation: createValidator(idParamSchema, 'params'),
}, getJobStatusHandler)

// Social/Scheduling endpoints
fastify.get('/api/social/x/connect', {
  config: { rateLimit: rateLimitTiers.auth },
}, connectXHandler)

fastify.get('/api/social/x/callback', {
  config: { rateLimit: rateLimitTiers.auth },
}, xCallbackHandler)

fastify.get('/api/social/connections', {
  config: { rateLimit: rateLimitTiers.read },
}, listConnectionsHandler)

fastify.delete('/api/social/connections/:connectionId', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: createValidator(connectionIdParamSchema, 'params'),
}, disconnectHandler)

fastify.post('/api/schedule', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: createValidator(schedulePostSchema),
}, schedulePostHandler)

fastify.get('/api/schedule', {
  config: { rateLimit: rateLimitTiers.read },
}, listScheduledPostsHandler)

fastify.delete('/api/schedule/:postId', {
  config: { rateLimit: rateLimitTiers.write },
  preValidation: createValidator(postIdParamSchema, 'params'),
}, cancelScheduledPostHandler)

// Analytics endpoints
fastify.register(analyticsRoutes)

// ==================== Server Startup ====================
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10)
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Backend server listening on port ${port}`)
    console.log('Security features enabled: Helmet, Rate Limiting, Zod Validation')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
