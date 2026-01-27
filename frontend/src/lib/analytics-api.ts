import { request } from './api'

export interface DashboardMetrics {
  overview: {
    totalPosts: number
    totalImpressions: number
    totalEngagements: number
    avgEngagementRate: number
    totalLikes: number
    totalShares: number
    totalComments: number
  }
  platformBreakdown: Array<{
    platform: string
    posts: number
    impressions: number
    engagements: number
  }>
  dailyMetrics: Array<{
    date: string
    impressions: number
    engagements: number
  }>
  topCampaigns: Array<{
    id: string
    name: string
    posts: number
    impressions: number
    engagements: number
    engagementRate: number
  }>
}

export interface CampaignMetrics {
  summary: {
    totalPosts: number
    totalImpressions: number
    totalEngagements: number
    avgEngagementRate: number
    totalLikes: number
    totalShares: number
    totalComments: number
  }
  posts: Array<{
    id: string
    platform: string
    content: string
    postedAt: string | null
    platformPostId: string | null
    metrics: {
      impressions: number
      engagements: number
      likes: number
      shares: number
      comments: number
      clicks: number
      engagementRate: number | null
    } | null
  }>
}

export async function getDashboardMetrics(
  token: string,
  days: number = 30,
  platform?: string
): Promise<DashboardMetrics> {
  const params = new URLSearchParams({ days: days.toString() })
  if (platform) params.append('platform', platform)
  return request<DashboardMetrics>(`/api/analytics/dashboard?${params}`, { token })
}

export async function getCampaignMetrics(
  token: string,
  campaignId: string
): Promise<CampaignMetrics> {
  return request<CampaignMetrics>(`/api/analytics/campaigns/${campaignId}/metrics`, { token })
}

export async function refreshMetrics(token: string): Promise<{ jobsCreated: number }> {
  return request<{ jobsCreated: number }>('/api/analytics/refresh', {
    method: 'POST',
    token,
  })
}
