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
    findFirst: jest.fn(),
  },
  campaignSource: {
    findMany: jest.fn(),
  },
  campaignAnalysis: {
    findFirst: jest.fn(),
  },
  job: {
    create: jest.fn(),
  },
};

// Mock the modules
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import { generateAssetsHandler } from '../src/routes/campaigns';

describe('Generate assets endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create jobs for asset generation', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: {
        channels: ['twitter', 'linkedin'],
      },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    const campaignWithAnalysis = {
      ...testCampaign,
      analyses: [
        {
          id: 'analysis-1',
          campaignId: testCampaign.id,
          analysisType: 'content_summary',
          results: {
            summary: 'Test summary',
            key_points: ['Point 1', 'Point 2'],
            hooks: ['Hook 1'],
          },
        },
      ],
    };

    mockPrismaClient.campaign.findFirst.mockResolvedValue(campaignWithAnalysis);

    mockPrismaClient.job.create.mockResolvedValue({
      id: 'job-1',
      type: 'generate_asset',
      status: 'pending',
    });

    // Act
    await generateAssetsHandler(request as any, reply as any);

    // Assert
    expect(mockPrismaClient.campaign.findFirst).toHaveBeenCalledWith({
      where: {
        id: testCampaign.id,
        userId: testUser.id,
      },
      include: {
        analyses: {
          where: { analysisType: 'content_summary' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    expect(mockPrismaClient.job.create).toHaveBeenCalledTimes(2); // 2 channels
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({
      message: 'Created 2 asset generation job(s)',
      jobs: expect.any(Array),
    });
  });

  it('should return 404 for non-existent campaign', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: 'non-existent' },
      body: { channels: ['twitter'] },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    mockPrismaClient.campaign.findFirst.mockResolvedValue(null);

    // Act
    await generateAssetsHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('should return 400 with no channels', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { channels: [] },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    // Act
    await generateAssetsHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 when no analysis exists', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { id: testCampaign.id },
      body: { channels: ['twitter'] },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    const campaignWithoutAnalysis = {
      ...testCampaign,
      analyses: [],
    };

    mockPrismaClient.campaign.findFirst.mockResolvedValue(campaignWithoutAnalysis);

    // Act
    await generateAssetsHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Campaign must be analyzed first (upload text)',
    });
  });
});
