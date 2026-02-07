import {
  createMockRequest,
  createMockReply,
  mockSupabaseClient,
  mockPrismaClient,
  testUser,
  testCampaign,
  mockAuthenticatedUser,
} from './helpers';

// Mock the modules before importing handlers
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import {
  listCampaignsHandler,
  getCampaignHandler,
  deleteCampaignHandler,
  uploadCampaignSourceHandler,
  registerCampaignSourceHandler,
  getJobStatusHandler,
  updateAssetHandler,
} from '../src/routes/campaigns';

describe('listCampaignsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return campaigns for authenticated user', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const campaigns = [
      { ...testCampaign, sources: [], _count: { sources: 0, analyses: 0, generatedAssets: 0 } },
    ];
    mockPrismaClient.campaign.findMany.mockResolvedValue(campaigns);

    await listCampaignsHandler(request as any, reply as any);

    expect(mockPrismaClient.campaign.findMany).toHaveBeenCalledWith({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        sources: true,
        _count: {
          select: { sources: true, analyses: true, generatedAssets: true },
        },
      },
    });
    expect(reply.send).toHaveBeenCalledWith(campaigns);
  });

  it('should return empty array for user with no campaigns', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findMany.mockResolvedValue([]);

    await listCampaignsHandler(request as any, reply as any);

    expect(reply.send).toHaveBeenCalledWith([]);
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({ headers: {} });
    const reply = createMockReply();

    await listCampaignsHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findMany.mockRejectedValue(new Error('DB error'));

    await listCampaignsHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to fetch campaigns' });
  });
});

describe('getCampaignHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return campaign with related data', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const fullCampaign = {
      ...testCampaign,
      sources: [],
      analyses: [],
      generatedAssets: [],
    };
    mockPrismaClient.campaign.findFirst.mockResolvedValue(fullCampaign);

    await getCampaignHandler(request as any, reply as any);

    expect(mockPrismaClient.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: testCampaign.id, userId: testUser.id },
      include: {
        sources: { orderBy: { createdAt: 'desc' } },
        analyses: { orderBy: { createdAt: 'desc' } },
        generatedAssets: { orderBy: { createdAt: 'desc' } },
      },
    });
    expect(reply.send).toHaveBeenCalledWith(fullCampaign);
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    await getCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Campaign not found' });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();

    await getCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));

    await getCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to fetch campaign' });
  });
});

describe('deleteCampaignHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete an owned campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
    mockPrismaClient.campaign.delete.mockResolvedValue(testCampaign);

    await deleteCampaignHandler(request as any, reply as any);

    expect(mockPrismaClient.campaign.delete).toHaveBeenCalledWith({
      where: { id: testCampaign.id },
    });
    expect(reply.send).toHaveBeenCalledWith({ success: true });
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    await deleteCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(mockPrismaClient.campaign.delete).not.toHaveBeenCalled();
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();

    await deleteCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error during delete', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
    mockPrismaClient.campaign.delete.mockRejectedValue(new Error('Cascade error'));

    await deleteCampaignHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to delete campaign' });
  });
});

describe('uploadCampaignSourceHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload text source and create summarize job', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'text', text: 'Some content to analyze' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    const mockSource = { id: 'source-1', campaignId: testCampaign.id, sourceType: 'text' };
    mockPrismaClient.campaignSource.create.mockResolvedValue(mockSource);

    const mockJob = { id: 'job-1', type: 'summarize', status: 'pending' };
    mockPrismaClient.job.create.mockResolvedValue(mockJob);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(mockPrismaClient.campaignSource.create).toHaveBeenCalledWith({
      data: {
        campaignId: testCampaign.id,
        sourceType: 'text',
        sourceText: 'Some content to analyze',
      },
    });
    expect(mockPrismaClient.job.create).toHaveBeenCalledWith({
      data: {
        type: 'summarize',
        status: 'pending',
        payload: {
          campaignId: testCampaign.id,
          sourceId: 'source-1',
          text: 'Some content to analyze',
        },
      },
    });
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({
      source: mockSource,
      job: { id: 'job-1', status: 'pending', type: 'summarize' },
    });
  });

  it('should return 400 for text source with empty text', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'text', text: '   ' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Text content is required' });
  });

  it('should upload file source with metadata', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'file', fileName: 'video.mp4', fileSize: 5000000 },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    const mockSource = { id: 'source-2', sourceType: 'file' };
    mockPrismaClient.campaignSource.create.mockResolvedValue(mockSource);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(mockPrismaClient.campaignSource.create).toHaveBeenCalledWith({
      data: {
        campaignId: testCampaign.id,
        sourceType: 'file',
        sourceUrl: 'placeholder://files/video.mp4',
        metadata: {
          fileName: 'video.mp4',
          fileSize: 5000000,
          status: 'not_implemented',
          message: 'File storage not yet implemented',
        },
      },
    });
    expect(reply.status).toHaveBeenCalledWith(201);
  });

  it('should return 400 for file source without fileName', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'file' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'File name is required' });
  });

  it('should return 400 for invalid source type', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'invalid' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid source type' });
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
      body: { sourceType: 'text', text: 'Hello' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Campaign not found' });
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'text', text: 'Content' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));

    await uploadCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

describe('registerCampaignSourceHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register source with stub analysis and update campaign status', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: {
        sourceType: 'video',
        sourceUrl: 'https://example.com/video.mp4',
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        size: 5000000,
      },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    const mockSource = { id: 'source-1', campaignId: testCampaign.id };
    mockPrismaClient.campaignSource.create.mockResolvedValue(mockSource);

    const mockAnalysis = { id: 'analysis-1', campaignId: testCampaign.id };
    mockPrismaClient.campaignAnalysis.create.mockResolvedValue(mockAnalysis);
    mockPrismaClient.campaign.update.mockResolvedValue({ ...testCampaign, status: 'ready' });

    await registerCampaignSourceHandler(request as any, reply as any);

    expect(mockPrismaClient.campaignSource.create).toHaveBeenCalled();
    expect(mockPrismaClient.campaignAnalysis.create).toHaveBeenCalled();
    expect(mockPrismaClient.campaign.update).toHaveBeenCalledWith({
      where: { id: testCampaign.id },
      data: { status: 'ready' },
    });
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({
      source: mockSource,
      analysis: mockAnalysis,
      campaign: { status: 'ready' },
    });
  });

  it('should return 400 for missing source URL', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'video', sourceUrl: '' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    await registerCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Source URL is required' });
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
      body: { sourceType: 'video', sourceUrl: 'https://example.com/v.mp4' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    await registerCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('should default sourceType to video when not provided', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceUrl: 'https://example.com/video.mp4' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);
    mockPrismaClient.campaignSource.create.mockResolvedValue({ id: 's1' });
    mockPrismaClient.campaignAnalysis.create.mockResolvedValue({ id: 'a1' });
    mockPrismaClient.campaign.update.mockResolvedValue({});

    await registerCampaignSourceHandler(request as any, reply as any);

    expect(mockPrismaClient.campaignSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceType: 'video' }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { sourceType: 'video', sourceUrl: 'https://example.com/v.mp4' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.campaign.findFirst.mockRejectedValue(new Error('DB error'));

    await registerCampaignSourceHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

describe('getJobStatusHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return job status without payload', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'job-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockJob = {
      id: 'job-1',
      type: 'summarize',
      status: 'completed',
      result: { summary: 'done' },
      error: null,
      payload: { campaignId: testCampaign.id },
      createdAt: new Date(),
      completedAt: new Date(),
    };
    mockPrismaClient.job.findUnique.mockResolvedValue(mockJob);
    mockPrismaClient.campaign.findFirst.mockResolvedValue(testCampaign);

    await getJobStatusHandler(request as any, reply as any);

    expect(reply.send).toHaveBeenCalledWith(
      expect.not.objectContaining({ payload: expect.anything() })
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1', type: 'summarize', status: 'completed' })
    );
  });

  it('should return 404 for non-existent job', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.job.findUnique.mockResolvedValue(null);

    await getJobStatusHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Job not found' });
  });

  it('should return 404 when job belongs to another users campaign', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'job-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockJob = {
      id: 'job-1',
      type: 'summarize',
      status: 'pending',
      result: null,
      error: null,
      payload: { campaignId: 'other-campaign-id' },
      createdAt: new Date(),
      completedAt: null,
    };
    mockPrismaClient.job.findUnique.mockResolvedValue(mockJob);
    mockPrismaClient.campaign.findFirst.mockResolvedValue(null); // not owned

    await getJobStatusHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Job not found' });
  });

  it('should allow access to jobs without campaignId in payload', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'job-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockJob = {
      id: 'job-1',
      type: 'processing',
      status: 'completed',
      result: {},
      error: null,
      payload: {}, // no campaignId
      createdAt: new Date(),
      completedAt: new Date(),
    };
    mockPrismaClient.job.findUnique.mockResolvedValue(mockJob);

    await getJobStatusHandler(request as any, reply as any);

    // Should not check campaign ownership
    expect(mockPrismaClient.campaign.findFirst).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'job-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.job.findUnique.mockRejectedValue(new Error('DB error'));

    await getJobStatusHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

describe('updateAssetHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update asset content and mark as approved', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'asset-1' },
      body: { content: 'Updated tweet content' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockAsset = {
      id: 'asset-1',
      campaign: { userId: testUser.id },
    };
    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue(mockAsset);

    const updatedAsset = { id: 'asset-1', content: 'Updated tweet content', status: 'approved' };
    mockPrismaClient.generatedAsset.update.mockResolvedValue(updatedAsset);

    await updateAssetHandler(request as any, reply as any);

    expect(mockPrismaClient.generatedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { content: 'Updated tweet content', status: 'approved' },
    });
    expect(reply.send).toHaveBeenCalledWith(updatedAsset);
  });

  it('should return 400 for empty content', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'asset-1' },
      body: { content: '   ' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    await updateAssetHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Content is required' });
  });

  it('should return 404 for non-existent asset', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
      body: { content: 'New content' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue(null);

    await updateAssetHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Asset not found' });
  });

  it('should return 404 when asset belongs to another user', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'asset-1' },
      body: { content: 'New content' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({
      id: 'asset-1',
      campaign: { userId: 'other-user-id' },
    });

    await updateAssetHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Asset not found' });
  });

  it('should trim whitespace from content', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'asset-1' },
      body: { content: '  trimmed content  ' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({
      id: 'asset-1',
      campaign: { userId: testUser.id },
    });
    mockPrismaClient.generatedAsset.update.mockResolvedValue({});

    await updateAssetHandler(request as any, reply as any);

    expect(mockPrismaClient.generatedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { content: 'trimmed content', status: 'approved' },
    });
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'asset-1' },
      body: { content: 'New content' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.generatedAsset.findFirst.mockRejectedValue(new Error('DB error'));

    await updateAssetHandler(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
