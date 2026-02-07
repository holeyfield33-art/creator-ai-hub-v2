import { request } from './api'

export interface Campaign {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  userId: string
  createdAt: string
  updatedAt: string
  sources?: CampaignSource[]
  _count?: {
    sources: number
    analyses: number
    generatedAssets: number
  }
}

export interface CampaignSource {
  id: string
  campaignId: string
  sourceType: string
  sourceUrl: string | null
  sourceText: string | null
  metadata: Record<string, unknown> | null
  status?: string // uploaded, transcribing, generating, ready, error
  transcriptText?: string | null
  language?: string | null
  duration?: number | null
  processingError?: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignAnalysis {
  id: string
  campaignId: string
  analysisType: string
  results: {
    summary: string
    key_points: string[]
    hooks: string[]
  }
  summary: string | null
  score: number | null
  createdAt: string
  updatedAt: string
}

export interface GeneratedAsset {
  id: string
  campaignId: string
  assetType: string
  content: string | null
  url: string | null
  metadata: Record<string, unknown> | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface CampaignDetail extends Campaign {
  sources: CampaignSource[]
  analyses: CampaignAnalysis[]
  generatedAssets: GeneratedAsset[]
}

export async function createCampaign(
  token: string,
  data: { name: string; description?: string; budget?: number }
): Promise<Campaign> {
  return request<Campaign>('/api/campaigns', {
    method: 'POST',
    token,
    body: data,
  })
}

export async function listCampaigns(token: string): Promise<Campaign[]> {
  return request<Campaign[]>('/api/campaigns', { token })
}

export async function getCampaign(token: string, id: string): Promise<CampaignDetail> {
  return request<CampaignDetail>(`/api/campaigns/${id}`, { token })
}

export async function generateAssets(
  token: string,
  campaignId: string,
  channels: string[]
): Promise<{ message: string; jobs: { id: string; type: string }[] }> {
  return request('/api/campaigns/' + campaignId + '/generate-assets', {
    method: 'POST',
    token,
    body: { channels },
  })
}

export async function updateAsset(
  token: string,
  assetId: string,
  content: string
): Promise<GeneratedAsset> {
  return request<GeneratedAsset>(`/api/assets/${assetId}`, {
    method: 'PUT',
    token,
    body: { content },
  })
}

export interface UploadSourceResponse {
  source: CampaignSource
  job?: {
    id: string
    status: string
    type: string
  }
  message?: string
}

export async function uploadCampaignSource(
  token: string,
  campaignId: string,
  data: {
    sourceType: 'text' | 'file'
    text?: string
    fileName?: string
    fileSize?: number
  }
): Promise<UploadSourceResponse> {
  return request<UploadSourceResponse>(`/api/campaigns/${campaignId}/upload`, {
    method: 'POST',
    token,
    body: data,
  })
}

export async function registerCampaignSource(
  token: string,
  campaignId: string,
  data: {
    sourceType: string
    sourceUrl: string
    fileName?: string
    mimeType?: string
    size?: number
  }
): Promise<{ source: CampaignSource; analysis: CampaignAnalysis; campaign: { status: string } }> {
  return request(`/api/campaigns/${campaignId}/sources`, {
    method: 'POST',
    token,
    body: data,
  })
}

/**
 * Upload source for auto-processing (transcription + asset generation)
 */
export async function uploadSourceForProcessing(
  token: string,
  campaignId: string,
  data: {
    fileUrl: string
    fileKey: string
    mimeType: string
    sizeBytes: number
    duration?: number
    fileName?: string
  }
): Promise<{ source: CampaignSource }> {
  return request(`/api/campaigns/${campaignId}/sources`, {
    method: 'POST',
    token,
    body: data,
  })
}

/**
 * Get campaign processing status
 */
export interface CampaignStatus {
  isProcessing: boolean
  currentStatus?: string
  sources: CampaignSource[]
  assets: GeneratedAsset[]
  quotas: {
    transcriptions: { used: number; limit: number }
    generations: { used: number; limit: number }
  }
}

export async function getCampaignStatus(
  token: string,
  campaignId: string
): Promise<CampaignStatus> {
  return request(`/api/campaigns/${campaignId}/status`, { token })
}

export async function deleteCampaign(
  token: string,
  campaignId: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/campaigns/${campaignId}`, {
    method: 'DELETE',
    token,
  })
}

export interface JobStatus {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: Record<string, unknown> | null
  error?: string
  createdAt: string
  completedAt?: string
}

export async function getJobStatus(
  token: string,
  jobId: string
): Promise<JobStatus> {
  return request<JobStatus>(`/api/jobs/${jobId}`, { token })
}

// Helper function to poll job status until complete
export async function waitForJobs(
  token: string,
  jobIds: string[],
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<JobStatus[]> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const statuses = await Promise.all(
      jobIds.map(id => getJobStatus(token, id).catch(() => null))
    )

    const validStatuses = statuses.filter((s): s is JobStatus => s !== null)
    const allDone = validStatuses.every(
      s => s.status === 'completed' || s.status === 'failed'
    )

    if (allDone || validStatuses.length === 0) {
      return validStatuses
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  // Return last known statuses on timeout
  return await Promise.all(
    jobIds.map(id => getJobStatus(token, id).catch(() => ({
      id,
      type: 'unknown',
      status: 'failed' as const,
      error: 'Timeout waiting for job',
      createdAt: new Date().toISOString(),
    })))
  )
}
