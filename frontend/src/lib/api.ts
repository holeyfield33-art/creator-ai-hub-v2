import { supabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export const DEMO_MODE_EVENT = 'creator-ai-demo-mode'
export const DEMO_MODE_STORAGE_KEY = 'creatorAiDemoModeActive'

export interface BackendUser {
  id: string
  email: string
  name?: string
}

function markDemoModeActive(path: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true')
  } catch (error) {
    console.warn('[API] Unable to persist demo mode state to localStorage.', error)
  }

  window.dispatchEvent(new CustomEvent(DEMO_MODE_EVENT, { detail: { path } }))
}

function getDemoResponse(path: string): { found: boolean; data?: unknown } {
  const now = new Date().toISOString()

  if (path === '/api/campaigns') {
    return { found: true, data: [] }
  }

  const campaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/)
  if (campaignMatch) {
    return {
      found: true,
      data: {
        id: campaignMatch[1],
        name: 'Demo Campaign',
        description: 'This is placeholder data while the API is offline.',
        status: 'draft',
        budget: null,
        userId: 'demo-user',
        createdAt: now,
        updatedAt: now,
        sources: [],
        analyses: [],
        generatedAssets: [],
      },
    }
  }

  if (path.startsWith('/api/analytics/dashboard')) {
    return {
      found: true,
      data: {
        overview: {
          totalPosts: 0,
          totalImpressions: 0,
          totalEngagements: 0,
          avgEngagementRate: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0,
        },
        platformBreakdown: [],
        dailyMetrics: [],
        topCampaigns: [],
      },
    }
  }

  const campaignMetricsMatch = path.match(/^\/api\/analytics\/campaigns\/([^/]+)\/metrics/)
  if (campaignMetricsMatch) {
    return {
      found: true,
      data: {
        summary: {
          totalPosts: 0,
          totalImpressions: 0,
          totalEngagements: 0,
          avgEngagementRate: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0,
        },
        posts: [],
      },
    }
  }

  if (path === '/api/social/connections') {
    return { found: true, data: { connections: [] } }
  }

  if (path === '/api/schedule') {
    return { found: true, data: { posts: [] } }
  }

  if (path === '/api/me') {
    return { found: true, data: null }
  }

  if (path === '/api/social/x/connect') {
    return { found: true, data: { authUrl: '/app/schedule?error=true' } }
  }

  return { found: false }
}

/**
 * Centralized API request helper.
 * - Resolves base URL from NEXT_PUBLIC_API_BASE_URL with localhost fallback
 * - Attaches Authorization header when token provided
 * - Sets Content-Type: application/json for request bodies
 * - Logs and throws descriptive errors on non-OK responses
 */
export async function request<T = any>(
  path: string,
  options: {
    method?: string
    token?: string
    body?: any
  } = {}
): Promise<T> {
  const { method = 'GET', token, body } = options
  const methodUpper = method.toUpperCase()
  const url = `${API_BASE_URL}${path}`

  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // Try demo mode for GET requests
    if (methodUpper === 'GET') {
      const demo = getDemoResponse(path)
      if (demo.found) {
        console.warn(`[API] ${methodUpper} ${url} failed; using demo data until the API is available.`)
        markDemoModeActive(path)
        return demo.data as T
      }
    }
    // For POST to create campaign, return a demo campaign
    if (methodUpper === 'POST' && path === '/api/campaigns') {
      console.warn(`[API] ${methodUpper} ${url} failed; returning demo campaign until the API is available.`)
      markDemoModeActive(path)
      const now = new Date().toISOString()
      return {
        id: `demo-campaign-${Date.now()}`,
        name: (body as any)?.name || 'Demo Campaign',
        description: (body as any)?.description || 'This is placeholder data while the API is offline.',
        status: 'draft',
        budget: (body as any)?.budget || null,
        userId: 'demo-user',
        createdAt: now,
        updatedAt: now,
        sources: [],
        analyses: [],
        generatedAssets: [],
      } as T
    }
    console.error(`[API] Network error: ${methodUpper} ${url}`, err)
    throw new Error(`Network error: Unable to reach the server. Please check your connection.`)
  }

  if (!response.ok) {
    let errorMessage: string
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorBody.message || `Request failed with status ${response.status}`
    } catch {
      const errorText = await response.text().catch(() => '')
      errorMessage = errorText || `Request failed with status ${response.status}`
    }
    console.error(`[API] ${response.status} ${method} ${url}: ${errorMessage}`)
    throw new Error(errorMessage)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * Get the current authenticated user's token from Supabase session.
 */
export async function getSessionToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Fetch the current user from the backend /api/me endpoint.
 */
export async function fetchCurrentUser(): Promise<BackendUser | null> {
  try {
    const token = await getSessionToken()
    if (!token) return null
    return await request<BackendUser>('/api/me', { token })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}
