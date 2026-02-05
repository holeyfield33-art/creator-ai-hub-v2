import { z } from 'zod'
import { FastifyRequest, FastifyReply } from 'fastify'

// ==================== Campaign Schemas ====================

export const createCampaignSchema = z.object({
  name: z.string()
    .min(1, 'Campaign name is required')
    .max(200, 'Campaign name must be 200 characters or less')
    .transform((v) => v.trim()),
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional()
    .transform((v) => v?.trim()),
  budget: z.number()
    .min(0, 'Budget must be positive')
    .max(1000000000, 'Budget exceeds maximum')
    .optional(),
})

export const uploadSourceSchema = z.object({
  sourceType: z.enum(['text', 'file'], {
    message: 'Source type must be "text" or "file"',
  }),
  text: z.string()
    .max(100000, 'Text content exceeds maximum length')
    .optional()
    .transform((v) => v?.trim()),
  fileName: z.string()
    .max(500, 'File name too long')
    .optional(),
  fileSize: z.number()
    .min(0)
    .max(100 * 1024 * 1024, 'File size exceeds 100MB limit')
    .optional(),
}).refine(
  (data) => {
    if (data.sourceType === 'text') {
      return data.text && data.text.length > 0
    }
    if (data.sourceType === 'file') {
      return data.fileName && data.fileName.length > 0
    }
    return true
  },
  {
    message: 'Text content is required for text sources, fileName is required for file sources',
  }
)

export const registerSourceSchema = z.object({
  sourceType: z.string()
    .max(50, 'Source type too long')
    .default('video'),
  sourceUrl: z.string()
    .min(1, 'Source URL is required')
    .url('Invalid URL format')
    .max(2000, 'URL too long')
    .transform((v) => v.trim()),
  fileName: z.string()
    .max(500, 'File name too long')
    .optional(),
  mimeType: z.string()
    .max(100, 'MIME type too long')
    .optional(),
  size: z.number()
    .min(0)
    .max(10 * 1024 * 1024 * 1024, 'File size exceeds 10GB limit')
    .optional(),
})

// Supported channels for asset generation
const SUPPORTED_CHANNELS = [
  'twitter',
  'linkedin',
  'youtube_short',
  'tiktok',
  'instagram_reel',
  'threads',
  'blog',
] as const

export const generateAssetsSchema = z.object({
  channels: z.array(z.enum(SUPPORTED_CHANNELS, {
    message: `Invalid channel. Supported channels: ${SUPPORTED_CHANNELS.join(', ')}`,
  }))
    .min(1, 'At least one channel is required')
    .max(10, 'Maximum 10 channels allowed'),
})

export const updateAssetSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(50000, 'Content exceeds maximum length')
    .transform((v) => v.trim()),
})

// ==================== Schedule Schemas ====================

export const schedulePostSchema = z.object({
  assetId: z.string()
    .uuid('Invalid asset ID format'),
  connectionId: z.string()
    .uuid('Invalid connection ID format'),
  scheduledFor: z.string()
    .refine((v) => {
      const date = new Date(v)
      return !isNaN(date.getTime()) && date > new Date()
    }, 'Scheduled time must be a valid future date'),
  content: z.string()
    .min(1, 'Content is required')
    .max(10000, 'Content exceeds maximum length'),
  mediaUrls: z.array(z.string().url('Invalid media URL'))
    .max(10, 'Maximum 10 media URLs allowed')
    .optional()
    .default([]),
})

// ==================== Analytics Schemas ====================

export const dashboardQuerySchema = z.object({
  days: z.string()
    .optional()
    .default('30')
    .transform((v) => {
      const num = parseInt(v, 10)
      if (isNaN(num) || num < 1 || num > 365) {
        return '30'
      }
      return v
    }),
  platform: z.string()
    .max(50, 'Platform name too long')
    .optional(),
})

// ==================== Param Schemas ====================

export const idParamSchema = z.object({
  id: z.string()
    .uuid('Invalid ID format'),
})

export const connectionIdParamSchema = z.object({
  connectionId: z.string()
    .uuid('Invalid connection ID format'),
})

export const postIdParamSchema = z.object({
  postId: z.string()
    .uuid('Invalid post ID format'),
})

// ==================== OAuth Callback Schema ====================

export const oauthCallbackSchema = z.object({
  code: z.string()
    .min(1, 'Authorization code is required')
    .max(2000, 'Code too long'),
  state: z.string()
    .min(1, 'State is required')
    .max(1000, 'State too long'),
})

// ==================== Validation Helper ====================

export type ValidationSchema = z.ZodSchema

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errorMessage = result.error.issues
    .map((e: z.core.$ZodIssue) => `${e.path.join('.')}: ${e.message}`)
    .join('; ')
  return { success: false, error: errorMessage }
}

// Fastify preValidation hook factory
export function createValidator<T>(schema: z.ZodSchema<T>, location: 'body' | 'query' | 'params' = 'body') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const dataToValidate = location === 'body'
      ? request.body
      : location === 'query'
        ? request.query
        : request.params

    const result = validate(schema, dataToValidate)

    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: result.error,
      })
    }

    // Replace with validated/transformed data
    if (location === 'body') {
      (request as any).body = result.data
    } else if (location === 'query') {
      (request as any).query = result.data
    } else {
      (request as any).params = result.data
    }
  }
}

// Export types for route handlers
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UploadSourceInput = z.infer<typeof uploadSourceSchema>
export type RegisterSourceInput = z.infer<typeof registerSourceSchema>
export type GenerateAssetsInput = z.infer<typeof generateAssetsSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
export type SchedulePostInput = z.infer<typeof schedulePostSchema>
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>
