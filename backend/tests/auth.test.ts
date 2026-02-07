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
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

import { getUserIdFromRequest, requireAuth, ensureDbUser } from '../src/lib/auth';

describe('auth.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserIdFromRequest', () => {
    it('should return null without Bearer prefix', async () => {
      const request = createMockRequest({ headers: { authorization: 'Basic token' } });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBeNull();
    });

    it('should return null without authorization header', async () => {
      const request = createMockRequest({ headers: {} });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBeNull();
    });

    it('should return userId on valid token', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      const request = createMockRequest({ headers: { authorization: 'Bearer valid' } });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBe('user-123');
    });

    it('should return null when supabase returns error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });
      const request = createMockRequest({ headers: { authorization: 'Bearer invalid' } });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBeNull();
    });

    it('should return null when supabase returns no user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const request = createMockRequest({ headers: { authorization: 'Bearer no-user' } });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBeNull();
    });

    it('should return null when supabase throws', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));
      const request = createMockRequest({ headers: { authorization: 'Bearer throws' } });
      const result = await getUserIdFromRequest(request as any);
      expect(result).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return userId when authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      const request = createMockRequest({ headers: { authorization: 'Bearer valid' } });
      const reply = createMockReply();
      const result = await requireAuth(request as any, reply as any);
      expect(result).toBe('user-123');
    });

    it('should return null and send 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();
      const result = await requireAuth(request as any, reply as any);
      expect(result).toBeNull();
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('ensureDbUser', () => {
    it('should return null without Bearer header', async () => {
      const request = createMockRequest({ headers: {} });
      const result = await ensureDbUser(request as any);
      expect(result).toBeNull();
    });

    it('should return null with non-Bearer auth', async () => {
      const request = createMockRequest({ headers: { authorization: 'Basic token' } });
      const result = await ensureDbUser(request as any);
      expect(result).toBeNull();
    });

    it('should return null when supabase returns error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid' },
      });
      const request = createMockRequest({ headers: { authorization: 'Bearer invalid' } });
      const result = await ensureDbUser(request as any);
      expect(result).toBeNull();
    });

    it('should upsert and return db user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });
      const dbUser = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
      mockPrismaClient.user.upsert.mockResolvedValue(dbUser);

      const request = createMockRequest({ headers: { authorization: 'Bearer valid' } });
      const result = await ensureDbUser(request as any);
      expect(result).toEqual(dbUser);
      expect(mockPrismaClient.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
        })
      );
    });

    it('should use email prefix as name when no user_metadata name', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-456',
            email: 'john@example.com',
            user_metadata: {},
          },
        },
        error: null,
      });
      mockPrismaClient.user.upsert.mockResolvedValue({ id: 'user-456' });

      const request = createMockRequest({ headers: { authorization: 'Bearer valid' } });
      await ensureDbUser(request as any);

      const upsertArgs = mockPrismaClient.user.upsert.mock.calls[0][0];
      expect(upsertArgs.create.name).toBe('john');
      expect(upsertArgs.update.name).toBe('john');
    });
  });
});
