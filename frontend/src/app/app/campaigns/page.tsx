'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { listCampaigns, createCampaign, Campaign } from '@/lib/campaigns-api'

export default function CampaignsPage() {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login')
      return
    }

    if (session?.access_token) {
      loadCampaigns()
    }
  }, [session, authLoading, router])

  async function loadCampaigns() {
    if (!session?.access_token) return

    try {
      setLoading(true)
      setError(null)
      const data = await listCampaigns(session.access_token)
      setCampaigns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCampaign() {
    if (!session?.access_token) return

    const name = prompt('Campaign name:')
    if (!name || name.trim().length === 0) return

    try {
      setCreating(true)
      const campaign = await createCampaign(session.access_token, { name: name.trim() })
      router.push(`/app/campaigns/${campaign.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create campaign')
      setCreating(false)
    }
  }

  if (authLoading || (loading && campaigns.length === 0)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Campaigns</h1>
        <button
          onClick={handleCreateCampaign}
          disabled={creating}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: creating ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: creating ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {creating ? 'Creating...' : 'New Campaign'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: '1rem' }}>
          <p style={{ color: '#c00' }}>{error}</p>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #ddd', borderRadius: '8px' }}>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '1rem' }}>No campaigns yet</p>
          <p style={{ color: '#999' }}>Click "New Campaign" to get started</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => router.push(`/app/campaigns/${campaign.id}`)}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0070f3'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#ddd'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    {campaign.name}
                  </h2>
                  {campaign.description && (
                    <p style={{ color: '#666', marginBottom: '0.5rem' }}>{campaign.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    <span>Status: {campaign.status}</span>
                    {campaign._count && (
                      <>
                        <span>Sources: {campaign._count.sources}</span>
                        <span>Assets: {campaign._count.generatedAssets}</span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: campaign.status === 'active' ? '#d4f4dd' : '#f0f0f0',
                    color: campaign.status === 'active' ? '#0d7d2d' : '#666',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                  }}
                >
                  {campaign.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
