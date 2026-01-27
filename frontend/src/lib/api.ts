import { supabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

export interface BackendUser {
  id: string
  email: string
  name?: string
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
    console.error(`[API] Network error: ${method} ${url}`, err)
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
