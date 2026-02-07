import { FastifyRequest } from 'fastify'

// Rate limit tiers configuration
// Different endpoints have different limits based on their resource intensity

export interface RateLimitConfig {
  max: number          // Max requests per time window
  timeWindow: string   // Time window (e.g., '1 minute', '1 hour')
  keyGenerator?: (req: FastifyRequest) => string
}

// Extract user identifier from request (IP + optional user ID)
function getUserIdentifier(request: FastifyRequest): string {
  // Try to get user ID from authorization header (hashed for privacy)
  const authHeader = request.headers.authorization
  const userId = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7, 27) // Use first 20 chars of token as identifier
    : null

  // Get IP address (handle proxies)
  const ip = request.headers['x-forwarded-for']
    ? (request.headers['x-forwarded-for'] as string).split(',')[0].trim()
    : request.ip

  return userId ? `${ip}:${userId}` : ip
}

// Tiered rate limit configurations
export const rateLimitTiers = {
  // Standard API endpoints - generous limits
  standard: {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,

  // Read-heavy endpoints (list, get) - higher limits
  read: {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,

  // Write endpoints (create, update, delete) - moderate limits
  write: {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,

  // Expensive operations (AI generation, file upload) - strict limits
  expensive: {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,

  // Authentication/OAuth endpoints - prevent brute force
  auth: {
    max: 20,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,

  // Health check - high limit for monitoring
  health: {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => req.ip,
  } as RateLimitConfig,

  // Analytics refresh - very strict to prevent abuse
  analytics: {
    max: 5,
    timeWindow: '1 minute',
    keyGenerator: getUserIdentifier,
  } as RateLimitConfig,
}

// Global rate limit for all routes (fallback)
export const globalRateLimit: RateLimitConfig = {
  max: 300,
  timeWindow: '1 minute',
  keyGenerator: getUserIdentifier,
}

// Route to tier mapping
export const routeTierMapping: Record<string, keyof typeof rateLimitTiers> = {
  // Health
  '/health': 'health',

  // Auth
  '/api/me': 'auth',
  '/api/social/x/connect': 'auth',
  '/api/social/x/callback': 'auth',

  // Read endpoints
  '/api/campaigns': 'read',
  '/api/social/connections': 'read',
  '/api/schedule': 'read',
  '/api/analytics/dashboard': 'read',

  // Write endpoints
  '/api/assets/:id': 'write',
  '/api/social/connections/:connectionId': 'write',
  '/api/schedule/:postId': 'write',

  // Expensive operations
  '/api/campaigns/:id/upload': 'expensive',
  '/api/campaigns/:id/sources': 'expensive',
  '/api/campaigns/:id/generate-assets': 'expensive',
  '/api/analytics/refresh': 'analytics',
}

// Helper to get rate limit config for a route
export function getRateLimitForRoute(routePath: string): RateLimitConfig {
  // Direct match
  if (routeTierMapping[routePath]) {
    return rateLimitTiers[routeTierMapping[routePath]]
  }

  // Pattern match (for dynamic routes)
  for (const [pattern, tier] of Object.entries(routeTierMapping)) {
    const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+')
    const regex = new RegExp(`^${regexPattern}$`)
    if (regex.test(routePath)) {
      return rateLimitTiers[tier]
    }
  }

  // Default to standard
  return rateLimitTiers.standard
}

// Error response for rate limit exceeded
export const rateLimitExceededResponse = {
  error: 'Too many requests',
  message: 'You have exceeded the rate limit. Please try again later.',
  retryAfter: 60, // seconds
}
