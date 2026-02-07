import { createMockRequest, createMockReply, mockSupabaseClient, mockPrismaClient, testUser } from './helpers';

// Mock the modules before importing the handler
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import { getMeHandler } from '../src/routes/me';

describe('/api/me endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user data with valid token', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    mockPrismaClient.user.upsert.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      password: '',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Act
    await getMeHandler(request as any, reply as any);

    // Assert
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(reply.send).toHaveBeenCalledWith({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
    });
  });

  it('should return 401 without authorization header', async () => {
    // Arrange
    const request = createMockRequest({
      headers: {},
    });
    const reply = createMockReply();

    // Act
    await getMeHandler(request as any, reply as any);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Missing or invalid authorization header',
    });
  });

  it('should return 401 with invalid token format', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'InvalidFormat' },
    });
    const reply = createMockReply();

    // Act
    await getMeHandler(request as any, reply as any);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Missing or invalid authorization header',
    });
  });

  it('should return 401 when Supabase returns error', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    // Act
    await getMeHandler(request as any, reply as any);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
  });

  it('should return 500 when ensureDbUser throws', async () => {
    // Arrange
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    mockPrismaClient.user.upsert.mockRejectedValue(new Error('Database crash'));

    // Act
    await getMeHandler(request as any, reply as any);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });
});
