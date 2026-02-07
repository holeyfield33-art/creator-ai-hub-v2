import {
  fetchTwitterMetrics,
  fetchLinkedInMetrics,
  fetchMetricsFromPlatform,
  calculateEngagementRate,
} from '../src/lib/social-metrics';

describe('social-metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTwitterMetrics', () => {
    it('should return metrics data with expected shape', async () => {
      const metrics = await fetchTwitterMetrics('post-123', 'token-abc');
      expect(metrics).toEqual(
        expect.objectContaining({
          impressions: expect.any(Number),
          engagements: expect.any(Number),
          likes: expect.any(Number),
          shares: expect.any(Number),
          comments: expect.any(Number),
          clicks: expect.any(Number),
        })
      );
    });

    it('should return positive metric values', async () => {
      const metrics = await fetchTwitterMetrics('post-1', 'token-1');
      expect(metrics.impressions).toBeGreaterThan(0);
      expect(metrics.engagements).toBeGreaterThan(0);
      expect(metrics.likes).toBeGreaterThan(0);
      expect(metrics.shares).toBeGreaterThan(0);
      expect(metrics.comments).toBeGreaterThan(0);
      expect(metrics.clicks).toBeGreaterThan(0);
    });
  });

  describe('fetchLinkedInMetrics', () => {
    it('should return metrics data with expected shape', async () => {
      const metrics = await fetchLinkedInMetrics('post-456', 'token-def');
      expect(metrics).toEqual(
        expect.objectContaining({
          impressions: expect.any(Number),
          engagements: expect.any(Number),
          likes: expect.any(Number),
          shares: expect.any(Number),
          comments: expect.any(Number),
          clicks: expect.any(Number),
        })
      );
    });

    it('should return positive metric values', async () => {
      const metrics = await fetchLinkedInMetrics('post-1', 'token-1');
      expect(metrics.impressions).toBeGreaterThan(0);
      expect(metrics.likes).toBeGreaterThan(0);
    });
  });

  describe('fetchMetricsFromPlatform', () => {
    it('should route "x" to Twitter metrics', async () => {
      const metrics = await fetchMetricsFromPlatform('x', 'post-1', 'token-1');
      expect(metrics).toBeDefined();
      expect(metrics.impressions).toBeGreaterThan(0);
    });

    it('should route "twitter" to Twitter metrics', async () => {
      const metrics = await fetchMetricsFromPlatform('twitter', 'post-1', 'token-1');
      expect(metrics).toBeDefined();
    });

    it('should route "linkedin" to LinkedIn metrics', async () => {
      const metrics = await fetchMetricsFromPlatform('linkedin', 'post-1', 'token-1');
      expect(metrics).toBeDefined();
    });

    it('should be case-insensitive', async () => {
      const metrics = await fetchMetricsFromPlatform('LinkedIn', 'post-1', 'token-1');
      expect(metrics).toBeDefined();
    });

    it('should throw for unsupported platform', async () => {
      await expect(
        fetchMetricsFromPlatform('tiktok', 'post-1', 'token-1')
      ).rejects.toThrow('Unsupported platform: tiktok');
    });
  });

  describe('calculateEngagementRate', () => {
    it('should calculate engagement rate correctly', () => {
      const rate = calculateEngagementRate({
        impressions: 1000,
        engagements: 50,
        likes: 30,
        shares: 10,
        comments: 10,
        clicks: 20,
      });
      expect(rate).toBe(5);
    });

    it('should return 0 when impressions is 0', () => {
      const rate = calculateEngagementRate({
        impressions: 0,
        engagements: 50,
        likes: 30,
        shares: 10,
        comments: 10,
        clicks: 20,
      });
      expect(rate).toBe(0);
    });

    it('should handle high engagement rates', () => {
      const rate = calculateEngagementRate({
        impressions: 10,
        engagements: 10,
        likes: 5,
        shares: 3,
        comments: 2,
        clicks: 8,
      });
      expect(rate).toBe(100);
    });
  });
});
