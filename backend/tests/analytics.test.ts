import { createMockRequest, createMockReply, testUser } from './helpers';

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

const mockPrismaClient = {
  user: {
    upsert: jest.fn(),
  },
  scheduledPost: {
    findMany: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  generatedAsset: {
    findMany: jest.fn(),
  },
  job: {
    create: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import Fastify from 'fastify';
import { analyticsRoutes } from '../src/routes/analytics';

function createApp() {
  const app = Fastify();
  app.register(analyticsRoutes);
  return app;
}

// Helper to setup auth to return a valid user
function setupAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: testUser },
    error: null,
  });
  mockPrismaClient.user.upsert.mockResolvedValue({
    id: testUser.id,
    email: testUser.email,
    name: testUser.name,
  });
}

describe('analyticsRoutes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // ===== GET /api/analytics/dashboard =====

  describe('GET /api/analytics/dashboard', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
        headers: { authorization: 'Bearer invalid' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 without auth header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return dashboard metrics for authenticated user with no posts', async () => {
      setupAuth();
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([]);
      mockPrismaClient.campaign.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.overview.totalPosts).toBe(0);
      expect(body.overview.avgEngagementRate).toBe(0);
      expect(body.platformBreakdown).toEqual([]);
      expect(body.dailyMetrics).toEqual([]);
      expect(body.topCampaigns).toEqual([]);
    });

    it('should calculate metrics from posted posts', async () => {
      setupAuth();

      const mockPosts = [
        {
          id: 'p1',
          platform: 'x',
          postedAt: new Date('2025-01-15'),
          metrics: [
            { impressions: 1000, engagements: 50, likes: 30, shares: 10, comments: 10 },
          ],
        },
        {
          id: 'p2',
          platform: 'x',
          postedAt: new Date('2025-01-16'),
          metrics: [
            { impressions: 2000, engagements: 100, likes: 60, shares: 20, comments: 20 },
          ],
        },
        {
          id: 'p3',
          platform: 'linkedin',
          postedAt: new Date('2025-01-15'),
          metrics: [
            { impressions: 500, engagements: 25, likes: 15, shares: 5, comments: 5 },
          ],
        },
      ];
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue(mockPosts);
      mockPrismaClient.campaign.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.overview.totalPosts).toBe(3);
      expect(body.overview.totalImpressions).toBe(3500);
      expect(body.overview.totalEngagements).toBe(175);
      expect(body.overview.totalLikes).toBe(105);
      expect(body.overview.totalShares).toBe(35);
      expect(body.overview.totalComments).toBe(35);
      expect(body.overview.avgEngagementRate).toBe(5);

      // Platform breakdown
      expect(body.platformBreakdown).toHaveLength(2);

      // Daily metrics (sorted by date)
      expect(body.dailyMetrics.length).toBeGreaterThan(0);
    });

    it('should respect days query parameter', async () => {
      setupAuth();
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([]);
      mockPrismaClient.campaign.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard?days=7',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should respect platform query parameter', async () => {
      setupAuth();
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([]);
      mockPrismaClient.campaign.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard?platform=x',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should calculate top campaigns with metrics', async () => {
      setupAuth();
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([]);

      const mockCampaigns = [
        {
          id: 'camp-1',
          name: 'Campaign A',
          generatedAssets: [
            {
              scheduledPosts: [
                {
                  metrics: [
                    { impressions: 1000, engagements: 100 },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'camp-2',
          name: 'Campaign B',
          generatedAssets: [
            {
              scheduledPosts: [
                {
                  metrics: [
                    { impressions: 2000, engagements: 300 },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'camp-3',
          name: 'Campaign C (no posts)',
          generatedAssets: [],
        },
      ];
      mockPrismaClient.campaign.findMany.mockResolvedValue(mockCampaigns);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
        headers: { authorization: 'Bearer valid-token' },
      });

      const body = JSON.parse(res.body);
      // Campaign C has no posts, should be filtered out
      expect(body.topCampaigns).toHaveLength(2);
      // Sorted by engagements desc
      expect(body.topCampaigns[0].name).toBe('Campaign B');
    });
  });

  // ===== GET /api/analytics/campaigns/:id/metrics =====

  describe('GET /api/analytics/campaigns/:id/metrics', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/campaigns/camp-1/metrics',
        headers: { authorization: 'Bearer invalid' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/campaigns/nonexistent/metrics',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return campaign metrics with no posts', async () => {
      setupAuth();
      mockPrismaClient.campaign.findFirst.mockResolvedValue({ id: 'camp-1', userId: testUser.id });
      mockPrismaClient.generatedAsset.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/campaigns/camp-1/metrics',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalPosts).toBe(0);
      expect(body.summary.avgEngagementRate).toBe(0);
    });

    it('should return campaign metrics with posts and metrics', async () => {
      setupAuth();
      mockPrismaClient.campaign.findFirst.mockResolvedValue({ id: 'camp-1', userId: testUser.id });
      mockPrismaClient.generatedAsset.findMany.mockResolvedValue([
        {
          scheduledPosts: [
            {
              id: 'sp1',
              platform: 'x',
              content: 'Short post content',
              postedAt: new Date('2025-01-15'),
              platformPostId: 'tw-123',
              metrics: [
                { impressions: 500, engagements: 25, likes: 15, shares: 5, comments: 5 },
              ],
            },
            {
              id: 'sp2',
              platform: 'linkedin',
              content: 'A'.repeat(200), // long content, should be truncated
              postedAt: new Date('2025-01-16'),
              platformPostId: 'li-456',
              metrics: [], // No metrics
            },
          ],
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/campaigns/camp-1/metrics',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalPosts).toBe(2);
      expect(body.summary.totalImpressions).toBe(500);
      // Posts sorted by engagements desc
      expect(body.posts[0].id).toBe('sp1');
      // Long content should be truncated with ...
      const longPost = body.posts.find((p: any) => p.id === 'sp2');
      expect(longPost.content.length).toBeLessThanOrEqual(103); // 100 + '...'
      // Post without metrics should have null
      expect(longPost.metrics).toBeNull();
    });
  });

  // ===== POST /api/analytics/refresh =====

  describe('POST /api/analytics/refresh', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/refresh',
        headers: { authorization: 'Bearer invalid' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should trigger metrics collection for posts needing refresh', async () => {
      setupAuth();

      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
        {
          id: 'sp1',
          metrics: [{ fetchedAt: twoHoursAgo }], // stale metrics
        },
        {
          id: 'sp2',
          metrics: [], // no metrics at all
        },
        {
          id: 'sp3',
          metrics: [{ fetchedAt: new Date() }], // recent metrics
        },
      ]);

      mockPrismaClient.job.create.mockResolvedValue({ id: 'job-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/refresh',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // sp1 (stale) + sp2 (no metrics) need refresh, sp3 is recent
      expect(body.jobsCreated).toBe(2);
      expect(mockPrismaClient.job.create).toHaveBeenCalledTimes(2);
    });

    it('should return 0 jobs when all metrics are fresh', async () => {
      setupAuth();

      mockPrismaClient.scheduledPost.findMany.mockResolvedValue([
        {
          id: 'sp1',
          metrics: [{ fetchedAt: new Date() }],
        },
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/refresh',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.jobsCreated).toBe(0);
    });
  });
});
