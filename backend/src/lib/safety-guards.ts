/**
 * Safety Guards - Enforces usage limits and safety constraints
 * Phase 13-15: Production safety for AI operations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Environment-based configuration with safe defaults
export const SAFETY_CONFIG = {
  // Kill switches
  AI_DISABLED: process.env.AI_DISABLED === 'true',
  AUTO_PROCESSING: process.env.AUTO_PROCESSING !== 'false', // Default enabled
  
  // File limits
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '100'),
  MAX_DURATION_MINUTES: parseInt(process.env.MAX_DURATION_MINUTES || '60'),
  
  // Daily quotas (per user)
  MAX_TRANSCRIPTIONS_PER_DAY: parseInt(process.env.MAX_TRANSCRIPTIONS_PER_DAY || '10'),
  MAX_GENERATIONS_PER_DAY: parseInt(process.env.MAX_GENERATIONS_PER_DAY || '20'),
  
  // Supported MIME types
  SUPPORTED_MIME_TYPES: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/x-m4a',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
  ],
}

export interface ValidationResult {
  allowed: boolean
  reason?: string
}

/**
 * Check if user has an active processing job
 */
export async function checkActiveJob(userId: string): Promise<ValidationResult> {
  const activeSources = await prisma.campaign_sources.findMany({
    where: {
      campaign: { userId },
      status: { in: ['transcribing', 'generating'] },
    },
    take: 1,
  })

  if (activeSources.length > 0) {
    return {
      allowed: false,
      reason: 'You already have a file being processed. Please wait for it to complete.',
    }
  }

  return { allowed: true }
}

/**
 * Validate file constraints
 */
export function validateFile(
  mimeType: string,
  sizeBytes: number,
  durationSeconds?: number
): ValidationResult {
  // Check MIME type
  if (!SAFETY_CONFIG.SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return {
      allowed: false,
      reason: `Unsupported file type. Accepted: audio (MP3, WAV, M4A) and video (MP4, MOV).`,
    }
  }

  // Check file size
  const sizeMB = sizeBytes / (1024 * 1024)
  if (sizeMB > SAFETY_CONFIG.MAX_FILE_SIZE_MB) {
    return {
      allowed: false,
      reason: `File too large. Maximum size: ${SAFETY_CONFIG.MAX_FILE_SIZE_MB}MB.`,
    }
  }

  // Check duration if provided
  if (durationSeconds !== undefined) {
    const durationMinutes = durationSeconds / 60
    if (durationMinutes > SAFETY_CONFIG.MAX_DURATION_MINUTES) {
      return {
        allowed: false,
        reason: `File too long. Maximum duration: ${SAFETY_CONFIG.MAX_DURATION_MINUTES} minutes.`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Check and update daily quota for transcriptions
 */
export async function checkTranscriptionQuota(userId: string): Promise<ValidationResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const quota = await prisma.usage_quotas.upsert({
    where: {
      userId_quotaDate: {
        userId,
        quotaDate: today,
      },
    },
    update: {},
    create: {
      userId,
      quotaDate: today,
      transcriptionsUsed: 0,
      generationsUsed: 0,
      transcriptionsLimit: SAFETY_CONFIG.MAX_TRANSCRIPTIONS_PER_DAY,
      generationsLimit: SAFETY_CONFIG.MAX_GENERATIONS_PER_DAY,
    },
  })

  if (quota.transcriptionsUsed >= quota.transcriptionsLimit) {
    return {
      allowed: false,
      reason: `Daily transcription limit reached (${quota.transcriptionsLimit}). Try again tomorrow.`,
    }
  }

  return { allowed: true }
}

/**
 * Check and update daily quota for asset generation
 */
export async function checkGenerationQuota(userId: string): Promise<ValidationResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const quota = await prisma.usage_quotas.upsert({
    where: {
      userId_quotaDate: {
        userId,
        quotaDate: today,
      },
    },
    update: {},
    create: {
      userId,
      quotaDate: today,
      transcriptionsUsed: 0,
      generationsUsed: 0,
      transcriptionsLimit: SAFETY_CONFIG.MAX_TRANSCRIPTIONS_PER_DAY,
      generationsLimit: SAFETY_CONFIG.MAX_GENERATIONS_PER_DAY,
    },
  })

  if (quota.generationsUsed >= quota.generationsLimit) {
    return {
      allowed: false,
      reason: `Daily generation limit reached (${quota.generationsLimit}). Try again tomorrow.`,
    }
  }

  return { allowed: true }
}

/**
 * Increment transcription usage counter
 */
export async function incrementTranscriptionUsage(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.usage_quotas.upsert({
    where: {
      userId_quotaDate: { userId, quotaDate: today },
    },
    update: {
      transcriptionsUsed: { increment: 1 },
    },
    create: {
      userId,
      quotaDate: today,
      transcriptionsUsed: 1,
      generationsUsed: 0,
      transcriptionsLimit: SAFETY_CONFIG.MAX_TRANSCRIPTIONS_PER_DAY,
      generationsLimit: SAFETY_CONFIG.MAX_GENERATIONS_PER_DAY,
    },
  })
}

/**
 * Increment generation usage counter
 */
export async function incrementGenerationUsage(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.usage_quotas.upsert({
    where: {
      userId_quotaDate: { userId, quotaDate: today },
    },
    update: {
      generationsUsed: { increment: 1 },
    },
    create: {
      userId,
      quotaDate: today,
      transcriptionsUsed: 0,
      generationsUsed: 1,
      transcriptionsLimit: SAFETY_CONFIG.MAX_TRANSCRIPTIONS_PER_DAY,
      generationsLimit: SAFETY_CONFIG.MAX_GENERATIONS_PER_DAY,
    },
  })
}

/**
 * Check if source already has transcript (idempotency)
 */
export async function shouldTranscribe(sourceId: string): Promise<boolean> {
  const source = await prisma.campaign_sources.findUnique({
    where: { id: sourceId },
    select: { transcriptText: true },
  })

  return !source?.transcriptText
}

/**
 * Check if assets already exist for source (idempotency)
 */
export async function shouldGenerateAssets(campaignId: string): Promise<boolean> {
  const existingAssets = await prisma.generated_assets.findFirst({
    where: {
      campaignId,
      status: 'completed',
    },
  })

  return !existingAssets
}

/**
 * Get user's current quota status
 */
export async function getUserQuotaStatus(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const quota = await prisma.usage_quotas.findUnique({
    where: {
      userId_quotaDate: { userId, quotaDate: today },
    },
  })

  return {
    transcriptions: {
      used: quota?.transcriptionsUsed || 0,
      limit: quota?.transcriptionsLimit || SAFETY_CONFIG.MAX_TRANSCRIPTIONS_PER_DAY,
    },
    generations: {
      used: quota?.generationsUsed || 0,
      limit: quota?.generationsLimit || SAFETY_CONFIG.MAX_GENERATIONS_PER_DAY,
    },
  }
}
