'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getCampaign, uploadCampaignSource, Campaign, CampaignSource } from '@/lib/campaigns-api'

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Upload state
  const [uploadType, setUploadType] = useState<'text' | 'file'>('text')
  const [textContent, setTextContent] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login')
      return
    }

    if (session?.access_token) {
      loadCampaign()
    }
  }, [session, authLoading, router, params.id])

  async function loadCampaign() {
    if (!session?.access_token) return

    try {
      setLoading(true)
      setError(null)
      const data = await getCampaign(session.access_token, params.id)
      setCampaign(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  async function handleUploadText() {
    if (!session?.access_token || !textContent.trim()) return

    try {
      setUploading(true)
      await uploadCampaignSource(session.access_token, params.id, {
        sourceType: 'text',
        text: textContent.trim(),
      })
      setTextContent('')
      await loadCampaign() // Reload to show new source
      alert('Text uploaded successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload text')
    } finally {
      setUploading(false)
    }
  }

  async function handleUploadFile() {
    if (!session?.access_token) return

    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setUploading(true)
        await uploadCampaignSource(session.access_token!, params.id, {
          sourceType: 'file',
          fileName: file.name,
          fileSize: file.size,
        })
        await loadCampaign()
        alert('File metadata uploaded (storage not yet implemented)')
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to upload file')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  if (authLoading || loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#c00' }}>{error || 'Campaign not found'}</p>
        <button onClick={() => router.push('/app/campaigns')}>← Back to Campaigns</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={() => router.push('/app/campaigns')}
        style={{
          padding: '0.5rem 1rem',
          marginBottom: '1rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        ← Back to Campaigns
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {campaign.name}
        </h1>
        {campaign.description && (
          <p style={{ color: '#666', fontSize: '1.1rem' }}>{campaign.description}</p>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.9rem', color: '#999' }}>
          <span>Status: <strong>{campaign.status}</strong></span>
          {campaign.budget && <span>Budget: <strong>${campaign.budget}</strong></span>}
          <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', backgroundColor: '#f9f9f9' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Upload Source Content</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="radio"
              value="text"
              checked={uploadType === 'text'}
              onChange={(e) => setUploadType(e.target.value as 'text' | 'file')}
            />
            Paste Text
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="radio"
              value="file"
              checked={uploadType === 'file'}
              onChange={(e) => setUploadType(e.target.value as 'text' | 'file')}
            />
            Upload File
          </label>
        </div>

        {uploadType === 'text' ? (
          <div>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your content here..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'monospace',
                marginBottom: '1rem',
              }}
            />
            <button
              onClick={handleUploadText}
              disabled={uploading || !textContent.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: uploading || !textContent.trim() ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading || !textContent.trim() ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Text'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Click the button below to select a file. Note: File storage is not yet fully implemented.
            </p>
            <button
              onClick={handleUploadFile}
              disabled={uploading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: uploading ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {uploading ? 'Uploading...' : 'Select File'}
            </button>
          </div>
        )}
      </div>

      {/* Sources List */}
      {campaign.sources && campaign.sources.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Uploaded Sources</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {campaign.sources.map((source) => (
              <div
                key={source.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600' }}>Type: {source.sourceType}</span>
                  <span style={{ fontSize: '0.875rem', color: '#999' }}>
                    {new Date(source.createdAt).toLocaleString()}
                  </span>
                </div>
                {source.sourceText && (
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}>
                    {source.sourceText}
                  </div>
                )}
                {source.sourceUrl && (
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>
                    URL: {source.sourceUrl}
                  </p>
                )}
                {source.metadata && typeof source.metadata === 'object' && (
                  <p style={{ color: '#999', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {JSON.stringify(source.metadata)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
