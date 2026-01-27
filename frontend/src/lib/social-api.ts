import { request } from './api'

export interface SocialConnection {
  id: string
  platform: string
  username: string
  createdAt: string
  tokenExpiry: string | null
}

export interface ScheduledPost {
  id: string
  content: string
  scheduledFor: string
  status: 'pending' | 'posting' | 'posted' | 'failed' | 'cancelled'
  postedAt: string | null
  platformPostId: string | null
  error: string | null
  platform: string
  asset: {
    id: string
    content: string
    assetType: string
  }
  socialConnection: {
    platform: string
    username: string
  }
}

export async function getConnectXUrl(token: string): Promise<{ authUrl: string }> {
  return request('/api/social/x/connect', {
    method: 'GET',
    token,
  })
}

export async function listConnections(token: string): Promise<{ connections: SocialConnection[] }> {
  return request('/api/social/connections', {
    method: 'GET',
    token,
  })
}

export async function disconnectConnection(connectionId: string, token: string): Promise<{ success: boolean }> {
  return request(`/api/social/connections/${connectionId}`, {
    method: 'DELETE',
    token,
  })
}

export async function schedulePost(
  data: {
    assetId: string
    connectionId: string
    scheduledFor: string
    content: string
    mediaUrls?: string[]
  },
  token: string
): Promise<{ scheduledPost: ScheduledPost }> {
  return request('/api/schedule', {
    method: 'POST',
    token,
    body: data,
  })
}

export async function listScheduledPosts(token: string): Promise<{ posts: ScheduledPost[] }> {
  return request('/api/schedule', {
    method: 'GET',
    token,
  })
}

export async function cancelScheduledPost(postId: string, token: string): Promise<{ success: boolean }> {
  return request(`/api/schedule/${postId}`, {
    method: 'DELETE',
    token,
  })
}
