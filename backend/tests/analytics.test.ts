import {
  createMockRequest,
  createMockReply,
  mockSupabaseClient,
  mockPrismaClient,
  testUser,
  testDbUser,
  testCampaign,
  mockAuthenticatedDbUser,
} from './helpers';

// Mock the modules before importing handlers
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import { analyticsRoutes } from '../src/routes/analytics';

// We need to extract the route handlers from the Fastify plugin.
// analyticsRoutes registers routes on a fastify instance, so we capture them.
let dashboardHandler: any;
let campaignMetricsHandler: any;
let refreshHandler: any;

const mockFastify = {
  get: jest.fn((path: string, handler: any) => {
    if (path === '/api/analytics/dashboard') {
      dashboardHandler = handler;
    } else if (path === '/api/analytics/campaigns/:id/metrics') {
      campaignMetricsHandler = handler;
    }
  }),
  post: jest.fn((path: string, handler: any) => {
    if (path === '/api/analytics/refresh') {
      refreshHandler = handler;
    }
  }),
};

// Register routes to capture handlers
beforeAll(async () => {
  await analyticsRoutes(mockFastify as any);
});

describe('GET /api/analytics/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return aggregated metrics for user', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      query: { days: '30' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    const postedAt = new Date('2026-01-15T10:00:00Z');

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        platform: 'x',
        postedAt,
        metrics: [
          { impressions: 1000, engagements: 50, likes: 30, shares: 10, comments: 10 },
        ],
      },
      {
        id: 'post-2',
        platform: 'linkedin',
        postedAt,
        metrics: [
          { impressions: 500, engagements: 25, likes: 15, shares: 5, comments: 5 },
        ],
      },
    ]);

    mockPrismaClient.campaign.findMany.mockResolvedValue([]);

    await dashboardHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.overview.totalPosts).toBe(2);
    expect(sentData.overview.totalImpressions).toBe(1500);
    expect(sentData.overview.totalEngagements).toBe(75);
    expect(sentData.overview.totalLikes).toBe(45);
    expect(sentData.overview.totalShares).toBe(15);
    expect(sentData.overview.totalComments).toBe(15);
    expect(sentData.overview.avgEngagementRate).toBe(5);
  });

  it('should return zeros when no posts exist', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      query: {},
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([]);
    mockPrismaClient.campaign.findMany.mockResolvedValue([]);

    await dashboardHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.overview.totalPosts).toBe(0);
    expect(sentData.overview.totalImpressions).toBe(0);
    expect(sentData.overview.avgEngagementRate).toBe(0);
    expect(sentData.platformBreakdown).toEqual([]);
    expect(sentData.dailyMetrics).toEqual([]);
  });

  it('should compute platform breakdown correctly', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      query: { days: '7' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        platform: 'x',
        postedAt: new Date(),
        metrics: [{ impressions: 200, engagements: 20, likes: 10, shares: 5, comments: 5 }],
      },
      {
        id: 'post-2',
        platform: 'x',
        postedAt: new Date(),
        metrics: [{ impressions: 300, engagements: 30, likes: 20, shares: 5, comments: 5 }],
      },
    ]);
    mockPrismaClient.campaign.findMany.mockResolvedValue([]);

    await dashboardHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.platformBreakdown).toHaveLength(1);
    expect(sentData.platformBreakdown[0]).toEqual({
      platform: 'x',
      posts: 2,
      impressions: 500,
      engagements: 50,
    });
  });

  it('should return daily metrics sorted by date', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      query: { days: '30' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        platform: 'x',
        postedAt: new Date('2026-01-20T10:00:00Z'),
        metrics: [{ impressions: 100, engagements: 10, likes: 5, shares: 3, comments: 2 }],
      },
      {
        id: 'post-2',
        platform: 'x',
        postedAt: new Date('2026-01-15T10:00:00Z'),
        metrics: [{ impressions: 200, engagements: 20, likes: 10, shares: 5, comments: 5 }],
      },
    ]);
    mockPrismaClient.campaign.findMany.mockResolvedValue([]);

    await dashboardHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.dailyMetrics.length).toBe(2);
    // Should be sorted ascending
    expect(sentData.dailyMetrics[0].date).toBe('2026-01-15');
    expect(sentData.dailyMetrics[1].date).toBe('2026-01-20');
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      query: {},
    });
    const reply = createMockReply();

    await dashboardHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });
});

describe('GET /api/analytics/campaigns/:id/metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return campaign-specific metrics', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    mockPrismaClient.generatedAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        scheduledPosts: [
          {
            id: 'post-1',
            platform: 'x',
            content: 'A short tweet about marketing.',
            postedAt: new Date(),
            platformPostId: 'twt-123',
            metrics: [
              { impressions: 1000, engagements: 100, likes: 60, shares: 20, comments: 20 },
            ],
          },
        ],
      },
    ]);

    await campaignMetricsHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.summary.totalPosts).toBe(1);
    expect(sentData.summary.totalImpressions).toBe(1000);
    expect(sentData.summary.totalEngagements).toBe(100);
    expect(sentData.summary.avgEngagementRate).toBe(10);
    expect(sentData.posts).toHaveLength(1);
  });

  it('should truncate long post content to 100 chars', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    const longContent = 'x'.repeat(200);
    mockPrismaClient.generatedAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        scheduledPosts: [
          {
            id: 'post-1',
            platform: 'x',
            content: longContent,
            postedAt: new Date(),
            platformPostId: 'twt-123',
            metrics: [{ impressions: 0, engagements: 0, likes: 0, shares: 0, comments: 0 }],
          },
        ],
      },
    ]);

    await campaignMetricsHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.posts[0].content.length).toBe(103); // 100 + '...'
    expect(sentData.posts[0].content.endsWith('...')).toBe(true);
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    await campaignMetricsHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Campaign not found' });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();

    await campaignMetricsHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('should sort posts by engagement descending', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    mockPrismaClient.generatedAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        scheduledPosts: [
          {
            id: 'post-low',
            platform: 'x',
            content: 'Low engagement',
            postedAt: new Date(),
            platformPostId: 'twt-1',
            metrics: [{ impressions: 100, engagements: 5, likes: 3, shares: 1, comments: 1 }],
          },
          {
            id: 'post-high',
            platform: 'x',
            content: 'High engagement',
            postedAt: new Date(),
            platformPostId: 'twt-2',
            metrics: [{ impressions: 100, engagements: 50, likes: 30, shares: 10, comments: 10 }],
          },
        ],
      },
    ]);

    await campaignMetricsHandler(request as any, reply as any);

    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.posts[0].id).toBe('post-high');
    expect(sentData.posts[1].id).toBe('post-low');
  });
});

describe('POST /api/analytics/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create jobs for posts needing metrics', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        metrics: [{ fetchedAt: twoHoursAgo }], // stale metric
      },
      {
        id: 'post-2',
        metrics: [], // no metrics at all
      },
    ]);

    mockPrismaClient.job.create.mockResolvedValue({ id: 'job-1' });

    await refreshHandler(request as any, reply as any);

    expect(mockPrismaClient.job.create).toHaveBeenCalledTimes(2);
    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.jobsCreated).toBe(2);
  });

  it('should skip posts with recent metrics', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedDbUser();

    mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        metrics: [{ fetchedAt: new Date() }], // fresh metric
      },
    ]);

    await refreshHandler(request as any, reply as any);

    expect(mockPrismaClient.job.create).not.toHaveBeenCalled();
    const sentData = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sentData.jobsCreated).toBe(0);
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({ headers: {} });
    const reply = createMockReply();

    await refreshHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });
});
