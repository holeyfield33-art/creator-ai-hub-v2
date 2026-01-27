'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  getCampaign,
  uploadCampaignSource,
  generateAssets,
  updateAsset,
  CampaignDetail,
  GeneratedAsset,
} from '@/lib/campaigns-api'
import {
  listConnections,
  schedulePost,
  SocialConnection,
} from '@/lib/social-api'
import { getCampaignMetrics, CampaignMetrics } from '@/lib/analytics-api'
import { format } from 'date-fns'

const CHANNELS = [
  { id: 'twitter', label: 'Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'blog', label: 'Blog Post' },
  { id: 'email', label: 'Email' },
]

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Upload state
  const [uploadType, setUploadType] = useState<'text' | 'file'>('text')
  const [textContent, setTextContent] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // Generation state
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  
  // Asset editing state
  const [activeTab, setActiveTab] = useState<string>('twitter')
  const [editingAssets, setEditingAssets] = useState<{ [key: string]: string }>({})
  const [savingAssets, setSavingAssets] = useState<{ [key: string]: boolean }>({})
  
  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleAssetId, setScheduleAssetId] = useState<string | null>(null)
  const [scheduleContent, setScheduleContent] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  const [scheduling, setScheduling] = useState(false)
  
  // Metrics state
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)

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
      
      // Initialize editing state with existing content
      const editState: { [key: string]: string } = {}
      data.generatedAssets?.forEach(asset => {
        editState[asset.id] = asset.content || ''
      })
      setEditingAssets(editState)
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
      await loadCampaign()
      alert('Text uploaded successfully! Analysis job created.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload text')
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerateAssets() {
    if (!session?.access_token || selectedChannels.length === 0) return

    try {
      setGenerating(true)
      await generateAssets(session.access_token, params.id, selectedChannels)
      alert(`Asset generation started for ${selectedChannels.length} channel(s)!`)
      setSelectedChannels([])
      
      // Poll for updates
      setTimeout(() => loadCampaign(), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate assets')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveAsset(assetId: string) {
    if (!session?.access_token) return
    
    const content = editingAssets[assetId]
    if (!content || !content.trim()) return

    try {
      setSavingAssets({ ...savingAssets, [assetId]: true })
      await updateAsset(session.access_token, assetId, content.trim())
      await loadCampaign()
      alert('Asset saved successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save asset')
    } finally {
      setSavingAssets({ ...savingAssets, [assetId]: false })
    }
  }

  function handleCopyAsset(content: string) {
    navigator.clipboard.writeText(content)
    alert('Copied to clipboard!')
  }
  
  async function handleOpenScheduleModal(assetId: string, content: string) {
    if (!session?.access_token) return
    
    // Load connections
    try {
      const { connections: conns } = await listConnections(session.access_token)
      setConnections(conns)
      
      if (conns.length === 0) {
        alert('Please connect a social account first. Visit the Schedule page to connect.')
        router.push('/app/schedule')
        return
      }
      
      setScheduleAssetId(assetId)
      setScheduleContent(content)
      setSelectedConnection(conns[0].id)
      
      // Set default time to 1 hour from now
      const defaultTime = new Date()
      defaultTime.setHours(defaultTime.getHours() + 1)
      setScheduledFor(defaultTime.toISOString().slice(0, 16))
      
      setScheduleModalOpen(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load connections')
    }
  }
  
  async function handleSchedulePost() {
    if (!session?.access_token || !scheduleAssetId || !selectedConnection) return
    
    try {
      setScheduling(true)
      await schedulePost({
        assetId: scheduleAssetId,
        connectionId: selectedConnection,
        scheduledFor,
        content: scheduleContent,
      }, session.access_token)
      
      alert('Post scheduled successfully!')
      setScheduleModalOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to schedule post')
    } finally {
      setScheduling(false)
    }
  }

  function toggleChannel(channelId: string) {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    )
  }

  async function loadMetrics() {
    if (!session?.access_token) return

    try {
      setLoadingMetrics(true)
      const metrics = await getCampaignMetrics(session.access_token, params.id)
      setCampaignMetrics(metrics)
      setShowMetrics(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoadingMetrics(false)
    }
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

  const latestAnalysis = campaign.analyses?.[0]
  const assetsByChannel = campaign.generatedAssets?.reduce((acc, asset) => {
    if (!acc[asset.assetType]) acc[asset.assetType] = []
    acc[asset.assetType].push(asset)
    return acc
  }, {} as { [key: string]: GeneratedAsset[] })

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

      {/* Campaign Header */}
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

      {/* Analysis Summary */}
      {latestAnalysis && (
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', backgroundColor: '#f9f9f9' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Content Analysis</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Summary</h3>
            <p style={{ color: '#444' }}>{latestAnalysis.results.summary}</p>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Key Points</h3>
            <ul style={{ paddingLeft: '1.5rem', color: '#444' }}>
              {latestAnalysis.results.key_points?.map((point, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>{point}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Content Hooks</h3>
            <ul style={{ paddingLeft: '1.5rem', color: '#444' }}>
              {latestAnalysis.results.hooks?.map((hook, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>{hook}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Generate Assets Section */}
      {latestAnalysis && (
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', backgroundColor: '#f0f8ff' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Generate Assets</h2>
          
          <p style={{ marginBottom: '1rem', color: '#666' }}>Select channels to generate content for:</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            {CHANNELS.map(channel => (
              <label key={channel.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.id)}
                  onChange={() => toggleChannel(channel.id)}
                />
                {channel.label}
              </label>
            ))}
          </div>
          
          <button
            onClick={handleGenerateAssets}
            disabled={generating || selectedChannels.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: generating || selectedChannels.length === 0 ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: generating || selectedChannels.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            {generating ? 'Generating...' : `Generate Assets (${selectedChannels.length})`}
          </button>
        </div>
      )}

      {/* Generated Assets */}
      {campaign.generatedAssets && campaign.generatedAssets.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Generated Assets</h2>
          
          {/* Channel Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #ddd', marginBottom: '1rem' }}>
            {CHANNELS.filter(ch => assetsByChannel?.[ch.id]).map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveTab(channel.id)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderBottom: activeTab === channel.id ? '3px solid #0070f3' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontWeight: activeTab === channel.id ? '600' : '400',
                  color: activeTab === channel.id ? '#0070f3' : '#666',
                }}
              >
                {channel.label} ({assetsByChannel[channel.id]?.length || 0})
              </button>
            ))}
          </div>
          
          {/* Asset Content */}
          <div>
            {assetsByChannel?.[activeTab]?.map((asset) => (
              <div
                key={asset.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1rem',
                  backgroundColor: 'white',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: '600', color: '#666' }}>
                    Status: <span style={{ 
                      color: asset.status === 'approved' ? 'green' : asset.status === 'generated' ? 'blue' : 'gray' 
                    }}>{asset.status}</span>
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#999' }}>
                    {new Date(asset.createdAt).toLocaleString()}
                  </span>
                </div>
                
                <textarea
                  value={editingAssets[asset.id] || ''}
                  onChange={(e) => setEditingAssets({ ...editingAssets, [asset.id]: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    marginBottom: '0.75rem',
                    resize: 'vertical',
                  }}
                />
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleSaveAsset(asset.id)}
                    disabled={savingAssets[asset.id]}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: savingAssets[asset.id] ? '#ccc' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: savingAssets[asset.id] ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {savingAssets[asset.id] ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleCopyAsset(editingAssets[asset.id] || '')}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'white',
                      color: '#0070f3',
                      border: '1px solid #0070f3',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => handleOpenScheduleModal(asset.id, editingAssets[asset.id] || '')}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Section (if no analysis yet) */}
      {!latestAnalysis && (
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#f9f9f9' }}>
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
          </div>

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
      )}
      
      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setScheduleModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Schedule Post</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Social Account
              </label>
              <select
                value={selectedConnection}
                onChange={(e) => setSelectedConnection(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.platform.toUpperCase()} - @{conn.username}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Content
              </label>
              <textarea
                value={scheduleContent}
                onChange={(e) => setScheduleContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Schedule For
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setScheduleModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'white',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSchedulePost}
                disabled={scheduling || !scheduleContent.trim() || !scheduledFor}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: scheduling || !scheduleContent.trim() || !scheduledFor ? '#ccc' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: scheduling || !scheduleContent.trim() || !scheduledFor ? 'not-allowed' : 'pointer',
                }}
              >
                {scheduling ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Campaign Metrics Section */}
      <div style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Campaign Metrics</h2>
          <button
            onClick={loadMetrics}
            disabled={loadingMetrics}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: loadingMetrics ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loadingMetrics ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingMetrics ? 'Loading...' : showMetrics ? 'Refresh Metrics' : 'Load Metrics'}
          </button>
        </div>

        {showMetrics && campaignMetrics && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Posts</div>
                <div style={{ fontSize: '2rem', fontWeight: '700' }}>{campaignMetrics.summary.totalPosts}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Impressions</div>
                <div style={{ fontSize: '2rem', fontWeight: '700' }}>{campaignMetrics.summary.totalImpressions.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Engagements</div>
                <div style={{ fontSize: '2rem', fontWeight: '700' }}>{campaignMetrics.summary.totalEngagements.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Engagement Rate</div>
                <div style={{ fontSize: '2rem', fontWeight: '700' }}>{campaignMetrics.summary.avgEngagementRate.toFixed(2)}%</div>
              </div>
            </div>

            {/* Post Performance Table */}
            {campaignMetrics.posts.length > 0 && (
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Post Performance</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Platform</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Content</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Posted</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Impressions</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Engagements</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignMetrics.posts.map((post) => (
                        <tr key={post.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ 
                              padding: '0.25rem 0.5rem', 
                              backgroundColor: post.platform === 'x' ? '#1DA1F2' : '#0077B5',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              {post.platform.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', maxWidth: '300px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {post.content}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#666' }}>
                            {post.postedAt ? format(new Date(post.postedAt), 'MMM d, yyyy') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {post.metrics ? post.metrics.impressions.toLocaleString() : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {post.metrics ? post.metrics.engagements.toLocaleString() : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                            {post.metrics && post.metrics.engagementRate 
                              ? `${post.metrics.engagementRate.toFixed(2)}%`
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
