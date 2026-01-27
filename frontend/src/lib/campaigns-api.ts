// API client for campaigns
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

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
  metadata: any
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
  metadata: any
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
  const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create campaign' }))
    throw new Error(error.error || 'Failed to create campaign')
  }

  return response.json()
}

export async function listCampaigns(token: string): Promise<Campaign[]> {
  const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch campaigns')
  }

  return response.json()
}

export async function getCampaign(token: string, id: string): Promise<CampaignDetail> {
  const response = await fetch(`${API_BASE_URL}/api/campaigns/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Campaign not found')
  }

  return response.json()
}

export async function generateAssets(
  token: string,
  campaignId: string,
  channels: string[]
): Promise<{ message: string; jobs: any[] }> {
  const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/generate-assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channels }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate assets' }))
    throw new Error(error.error || 'Failed to generate assets')
  }

  return response.json()
}

export async function updateAsset(
  token: string,
  assetId: string,
  content: string
): Promise<GeneratedAsset> {
  const response = await fetch(`${API_BASE_URL}/api/assets/${assetId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update asset' }))
    throw new Error(error.error || 'Failed to update asset')
  }

  return response.json()
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
): Promise<CampaignSource> {
  const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to upload' }))
    throw new Error(error.error || 'Failed to upload')
  }

  return response.json()
}
