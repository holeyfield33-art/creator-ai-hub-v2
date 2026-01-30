'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  getCampaign,
  uploadCampaignSource,
  uploadSourceForProcessing,
  getCampaignStatus,
  CampaignStatus,
  generateAssets,
  updateAsset,
  waitForJobs,
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
import VideoUpload from '@/components/VideoUpload'

const CHANNELS = [
  { id: 'twitter', label: 'Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'blog', label: 'Blog Post' },
  { id: 'email', label: 'Email' },
]

function getStatusClass(status: string) {
  switch (status) {
    case 'draft': return 'status-draft'
    case 'processing': return 'status-processing'
    case 'ready': return 'status-ready'
    case 'active': return 'status-active'
    default: return 'status-draft'
  }
}

interface CampaignDetailClientProps {
  campaignId: string
}

export default function CampaignDetailClient({ campaignId }: CampaignDetailClientProps) {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [textContent, setTextContent] = useState('')
  const [uploading, setUploading] = useState(false)

  // Processing status
  const [processingStatus, setProcessingStatus] = useState<CampaignStatus | null>(null)
  const [polling, setPolling] = useState(false)

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
  }, [session, authLoading, router, campaignId])

  async function loadCampaign() {
    if (!session?.access_token) return
    try {
      setLoading(true)
      setError(null)
      const data = await getCampaign(session.access_token, campaignId)
      setCampaign(data)
      const editState: { [key: string]: string } = {}
      data.generatedAssets?.forEach(asset => {
        editState[asset.id] = asset.content || ''
      })
      setEditingAssets(editState)

      // Load processing status
      await loadProcessingStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  async function loadProcessingStatus() {
    if (!session?.access_token) return
    try {
      const status = await getCampaignStatus(session.access_token, campaignId)
      setProcessingStatus(status)

      // Start polling if processing
      if (status.isProcessing && !polling) {
        setPolling(true)
        startPolling()
      }
    } catch (err) {
      console.error('Failed to load processing status:', err)
    }
  }

  function startPolling() {
    const interval = setInterval(async () => {
      if (!session?.access_token) {
        clearInterval(interval)
        return
      }

      try {
        const status = await getCampaignStatus(session.access_token, campaignId)
        setProcessingStatus(status)

        // Stop polling if no longer processing
        if (!status.isProcessing) {
          clearInterval(interval)
          setPolling(false)
          // Reload campaign to get updated data
          await loadCampaign()
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000) // Poll every 3 seconds

    // Cleanup on unmount
    return () => clearInterval(interval)
  }

  async function handleVideoUploadComplete(fileUrl: string, fileKey: string, file: File) {
    if (!session?.access_token) return
    try {
      setUploading(true)
      await uploadSourceForProcessing(session.access_token, campaignId, {
        fileUrl,
        fileKey,
        mimeType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
      })
      await loadCampaign()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload source')
    } finally {
      setUploading(false)
    }
  }

  function handleVideoUploadError(error: Error) {
    alert(`Upload failed: ${error.message}`)
  }

  async function handleGenerateAssets() {
    if (!session?.access_token || selectedChannels.length === 0) return
    try {
      setGenerating(true)
      const result = await generateAssets(session.access_token, campaignId, selectedChannels)
      setSelectedChannels([])

      // Wait for jobs to complete with polling
      if (result.jobs && result.jobs.length > 0) {
        const jobIds = result.jobs.map(j => j.id)
        const statuses = await waitForJobs(session.access_token, jobIds)
        const failed = statuses.filter(s => s.status === 'failed')
        if (failed.length > 0) {
          console.warn('Some asset generation jobs failed:', failed)
        }
      }

      await loadCampaign()
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save asset')
    } finally {
      setSavingAssets({ ...savingAssets, [assetId]: false })
    }
  }

  function handleCopyAsset(content: string) {
    navigator.clipboard.writeText(content)
  }

  async function handleOpenScheduleModal(assetId: string, content: string) {
    if (!session?.access_token) return
    try {
      const { connections: conns } = await listConnections(session.access_token)
      setConnections(conns)
      if (conns.length === 0) {
        alert('Please connect a social account first.')
        router.push('/app/schedule')
        return
      }
      setScheduleAssetId(assetId)
      setScheduleContent(content)
      setSelectedConnection(conns[0].id)
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
      const metrics = await getCampaignMetrics(session.access_token, campaignId)
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
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading campaign...</div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="p-8">
        <div className="glass-panel p-8 text-center">
          <p className="text-red-400 mb-4">{error || 'Campaign not found'}</p>
          <button onClick={() => router.push('/app/campaigns')} className="btn-secondary">
            Back to Campaigns
          </button>
        </div>
      </div>
    )
  }

  const latestAnalysis = campaign.analyses?.[0]
  const hasSource = campaign.sources && campaign.sources.length > 0
  const assetsByChannel = campaign.generatedAssets?.reduce((acc, asset) => {
    if (!acc[asset.assetType]) acc[asset.assetType] = []
    acc[asset.assetType].push(asset)
    return acc
  }, {} as { [key: string]: GeneratedAsset[] })

  const hasAssets = campaign.generatedAssets && campaign.generatedAssets.length > 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/app/campaigns')}
        className="btn-ghost text-sm mb-6 -ml-2"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Campaigns
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">{campaign.name}</h1>
            <span className={getStatusClass(campaign.status)}>{campaign.status}</span>
          </div>
          {campaign.description && (
            <p className="text-gray-400 text-lg">{campaign.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {campaign.budget && <span>Budget: ${campaign.budget}</span>}
            <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Source Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="section-title text-xl">Source Content</h2>
          {hasSource && (
            <span className="status-pill bg-green-500/20 text-green-400">
              {campaign.sources.length} uploaded
            </span>
          )}
        </div>

        {/* Processing Status Banner */}
        {processingStatus?.isProcessing && (
          <div className="glass-panel p-5 mb-4 border-l-4 border-brand-500">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="flex-1">
                <p className="text-brand-400 font-semibold">Processing in progress...</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {processingStatus.currentStatus === 'transcribing' && 'Transcribing audio...'}
                  {processingStatus.currentStatus === 'generating' && 'Generating content assets...'}
                  {!processingStatus.currentStatus && 'Starting processing...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Quotas */}
        {processingStatus?.quotas && (
          <div className="glass-panel p-4 mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Today's Usage</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400">Transcriptions</div>
                <div className="text-lg font-semibold text-white">
                  {processingStatus.quotas.transcriptions.used} / {processingStatus.quotas.transcriptions.limit}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Generations</div>
                <div className="text-lg font-semibold text-white">
                  {processingStatus.quotas.generations.used} / {processingStatus.quotas.generations.limit}
                </div>
              </div>
            </div>
          </div>
        )}

        {!hasSource && !latestAnalysis ? (
          <div className="glass-panel p-6">
            <p className="text-gray-400 text-sm mb-6">
              Upload audio or video. The system will automatically transcribe and generate content assets.
            </p>
            
            {/* Video upload section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Upload Audio/Video File</h3>
              <VideoUpload 
                onUploadComplete={handleVideoUploadComplete}
                onUploadError={handleVideoUploadError}
              />
            </div>

            {/* Text fallback */}
            <div className="border-t border-white/[0.06] pt-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Paste transcript instead (optional)</h3>
              <p className="text-xs text-gray-500 mb-3">If you already have a transcript, paste it here. This requires manual Generate.</p>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste transcript text here..."
                className="input-field font-mono text-sm min-h-[120px] resize-y mb-4"
              />
              <button
                onClick={async () => {
                  if (!session?.access_token || !textContent.trim()) return
                  try {
                    setUploading(true)
                    await uploadCampaignSource(session.access_token, campaignId, {
                      sourceType: 'text',
                      text: textContent.trim(),
                    })
                    setTextContent('')
                    await loadCampaign()
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to upload text')
                  } finally {
                    setUploading(false)
                  }
                }}
                disabled={uploading || !textContent.trim()}
                className="btn-secondary text-sm"
              >
                {uploading ? 'Uploading...' : 'Upload Text (Manual Generate)'}
              </button>
            </div>
          </div>
        ) : (hasSource || latestAnalysis) && (
          <div className="glass-panel p-6 space-y-5">
            {campaign.sources && campaign.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Uploaded Sources</h3>
                <ul className="space-y-2">
                  {campaign.sources.map((source) => (
                    <li key={source.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className={source.status === 'ready' ? 'text-green-400' : 'text-brand-400'}>
                          {source.status === 'ready' ? '✓' : '○'}
                        </span>
                        <span className="capitalize">{source.sourceType}</span>
                        {source.sourceUrl && (
                          <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline text-xs">
                            (view)
                          </a>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        source.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                        source.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-brand-500/20 text-brand-400'
                      }`}>
                        {source.status || 'uploaded'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show transcript if available */}
            {campaign.sources?.some(s => s.transcriptText) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Transcript</h3>
                <div className="bg-black/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {campaign.sources.find(s => s.transcriptText)?.transcriptText}
                  </p>
                </div>
              </div>
            )}
            
            {latestAnalysis && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Summary</h3>
                  <p className="text-gray-300 leading-relaxed">{latestAnalysis.results.summary}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Key Points</h3>
                  <ul className="space-y-1">
                    {latestAnalysis.results.key_points?.map((point, i) => (
                      <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                        <span className="text-brand-400 mt-0.5">-</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Content Hooks</h3>
                  <ul className="space-y-1">
                    {latestAnalysis.results.hooks?.map((hook, i) => (
                      <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                        <span className="text-brand-400 mt-0.5">-</span>
                        {hook}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Generate Assets Section */}
      <section className="mb-8">
        <h2 className="section-title text-xl mb-4">Generate Assets</h2>
        {hasSource || latestAnalysis ? (
          <div className="glass-panel p-6">
            <p className="text-gray-400 text-sm mb-4">Select channels to generate content for:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {CHANNELS.map(channel => (
                <label
                  key={channel.id}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all duration-200 text-sm ${
                    selectedChannels.includes(channel.id)
                      ? 'border-brand-500/50 bg-brand-600/10 text-brand-300'
                      : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="accent-brand-500"
                  />
                  {channel.label}
                </label>
              ))}
            </div>
            <button
              onClick={handleGenerateAssets}
              disabled={generating || selectedChannels.length === 0}
              className="btn-primary"
            >
              {generating ? 'Generating...' : `Generate Assets (${selectedChannels.length})`}
            </button>
          </div>
        ) : (
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Upload source content first to enable asset generation.</p>
          </div>
        )}
      </section>

      {/* Generated Assets */}
      {hasAssets && (
        <section className="mb-8">
          <h2 className="section-title text-xl mb-4">Generated Assets</h2>

          {/* Channel Tabs */}
          <div className="flex gap-1 mb-4 border-b border-white/[0.06] overflow-x-auto">
            {CHANNELS.filter(ch => assetsByChannel?.[ch.id]).map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveTab(channel.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px ${
                  activeTab === channel.id
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {channel.label} ({assetsByChannel[channel.id]?.length || 0})
              </button>
            ))}
          </div>

          {/* Asset Cards */}
          <div className="space-y-4">
            {assetsByChannel?.[activeTab]?.map((asset) => (
              <div key={asset.id} className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    asset.status === 'approved' ? 'text-green-400' :
                    asset.status === 'generated' ? 'text-brand-400' : 'text-gray-500'
                  }`}>
                    {asset.status}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(asset.createdAt).toLocaleString()}
                  </span>
                </div>

                <textarea
                  value={editingAssets[asset.id] || ''}
                  onChange={(e) => setEditingAssets({ ...editingAssets, [asset.id]: e.target.value })}
                  className="input-field text-sm min-h-[120px] resize-y mb-4"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveAsset(asset.id)}
                    disabled={savingAssets[asset.id]}
                    className="btn-primary text-sm py-2"
                  >
                    {savingAssets[asset.id] ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleCopyAsset(editingAssets[asset.id] || '')}
                    className="btn-secondary text-sm py-2"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => handleOpenScheduleModal(asset.id, editingAssets[asset.id] || '')}
                    className="btn-secondary text-sm py-2 text-green-400 border-green-500/20 hover:bg-green-600/10"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Campaign Metrics Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-xl">Campaign Metrics</h2>
          <button
            onClick={loadMetrics}
            disabled={loadingMetrics}
            className="btn-secondary text-sm"
          >
            {loadingMetrics ? 'Loading...' : showMetrics ? 'Refresh' : 'Load Metrics'}
          </button>
        </div>

        {showMetrics && campaignMetrics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="metric-card">
                <div className="metric-label">Total Posts</div>
                <div className="metric-value">{campaignMetrics.summary.totalPosts}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Impressions</div>
                <div className="metric-value">{campaignMetrics.summary.totalImpressions.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Engagements</div>
                <div className="metric-value">{campaignMetrics.summary.totalEngagements.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Engagement Rate</div>
                <div className="metric-value">{campaignMetrics.summary.avgEngagementRate.toFixed(2)}%</div>
              </div>
            </div>

            {campaignMetrics.posts.length > 0 && (
              <div className="glass-panel overflow-hidden">
                <div className="p-5 border-b border-white/[0.06]">
                  <h3 className="text-lg font-semibold text-white">Post Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Platform</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Content</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Posted</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Impressions</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Engagements</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignMetrics.posts.map((post) => (
                        <tr key={post.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                              post.platform === 'x' ? 'bg-sky-500/20 text-sky-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {post.platform.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3 max-w-[300px]">
                            <div className="text-sm text-gray-300 truncate">{post.content}</div>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">
                            {post.postedAt ? format(new Date(post.postedAt), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-gray-300 tabular-nums">
                            {post.metrics ? post.metrics.impressions.toLocaleString() : '-'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-gray-300 tabular-nums">
                            {post.metrics ? post.metrics.engagements.toLocaleString() : '-'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-gray-300 tabular-nums">
                            {post.metrics?.engagementRate ? `${post.metrics.engagementRate.toFixed(2)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center">
            <p className="text-gray-500 text-sm">Click &quot;Load Metrics&quot; to view campaign performance data.</p>
          </div>
        )}
      </section>

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setScheduleModalOpen(false)}
        >
          <div
            className="glass-panel p-8 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-6">Schedule Post</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Social Account</label>
                <select
                  value={selectedConnection}
                  onChange={(e) => setSelectedConnection(e.target.value)}
                  className="input-field"
                >
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.platform.toUpperCase()} - @{conn.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
                <textarea
                  value={scheduleContent}
                  onChange={(e) => setScheduleContent(e.target.value)}
                  className="input-field text-sm min-h-[120px] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Schedule For</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setScheduleModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSchedulePost}
                  disabled={scheduling || !scheduleContent.trim() || !scheduledFor}
                  className="btn-primary"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
