'use client'

import { useState, useEffect } from 'react'
import { useAuth as useSupabaseAuth } from './auth-context'
import { fetchCurrentUser, BackendUser } from './api'

export function useBackendUser() {
  const { user: supabaseUser, loading: authLoading } = useSupabaseAuth()
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      if (authLoading) return
      
      if (!supabaseUser) {
        setBackendUser(null)
        setLoading(false)
        return
      }

      try {
        const user = await fetchCurrentUser()
        setBackendUser(user)
        setError(null)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load user')
        setBackendUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [supabaseUser, authLoading])

  return { user: backendUser, loading: loading || authLoading, error }
}
