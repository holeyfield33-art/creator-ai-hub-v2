'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getDashboardMetrics, refreshMetrics, DashboardMetrics } from '@/lib/analytics-api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30');
  const [platformFilter, setPlatformFilter] = useState('');

  const loadMetrics = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const data = await getDashboardMetrics(
        token,
        parseInt(timeRange),
        platformFilter || undefined
      );
      setMetrics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [token, timeRange, platformFilter]);

  const handleRefresh = async () => {
    if (!token) return;

    try {
      setRefreshing(true);
      const result = await refreshMetrics(token);
      alert(`Triggered metrics collection for ${result.jobsCreated} posts. Refresh in a minute to see updated data.`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="text-gray-500">Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="text-gray-500">No metrics data available</div>
      </div>
    );
  }

  const { overview, platformBreakdown, dailyMetrics, topCampaigns } = metrics;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="">All Platforms</option>
            <option value="x">X/Twitter</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm mb-1">Total Posts</div>
          <div className="text-3xl font-bold">{overview.totalPosts.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm mb-1">Impressions</div>
          <div className="text-3xl font-bold">{overview.totalImpressions.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm mb-1">Engagements</div>
          <div className="text-3xl font-bold">{overview.totalEngagements.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm mb-1">Engagement Rate</div>
          <div className="text-3xl font-bold">{overview.avgEngagementRate.toFixed(2)}%</div>
        </div>
      </div>

      {/* Engagement Chart */}
      {dailyMetrics.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Engagement Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MMM d')}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) => format(new Date(date), 'PPP')}
                formatter={(value: number) => value.toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="impressions"
                stroke="#3b82f6"
                name="Impressions"
              />
              <Line
                type="monotone"
                dataKey="engagements"
                stroke="#10b981"
                name="Engagements"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Platform Breakdown */}
        {platformBreakdown.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Platform Breakdown</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Legend />
                <Bar dataKey="posts" fill="#3b82f6" name="Posts" />
                <Bar dataKey="engagements" fill="#10b981" name="Engagements" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Campaigns */}
        {topCampaigns.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Top Campaigns</h2>
            <div className="space-y-3">
              {topCampaigns.map((campaign) => (
                <div key={campaign.id} className="border-b pb-3">
                  <div className="font-medium">{campaign.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {campaign.posts} posts · {campaign.impressions.toLocaleString()} impressions · {campaign.engagementRate.toFixed(2)}% engagement
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
