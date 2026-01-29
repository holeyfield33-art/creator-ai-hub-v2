'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getDashboardMetrics, refreshMetrics, DashboardMetrics } from '@/lib/analytics-api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { session } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [timeRange, setTimeRange] = useState('30')
  const [platformFilter, setPlatformFilter] = useState('')

  const loadMetrics = async () => {
    if (!session?.access_token) return
    try {
      setLoading(true)
      setError('')
      const data = await getDashboardMetrics(
        session.access_token,
        parseInt(timeRange),
        platformFilter || undefined
      )
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
  }, [session, timeRange, platformFilter])

  const handleRefresh = async () => {
    if (!session?.access_token) return
    try {
      setRefreshing(true)
      await refreshMetrics(session.access_token)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to refresh metrics'}`)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-6">Analytics Dashboard</h1>
        <div className="glass-panel p-6 text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-6">Analytics Dashboard</h1>
        <div className="glass-panel p-8 text-center text-gray-400">No metrics data available</div>
      </div>
    )
  }

  const { overview, platformBreakdown, dailyMetrics, topCampaigns } = metrics

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">Track performance across all channels</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="input-field w-auto"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Platforms</option>
            <option value="x">X/Twitter</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary text-sm"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="metric-card">
          <div className="metric-label">Total Posts</div>
          <div className="metric-value">{overview.totalPosts.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Impressions</div>
          <div className="metric-value">{overview.totalImpressions.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Engagements</div>
          <div className="metric-value">{overview.totalEngagements.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Engagement Rate</div>
          <div className="metric-value">{overview.avgEngagementRate.toFixed(2)}%</div>
        </div>
      </div>

      {/* Engagement Chart */}
      {dailyMetrics.length > 0 && (
        <div className="glass-panel p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Engagement Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => format(new Date(date), 'MMM d')}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a24',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#e5e7eb',
                }}
                labelFormatter={(date) => date ? format(new Date(date as string), 'PPP') : ''}
                formatter={(value) => value !== undefined ? value.toLocaleString() : ''}
              />
              <Legend />
              <Line type="monotone" dataKey="impressions" stroke="#5c7cfa" name="Impressions" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="engagements" stroke="#10b981" name="Engagements" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        {platformBreakdown.length > 0 && (
          <div className="glass-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Platform Breakdown</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="platform" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#e5e7eb',
                  }}
                  formatter={(value) => value !== undefined ? value.toLocaleString() : ''}
                />
                <Legend />
                <Bar dataKey="posts" fill="#5c7cfa" name="Posts" radius={[4, 4, 0, 0]} />
                <Bar dataKey="engagements" fill="#10b981" name="Engagements" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Campaigns */}
        {topCampaigns.length > 0 && (
          <div className="glass-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Top Campaigns</h2>
            <div className="space-y-4">
              {topCampaigns.map((campaign) => (
                <div key={campaign.id} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                  <div className="text-white font-medium mb-1">{campaign.name}</div>
                  <div className="text-sm text-gray-500">
                    {campaign.posts} posts &middot; {campaign.impressions.toLocaleString()} impressions &middot; {campaign.engagementRate.toFixed(2)}% engagement
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
