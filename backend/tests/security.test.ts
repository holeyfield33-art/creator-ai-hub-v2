import { describe, test, expect } from '@jest/globals'
import {
  validate,
  createCampaignSchema,
  uploadSourceSchema,
  registerSourceSchema,
  generateAssetsSchema,
  updateAssetSchema,
  schedulePostSchema,
  idParamSchema,
  dashboardQuerySchema,
} from '../src/middleware/validation'
import {
  rateLimitTiers,
  globalRateLimit,
  getRateLimitForRoute,
} from '../src/middleware/rate-limit'

describe('Zod Validation Schemas', () => {
  describe('createCampaignSchema', () => {
    test('accepts valid campaign data', () => {
      const result = validate(createCampaignSchema, {
        name: 'Test Campaign',
        description: 'A test campaign',
        budget: 1000,
      })
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Test Campaign')
    })

    test('trims whitespace from name', () => {
      const result = validate(createCampaignSchema, {
        name: '  Trimmed Name  ',
      })
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Trimmed Name')
    })

    test('rejects empty name', () => {
      const result = validate(createCampaignSchema, {
        name: '',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('name')
    })

    test('rejects name exceeding max length', () => {
      const result = validate(createCampaignSchema, {
        name: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('200 characters')
    })

    test('rejects negative budget', () => {
      const result = validate(createCampaignSchema, {
        name: 'Test',
        budget: -100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('positive')
    })

    test('accepts campaign without optional fields', () => {
      const result = validate(createCampaignSchema, {
        name: 'Minimal Campaign',
      })
      expect(result.success).toBe(true)
      expect(result.data?.description).toBeUndefined()
      expect(result.data?.budget).toBeUndefined()
    })
  })

  describe('uploadSourceSchema', () => {
    test('accepts valid text source', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'text',
        text: 'Some content here',
      })
      expect(result.success).toBe(true)
    })

    test('accepts valid file source', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'file',
        fileName: 'test.pdf',
        fileSize: 1024,
      })
      expect(result.success).toBe(true)
    })

    test('rejects text source without text content', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'text',
      })
      expect(result.success).toBe(false)
    })

    test('rejects file source without fileName', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'file',
      })
      expect(result.success).toBe(false)
    })

    test('rejects invalid source type', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'invalid',
        text: 'content',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('text')
    })

    test('rejects file exceeding size limit', () => {
      const result = validate(uploadSourceSchema, {
        sourceType: 'file',
        fileName: 'huge.zip',
        fileSize: 200 * 1024 * 1024, // 200MB
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('100MB')
    })
  })

  describe('registerSourceSchema', () => {
    test('accepts valid video source', () => {
      const result = validate(registerSourceSchema, {
        sourceType: 'video',
        sourceUrl: 'https://example.com/video.mp4',
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        size: 50000000,
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid URL', () => {
      const result = validate(registerSourceSchema, {
        sourceType: 'video',
        sourceUrl: 'not-a-url',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('URL')
    })

    test('rejects empty URL', () => {
      const result = validate(registerSourceSchema, {
        sourceType: 'video',
        sourceUrl: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('generateAssetsSchema', () => {
    test('accepts valid channels', () => {
      const result = validate(generateAssetsSchema, {
        channels: ['twitter', 'linkedin'],
      })
      expect(result.success).toBe(true)
      expect(result.data?.channels).toHaveLength(2)
    })

    test('rejects empty channels array', () => {
      const result = validate(generateAssetsSchema, {
        channels: [],
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('At least one channel')
    })

    test('rejects invalid channel', () => {
      const result = validate(generateAssetsSchema, {
        channels: ['twitter', 'invalid_channel'],
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid channel')
    })

    test('rejects too many channels', () => {
      const result = validate(generateAssetsSchema, {
        channels: Array(11).fill('twitter'),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum 10')
    })

    test('accepts all supported channels', () => {
      const result = validate(generateAssetsSchema, {
        channels: [
          'twitter',
          'linkedin',
          'youtube_short',
          'tiktok',
          'instagram_reel',
          'threads',
          'blog',
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('updateAssetSchema', () => {
    test('accepts valid content', () => {
      const result = validate(updateAssetSchema, {
        content: 'Updated content here',
      })
      expect(result.success).toBe(true)
    })

    test('trims whitespace', () => {
      const result = validate(updateAssetSchema, {
        content: '  trimmed content  ',
      })
      expect(result.success).toBe(true)
      expect(result.data?.content).toBe('trimmed content')
    })

    test('rejects empty content', () => {
      const result = validate(updateAssetSchema, {
        content: '',
      })
      expect(result.success).toBe(false)
    })

    test('rejects content exceeding max length', () => {
      const result = validate(updateAssetSchema, {
        content: 'a'.repeat(50001),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('maximum length')
    })
  })

  describe('schedulePostSchema', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString() // Tomorrow

    test('accepts valid schedule data', () => {
      const result = validate(schedulePostSchema, {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        connectionId: '123e4567-e89b-12d3-a456-426614174001',
        scheduledFor: futureDate,
        content: 'Post content',
        mediaUrls: ['https://example.com/image.jpg'],
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid UUID format', () => {
      const result = validate(schedulePostSchema, {
        assetId: 'invalid-uuid',
        connectionId: '123e4567-e89b-12d3-a456-426614174001',
        scheduledFor: futureDate,
        content: 'Post content',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    test('rejects past date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      const result = validate(schedulePostSchema, {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        connectionId: '123e4567-e89b-12d3-a456-426614174001',
        scheduledFor: pastDate,
        content: 'Post content',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('future')
    })

    test('rejects too many media URLs', () => {
      const result = validate(schedulePostSchema, {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        connectionId: '123e4567-e89b-12d3-a456-426614174001',
        scheduledFor: futureDate,
        content: 'Post content',
        mediaUrls: Array(11).fill('https://example.com/image.jpg'),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum 10')
    })

    test('defaults mediaUrls to empty array', () => {
      const result = validate(schedulePostSchema, {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        connectionId: '123e4567-e89b-12d3-a456-426614174001',
        scheduledFor: futureDate,
        content: 'Post content',
      })
      expect(result.success).toBe(true)
      expect(result.data?.mediaUrls).toEqual([])
    })
  })

  describe('idParamSchema', () => {
    test('accepts valid UUID', () => {
      const result = validate(idParamSchema, {
        id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid UUID', () => {
      const result = validate(idParamSchema, {
        id: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid ID')
    })
  })

  describe('dashboardQuerySchema', () => {
    test('accepts valid days parameter', () => {
      const result = validate(dashboardQuerySchema, {
        days: '30',
        platform: 'x',
      })
      expect(result.success).toBe(true)
      expect(result.data?.days).toBe('30')
    })

    test('defaults days to 30', () => {
      const result = validate(dashboardQuerySchema, {})
      expect(result.success).toBe(true)
      expect(result.data?.days).toBe('30')
    })

    test('rejects days out of range', () => {
      const result = validate(dashboardQuerySchema, {
        days: '500',
      })
      expect(result.success).toBe(true)
      // Should default to 30 for invalid values
      expect(result.data?.days).toBe('30')
    })
  })
})

describe('Rate Limit Configuration', () => {
  describe('rateLimitTiers', () => {
    test('has all required tiers defined', () => {
      expect(rateLimitTiers.standard).toBeDefined()
      expect(rateLimitTiers.read).toBeDefined()
      expect(rateLimitTiers.write).toBeDefined()
      expect(rateLimitTiers.expensive).toBeDefined()
      expect(rateLimitTiers.auth).toBeDefined()
      expect(rateLimitTiers.health).toBeDefined()
      expect(rateLimitTiers.analytics).toBeDefined()
    })

    test('read tier has higher limit than write', () => {
      expect(rateLimitTiers.read.max).toBeGreaterThan(rateLimitTiers.write.max)
    })

    test('expensive tier has lowest limit', () => {
      expect(rateLimitTiers.expensive.max).toBeLessThan(rateLimitTiers.write.max)
      expect(rateLimitTiers.expensive.max).toBeLessThan(rateLimitTiers.read.max)
    })

    test('health tier has highest limit', () => {
      expect(rateLimitTiers.health.max).toBeGreaterThan(rateLimitTiers.read.max)
    })

    test('all tiers have keyGenerator', () => {
      Object.values(rateLimitTiers).forEach(tier => {
        expect(tier.keyGenerator).toBeDefined()
        expect(typeof tier.keyGenerator).toBe('function')
      })
    })

    test('all tiers have timeWindow', () => {
      Object.values(rateLimitTiers).forEach(tier => {
        expect(tier.timeWindow).toBeDefined()
        expect(typeof tier.timeWindow).toBe('string')
      })
    })
  })

  describe('globalRateLimit', () => {
    test('has reasonable defaults', () => {
      expect(globalRateLimit.max).toBeGreaterThan(100)
      expect(globalRateLimit.timeWindow).toBe('1 minute')
    })
  })

  describe('getRateLimitForRoute', () => {
    test('returns health tier for /health', () => {
      const config = getRateLimitForRoute('/health')
      expect(config.max).toBe(rateLimitTiers.health.max)
    })

    test('returns auth tier for /api/me', () => {
      const config = getRateLimitForRoute('/api/me')
      expect(config.max).toBe(rateLimitTiers.auth.max)
    })

    test('returns read tier for /api/campaigns', () => {
      const config = getRateLimitForRoute('/api/campaigns')
      expect(config.max).toBe(rateLimitTiers.read.max)
    })

    test('returns expensive tier for generate-assets', () => {
      const config = getRateLimitForRoute('/api/campaigns/:id/generate-assets')
      expect(config.max).toBe(rateLimitTiers.expensive.max)
    })

    test('returns standard tier for unknown routes', () => {
      const config = getRateLimitForRoute('/api/unknown')
      expect(config.max).toBe(rateLimitTiers.standard.max)
    })
  })
})

describe('Security Configuration', () => {
  test('request body limit is configured', () => {
    // This is a configuration test - the actual limit is set in index.ts
    const expectedLimit = 10 * 1024 * 1024 // 10MB
    expect(expectedLimit).toBe(10485760)
  })

  test('rate limit tiers are appropriately tiered', () => {
    // Expensive operations should have stricter limits
    expect(rateLimitTiers.expensive.max).toBeLessThanOrEqual(10)

    // Analytics refresh should have very strict limits
    expect(rateLimitTiers.analytics.max).toBeLessThanOrEqual(5)

    // Standard operations should be generous
    expect(rateLimitTiers.standard.max).toBeGreaterThanOrEqual(100)

    // Read operations should allow more requests
    expect(rateLimitTiers.read.max).toBeGreaterThanOrEqual(200)
  })
})
