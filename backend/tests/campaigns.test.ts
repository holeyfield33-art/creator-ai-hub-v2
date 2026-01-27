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
  },
};

// Mock the modules
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import { createCampaignHandler } from '../src/routes/campaigns';

describe('Campaign creation endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create campaign with valid data', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        name: 'New Campaign',
        description: 'Campaign description',
        budget: 1000,
      },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    mockPrismaClient.campaign.create.mockResolvedValue({
      ...testCampaign,
      name: 'New Campaign',
      description: 'Campaign description',
      budget: 1000,
    });

    // Act
    await createCampaignHandler(request as any, reply as any);

    // Assert
    expect(mockPrismaClient.campaign.create).toHaveBeenCalledWith({
      data: {
        name: 'New Campaign',
        description: 'Campaign description',
        budget: 1000,
        userId: testUser.id,
        status: 'draft',
      },
    });
    expect(reply.send).toHaveBeenCalled();
  });

  it('should return 401 without authorization', async () => {
    // Arrange
    const request = createMockRequest({
      headers: {},
      body: { name: 'Test Campaign' },
    });
    const reply = createMockReply();

    // Act
    await createCampaignHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(mockPrismaClient.campaign.create).not.toHaveBeenCalled();
  });

  it('should return 400 with missing name', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: { description: 'No name provided' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    // Act
    await createCampaignHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(mockPrismaClient.campaign.create).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: { name: 'Test Campaign' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    mockPrismaClient.campaign.create.mockRejectedValue(
      new Error('Database error')
    );

    // Act
    await createCampaignHandler(request as any, reply as any);

    // Assert
    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
