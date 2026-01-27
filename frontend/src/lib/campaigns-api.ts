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
): Promise<{ message: string; jobs: any[] }> {
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
  return request<CampaignSource>(`/api/campaigns/${campaignId}/upload`, {
    method: 'POST',
    token,
    body: data,
  })
}
