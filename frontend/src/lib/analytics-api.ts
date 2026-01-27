const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DashboardMetrics {
  overview: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
  };
  platformBreakdown: Array<{
    platform: string;
    posts: number;
    impressions: number;
    engagements: number;
  }>;
  dailyMetrics: Array<{
    date: string;
    impressions: number;
    engagements: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    posts: number;
    impressions: number;
    engagements: number;
    engagementRate: number;
  }>;
}

export interface CampaignMetrics {
  summary: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
  };
  posts: Array<{
    id: string;
    platform: string;
    content: string;
    postedAt: string | null;
    platformPostId: string | null;
    metrics: {
      impressions: number;
      engagements: number;
      likes: number;
      shares: number;
      comments: number;
      clicks: number;
      engagementRate: number | null;
    } | null;
  }>;
}

export async function getDashboardMetrics(
  token: string,
  days: number = 30,
  platform?: string
): Promise<DashboardMetrics> {
  const params = new URLSearchParams({ days: days.toString() });
  if (platform) params.append('platform', platform);

  const response = await fetch(`${API_URL}/api/analytics/dashboard?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch dashboard metrics');
  }

  return response.json();
}

export async function getCampaignMetrics(
  token: string,
  campaignId: string
): Promise<CampaignMetrics> {
  const response = await fetch(
    `${API_URL}/api/analytics/campaigns/${campaignId}/metrics`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch campaign metrics');
  }

  return response.json();
}

export async function refreshMetrics(token: string): Promise<{ jobsCreated: number }> {
  const response = await fetch(`${API_URL}/api/analytics/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh metrics');
  }

  return response.json();
}
