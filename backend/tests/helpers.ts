import { jest } from '@jest/globals';

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn() as any,
  },
};

// Mock Prisma client
export const mockPrismaClient = {
  user: {
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    upsert: jest.fn() as any,
  },
  campaign: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    findFirst: jest.fn() as any,
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
    delete: jest.fn() as any,
  },
  campaignSource: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
  },
  campaignAnalysis: {
    create: jest.fn() as any,
    findFirst: jest.fn() as any,
  },
  generatedAsset: {
    findFirst: jest.fn() as any,
    findMany: jest.fn() as any,
    update: jest.fn() as any,
  },
  socialConnection: {
    findMany: jest.fn() as any,
    findFirst: jest.fn() as any,
    upsert: jest.fn() as any,
    delete: jest.fn() as any,
  },
  scheduledPost: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    findFirst: jest.fn() as any,
    update: jest.fn() as any,
  },
  postMetric: {
    create: jest.fn() as any,
  },
  job: {
    create: jest.fn() as any,
    findUnique: jest.fn() as any,
    findFirst: jest.fn() as any,
  },
};

// Mock AI Provider
export const mockAIProvider = {
  complete: jest.fn() as any,
};

// Test user data
export const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

// Test DB user data (as returned by ensureDbUser / prisma.user.upsert)
export const testDbUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  password: '',
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test campaign data
export const testCampaign = {
  id: 'test-campaign-id',
  name: 'Test Campaign',
  description: 'Test Description',
  status: 'draft',
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper to create mock request
export function createMockRequest(options: {
  headers?: Record<string, string>;
  body?: any;
  params?: any;
  query?: any;
}) {
  return {
    headers: options.headers || {},
    body: options.body,
    params: options.params,
    query: options.query,
    log: {
      error: jest.fn() as any,
      info: jest.fn() as any,
      warn: jest.fn() as any,
    },
  };
}

// Helper to create mock reply
export function createMockReply() {
  const reply = {
    code: jest.fn().mockReturnThis() as any,
    send: jest.fn().mockReturnThis() as any,
    status: jest.fn().mockReturnThis() as any,
    redirect: jest.fn().mockReturnThis() as any,
  };
  return reply;
}

// Helper to set up authenticated request mock
export function mockAuthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: testUser },
    error: null,
  });
}

// Helper to set up ensureDbUser mock (for analytics routes)
export function mockAuthenticatedDbUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { ...testUser, user_metadata: { name: testUser.name } } },
    error: null,
  });
  mockPrismaClient.user.upsert.mockResolvedValue(testDbUser);
}
