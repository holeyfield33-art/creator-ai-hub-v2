import {
  createMockRequest,
  createMockReply,
  testUser,
  testCampaign,
} from './helpers';

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

const mockPrismaClient = {
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaignSource: {
    create: jest.fn(),
  },
  campaignAnalysis: {
    create: jest.fn(),
  },
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  generatedAsset: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import {
  createCampaignHandler,
  listCampaignsHandler,
  getCampaignHandler,
  uploadCampaignSourceHandler,
  registerCampaignSourceHandler,
  generateAssetsHandler,
  deleteCampaignHandler,
  getJobStatusHandler,
  updateAssetHandler,
} from '../src/routes/campaigns';

function setupAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: testUser },
    error: null,
  });
}

describe('Campaign handlers - full coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== createCampaignHandler =====
  describe('createCampaignHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({ headers: {}, body: { name: 'Test' } });
      const reply = createMockReply();
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for invalid budget (negative)', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Campaign', budget: -10 },
      });
      const reply = createMockReply();
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Budget must be a non-negative number' });
    });

    it('should return 400 for invalid budget (string)', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Campaign', budget: 'invalid' },
      });
      const reply = createMockReply();
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should create campaign with valid data including budget', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'My Campaign', description: 'Desc', budget: 500 },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.create.mockResolvedValue({ ...testCampaign, budget: 500 });
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(mockPrismaClient.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'My Campaign', budget: 500 }),
      });
    });

    it('should create campaign without optional fields', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Minimal Campaign' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.create.mockResolvedValue(testCampaign);
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      const callData = mockPrismaClient.campaign.create.mock.calls[0][0].data;
      expect(callData.budget).toBeNull();
    });

    it('should return 400 for empty name', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: '   ' },
      });
      const reply = createMockReply();
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Test' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.create.mockRejectedValue(new Error('DB error'));
      await createCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== listCampaignsHandler =====
  describe('listCampaignsHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();
      await listCampaignsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return campaigns list', async () => {
      setupAuth();
      const request = createMockRequest({ headers: { authorization: 'Bearer valid-token' } });
      const reply = createMockReply();
      const campaigns = [testCampaign];
      mockPrismaClient.campaign.findMany.mockResolvedValue(campaigns);
      await listCampaignsHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalledWith(campaigns);
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({ headers: { authorization: 'Bearer valid-token' } });
      const reply = createMockReply();
      mockPrismaClient.campaign.findMany.mockRejectedValue(new Error('DB error'));
      await listCampaignsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== getCampaignHandler =====
  describe('getCampaignHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({ headers: {}, params: { id: 'c1' } });
      const reply = createMockReply();
      await getCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return campaign when found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      await getCampaignHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalledWith(testCampaign);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await getCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));
      await getCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== uploadCampaignSourceHandler =====
  describe('uploadCampaignSourceHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({
        headers: {},
        params: { id: 'c1' },
        body: { sourceType: 'text', text: 'content' },
      });
      const reply = createMockReply();
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
        body: { sourceType: 'text', text: 'content' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should upload text source and create summarize job', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'text', text: 'Hello content' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      mockPrismaClient.campaignSource.create.mockResolvedValue({ id: 's1', sourceType: 'text' });
      mockPrismaClient.job.create.mockResolvedValue({ id: 'j1', type: 'summarize', status: 'pending' });
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        source: expect.any(Object),
        job: expect.objectContaining({ id: 'j1' }),
      }));
    });

    it('should return 400 for empty text', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'text', text: '  ' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Text content is required' });
    });

    it('should return 400 for missing text', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'text' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should upload file source', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'file', fileName: 'doc.pdf', fileSize: 1024 },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      mockPrismaClient.campaignSource.create.mockResolvedValue({ id: 's2', sourceType: 'file' });
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for file source without fileName', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'file' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'File name is required' });
    });

    it('should return 400 for invalid source type', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'invalid' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid source type' });
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'text', text: 'content' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));
      await uploadCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== registerCampaignSourceHandler =====
  describe('registerCampaignSourceHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({
        headers: {},
        params: { id: 'c1' },
        body: { sourceType: 'video', sourceUrl: 'http://example.com/video.mp4' },
      });
      const reply = createMockReply();
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when sourceUrl is empty', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'video', sourceUrl: '  ' },
      });
      const reply = createMockReply();
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when sourceUrl is missing', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'video', sourceUrl: '' },
      });
      const reply = createMockReply();
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
        body: { sourceType: 'video', sourceUrl: 'http://example.com/video.mp4' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should register video source with stub analysis', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: {
          sourceType: 'video',
          sourceUrl: 'http://example.com/video.mp4',
          fileName: 'video.mp4',
          mimeType: 'video/mp4',
          size: 5000,
        },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      mockPrismaClient.campaignSource.create.mockResolvedValue({ id: 's1' });
      mockPrismaClient.campaignAnalysis.create.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.campaign.update.mockResolvedValue({ ...testCampaign, status: 'ready' });
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        source: expect.any(Object),
        analysis: expect.any(Object),
        campaign: { status: 'ready' },
      }));
      expect(mockPrismaClient.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'ready' },
      });
    });

    it('should default sourceType to video when falsy', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: {
          sourceType: '',
          sourceUrl: 'http://example.com/video.mp4',
        },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      mockPrismaClient.campaignSource.create.mockResolvedValue({ id: 's1' });
      mockPrismaClient.campaignAnalysis.create.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.campaign.update.mockResolvedValue({ ...testCampaign, status: 'ready' });
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      const sourceCreateCall = mockPrismaClient.campaignSource.create.mock.calls[0][0];
      expect(sourceCreateCall.data.sourceType).toBe('video');
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { sourceType: 'video', sourceUrl: 'http://example.com/video.mp4' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));
      await registerCampaignSourceHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== generateAssetsHandler =====
  describe('generateAssetsHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({
        headers: {},
        params: { id: 'c1' },
        body: { channels: ['twitter'] },
      });
      const reply = createMockReply();
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when channels is not array', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: 'twitter' },
      });
      const reply = createMockReply();
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when channels is null', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: null },
      });
      const reply = createMockReply();
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 with unsupported channels', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: ['tiktok'] },
      });
      const reply = createMockReply();
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
        body: { channels: ['twitter'] },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when campaign has no analysis', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: ['twitter'] },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue({ ...testCampaign, analyses: [] });
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should create jobs for valid channels', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: ['twitter', 'linkedin'] },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue({
        ...testCampaign,
        analyses: [{
          id: 'a1',
          results: { summary: 'Test', key_points: ['p1'], hooks: ['h1'] },
        }],
      });
      mockPrismaClient.job.create.mockResolvedValue({ id: 'j1', type: 'generate_asset', status: 'pending' });
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(mockPrismaClient.job.create).toHaveBeenCalledTimes(2);
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
        body: { channels: ['twitter'] },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));
      await generateAssetsHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== deleteCampaignHandler =====
  describe('deleteCampaignHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({ headers: {}, params: { id: 'c1' } });
      const reply = createMockReply();
      await deleteCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when campaign not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await deleteCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should delete campaign successfully', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
      mockPrismaClient.campaign.delete.mockResolvedValue(testCampaign);
      await deleteCampaignHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalledWith({ success: true });
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'c1' },
      });
      const reply = createMockReply();
      mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));
      await deleteCampaignHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== getJobStatusHandler =====
  describe('getJobStatusHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({ headers: {}, params: { id: 'j1' } });
      const reply = createMockReply();
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when job not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockResolvedValue(null);
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return job without payload and verify campaign ownership', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'j1' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockResolvedValue({
        id: 'j1',
        type: 'generate_asset',
        status: 'completed',
        result: { output: 'content' },
        error: null,
        payload: { campaignId: 'c1' },
        createdAt: new Date(),
        completedAt: new Date(),
      });
      mockPrismaClient.campaign.findFirst.mockResolvedValue({ id: 'c1' });
      await getJobStatusHandler(request as any, reply as any);
      // Should not include payload in response
      const sentData = (reply.send as jest.Mock).mock.calls[0][0];
      expect(sentData.payload).toBeUndefined();
      expect(sentData.id).toBe('j1');
    });

    it('should return 404 when job campaign does not belong to user', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'j1' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockResolvedValue({
        id: 'j1',
        type: 'generate_asset',
        status: 'completed',
        result: null,
        error: null,
        payload: { campaignId: 'other-campaign' },
        createdAt: new Date(),
        completedAt: null,
      });
      mockPrismaClient.campaign.findFirst.mockResolvedValue(null);
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return job when no campaignId in payload', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'j1' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockResolvedValue({
        id: 'j1',
        type: 'analysis',
        status: 'pending',
        result: null,
        error: null,
        payload: {},
        createdAt: new Date(),
        completedAt: null,
      });
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalled();
    });

    it('should return job when payload is null', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'j1' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockResolvedValue({
        id: 'j1',
        type: 'analysis',
        status: 'pending',
        result: null,
        error: null,
        payload: null,
        createdAt: new Date(),
        completedAt: null,
      });
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'j1' },
      });
      const reply = createMockReply();
      mockPrismaClient.job.findUnique.mockRejectedValue(new Error('DB error'));
      await getJobStatusHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ===== updateAssetHandler =====
  describe('updateAssetHandler', () => {
    it('should return 401 when unauthorized', async () => {
      const request = createMockRequest({
        headers: {},
        params: { id: 'a1' },
        body: { content: 'updated' },
      });
      const reply = createMockReply();
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when content is empty', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'a1' },
        body: { content: '  ' },
      });
      const reply = createMockReply();
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when content is missing', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'a1' },
        body: {},
      });
      const reply = createMockReply();
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when asset not found', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'nonexistent' },
        body: { content: 'new content' },
      });
      const reply = createMockReply();
      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue(null);
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 when asset belongs to different user', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'a1' },
        body: { content: 'new content' },
      });
      const reply = createMockReply();
      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({
        id: 'a1',
        campaign: { userId: 'different-user' },
      });
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should update asset successfully', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'a1' },
        body: { content: 'Updated content' },
      });
      const reply = createMockReply();
      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({
        id: 'a1',
        campaign: { userId: testUser.id },
      });
      mockPrismaClient.generatedAsset.update.mockResolvedValue({
        id: 'a1',
        content: 'Updated content',
        status: 'approved',
      });
      await updateAssetHandler(request as any, reply as any);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Updated content',
        status: 'approved',
      }));
    });

    it('should handle database error', async () => {
      setupAuth();
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { id: 'a1' },
        body: { content: 'content' },
      });
      const reply = createMockReply();
      mockPrismaClient.generatedAsset.findFirst.mockRejectedValue(new Error('DB error'));
      await updateAssetHandler(request as any, reply as any);
      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
