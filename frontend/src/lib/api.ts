import { supabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

export interface BackendUser {
  id: string
  email: string
  name?: string
}

export async function fetchCurrentUser(): Promise<BackendUser | null> {
  try {
    // Get the current Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      return null
    }

    // Call backend /api/me with the access token
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function request<T = any>(
  path: string,
  options: {
    method: string
    token: string
    body?: any
  }
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  
  const response = await fetch(url, {
    method: options.method,
    headers: {
      'Authorization': `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed: ${response.status}`)
  }

  return await response.json()
}
