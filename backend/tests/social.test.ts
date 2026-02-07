import { createMockRequest, createMockReply, testUser } from './helpers';

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

const mockPrismaClient = {
  socialConnection: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  scheduledPost: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  generatedAsset: {
    findFirst: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock global fetch for OAuth token exchange
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import {
  pkceStore,
  cleanExpiredPkceEntries,
  startPkceCleanupScheduler,
  generateRandomString,
  generatePKCE,
  generateState,
  verifyState,
  connectXHandler,
  xCallbackHandler,
  listConnectionsHandler,
  disconnectHandler,
  schedulePostHandler,
  listScheduledPostsHandler,
  cancelScheduledPostHandler,
} from '../src/routes/social';

describe('social.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pkceStore.clear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key';
  });

  // ===== PKCE Store Cleanup =====

  describe('cleanExpiredPkceEntries', () => {
    it('should delete entries older than 10 minutes', () => {
      const store = new Map<string, { verifier: string; userId: string; timestamp: number }>();
      const now = Date.now();
      store.set('expired', { verifier: 'v1', userId: 'u1', timestamp: now - 11 * 60 * 1000 });
      store.set('valid', { verifier: 'v2', userId: 'u2', timestamp: now - 5 * 60 * 1000 });

      const deleted = cleanExpiredPkceEntries(store, now);

      expect(deleted).toBe(1);
      expect(store.has('expired')).toBe(false);
      expect(store.has('valid')).toBe(true);
    });

    it('should return 0 when no entries are expired', () => {
      const store = new Map<string, { verifier: string; userId: string; timestamp: number }>();
      const now = Date.now();
      store.set('recent', { verifier: 'v1', userId: 'u1', timestamp: now - 1000 });

      const deleted = cleanExpiredPkceEntries(store, now);

      expect(deleted).toBe(0);
      expect(store.size).toBe(1);
    });

    it('should handle empty store', () => {
      const store = new Map<string, { verifier: string; userId: string; timestamp: number }>();
      const deleted = cleanExpiredPkceEntries(store);
      expect(deleted).toBe(0);
    });

    it('should use default pkceStore and Date.now when no arguments given', () => {
      pkceStore.set('old', { verifier: 'v', userId: 'u', timestamp: 0 });
      const deleted = cleanExpiredPkceEntries();
      expect(deleted).toBe(1);
      expect(pkceStore.size).toBe(0);
    });
  });

  // ===== Scheduler =====

  describe('startPkceCleanupScheduler', () => {
    it('should call scheduler with correct interval and return stop function', () => {
      const mockScheduler = jest.fn().mockReturnValue(42);
      const mockCancel = jest.fn();

      const { stop } = startPkceCleanupScheduler({
        intervalMs: 5000,
        scheduler: mockScheduler as any,
        cancel: mockCancel as any,
      });

      expect(mockScheduler).toHaveBeenCalledWith(expect.any(Function), 5000);

      stop();
      expect(mockCancel).toHaveBeenCalledWith(42);
    });

    it('should execute the tick function which calls cleanExpiredPkceEntries', () => {
      const mockScheduler = jest.fn().mockReturnValue(1);
      const mockCancel = jest.fn();

      // Add an expired entry to the real pkceStore
      pkceStore.set('expired-entry', { verifier: 'v', userId: 'u', timestamp: 0 });

      startPkceCleanupScheduler({
        scheduler: mockScheduler as any,
        cancel: mockCancel as any,
      });

      // Execute the tick function that was passed to the scheduler
      const tickFn = mockScheduler.mock.calls[0][0];
      tickFn();

      // The expired entry should have been cleaned up
      expect(pkceStore.has('expired-entry')).toBe(false);
    });

    it('should use default interval of 60s when no options given', () => {
      const mockScheduler = jest.fn().mockReturnValue(1);
      const mockCancel = jest.fn();

      startPkceCleanupScheduler({
        scheduler: mockScheduler as any,
        cancel: mockCancel as any,
      });

      expect(mockScheduler).toHaveBeenCalledWith(expect.any(Function), 60 * 1000);
    });
  });

  // ===== generateRandomString =====

  describe('generateRandomString', () => {
    it('should generate string of the specified length', () => {
      const result = generateRandomString(32);
      expect(result).toHaveLength(32);
    });

    it('should only contain valid PKCE characters', () => {
      const valid = /^[A-Za-z0-9\-._~]+$/;
      const result = generateRandomString(100);
      expect(result).toMatch(valid);
    });

    it('should use injected randomBytesFn when provided', () => {
      const fakeBytes = Buffer.alloc(5, 0); // All zeros → first character repeated
      const mockFn = jest.fn().mockReturnValue(fakeBytes);

      const result = generateRandomString(5, mockFn as any);

      expect(mockFn).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(5);
      // All bytes are 0, 0 % 68 = 0, which maps to 'A'
      expect(result).toBe('AAAAA');
    });

    it('should fall back to Math.random when crypto throws', () => {
      const throwingFn = () => { throw new Error('entropy exhaustion'); };
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = generateRandomString(5, throwingFn as any);

      expect(result).toHaveLength(5);
      // Math.random returns 0, floor(0 * 68) = 0, maps to 'A'
      expect(result).toBe('AAAAA');

      (Math.random as any).mockRestore();
    });
  });

  // ===== generatePKCE =====

  describe('generatePKCE', () => {
    it('should return verifier and challenge', () => {
      const { verifier, challenge } = generatePKCE();
      expect(verifier).toHaveLength(64);
      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
    });

    it('should accept a custom randomBytesFn', () => {
      const fakeBytes = Buffer.alloc(64, 65); // 'A' repeated
      const mockFn = jest.fn().mockReturnValue(fakeBytes);

      const { verifier, challenge } = generatePKCE(mockFn as any);

      expect(mockFn).toHaveBeenCalledWith(64);
      expect(verifier).toHaveLength(64);
      expect(challenge).toBeTruthy();
    });
  });

  // ===== generateState / verifyState =====

  describe('generateState and verifyState', () => {
    it('should generate a state string with 4 colon-separated parts', () => {
      const state = generateState('user-123');
      const parts = state.split(':');
      expect(parts).toHaveLength(4);
    });

    it('should verify a valid state', () => {
      const state = generateState('user-123');
      const result = verifyState(state);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
    });

    it('should return null for state with wrong number of parts', () => {
      expect(verifyState('only:two')).toBeNull();
      expect(verifyState('a:b:c:d:e')).toBeNull();
    });

    it('should return null for state with invalid signature', () => {
      const state = generateState('user-123');
      const parts = state.split(':');
      parts[3] = 'invalid-signature';
      expect(verifyState(parts.join(':'))).toBeNull();
    });

    it('should return null for expired state (older than 10 min)', () => {
      // Create a state, then manipulate time
      const state = generateState('user-123');
      const parts = state.split(':');
      // Set timestamp to 11 minutes ago
      const oldTimestamp = (Date.now() - 11 * 60 * 1000).toString();
      parts[2] = oldTimestamp;
      // Re-sign with correct HMAC
      const crypto = require('crypto');
      const data = `${parts[0]}:${parts[1]}:${oldTimestamp}`;
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
      const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      parts[3] = sig;
      expect(verifyState(parts.join(':'))).toBeNull();
    });
  });

  // ===== connectXHandler =====

  describe('connectXHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await connectXHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 500 when OAuth not configured', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      delete process.env.X_CLIENT_ID;
      delete process.env.X_CALLBACK_URL;

      await connectXHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({ error: 'OAuth not configured' });
    });

    it('should return authUrl when properly configured', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/api/social/x/callback';

      await connectXHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          authUrl: expect.stringContaining('https://twitter.com/i/oauth2/authorize'),
        })
      );
      // Verify PKCE entry was stored
      expect(pkceStore.size).toBe(1);
    });

    it('should return 401 when getUserIdFromRequest throws', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer bad-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      await connectXHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should catch errors in the try block and return 401 with message', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      // Create a reply where .send() throws to simulate an internal error
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/api/social/x/callback';

      // Make reply.send throw on the first call (the success path)
      // then work normally on the second call (the catch path)
      let callCount = 0;
      (reply.send as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Simulated reply error');
        return reply;
      });

      await connectXHandler(request as any, reply as any);

      // The catch block should call reply.code(401).send(...)
      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Simulated reply error' });
    });

    it('should return generic Unauthorized for non-Error throws', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/api/social/x/callback';

      let callCount = 0;
      (reply.send as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw 'string error'; // non-Error throw
        return reply;
      });

      await connectXHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  // ===== xCallbackHandler =====

  describe('xCallbackHandler', () => {
    it('should redirect with missing_params when code or state missing', async () => {
      const request = createMockRequest({
        query: { code: '', state: '' },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=missing_params')
      );
    });

    it('should redirect with invalid_state when state verification fails', async () => {
      const request = createMockRequest({
        query: { code: 'auth-code', state: 'invalid:state' },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=invalid_state')
      );
    });

    it('should redirect with session_expired when PKCE data not found', async () => {
      // Generate a valid state but don't store PKCE data
      const state = generateState('user-123');
      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=session_expired')
      );
    });

    it('should redirect with session_expired when PKCE userId mismatches', async () => {
      const state = generateState('user-123');
      const stateId = state.split(':')[0];
      // Store PKCE data with a different userId
      pkceStore.set(stateId, { verifier: 'test-verifier', userId: 'different-user', timestamp: Date.now() });

      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=session_expired')
      );
    });

    it('should handle full OAuth flow successfully', async () => {
      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CLIENT_SECRET = 'test-client-secret';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/callback';

      const state = generateState('user-123');
      const stateId = state.split(':')[0];
      pkceStore.set(stateId, { verifier: 'test-verifier', userId: 'user-123', timestamp: Date.now() });

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          expires_in: 7200,
        }),
      });

      // Mock user info fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'twitter-user-id', username: 'testuser' },
        }),
      });

      mockPrismaClient.socialConnection.upsert.mockResolvedValue({ id: 'conn-1' });

      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('connected=true')
      );
      expect(mockPrismaClient.socialConnection.upsert).toHaveBeenCalled();
      // PKCE entry should be cleaned up
      expect(pkceStore.has(stateId)).toBe(false);
    });

    it('should handle OAuth flow with no expires_in (tokenExpiry null)', async () => {
      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CLIENT_SECRET = 'test-client-secret';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/callback';

      const state = generateState('user-123');
      const stateId = state.split(':')[0];
      pkceStore.set(stateId, { verifier: 'test-verifier', userId: 'user-123', timestamp: Date.now() });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          expires_in: undefined,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'twitter-user-id', username: 'testuser' },
        }),
      });

      mockPrismaClient.socialConnection.upsert.mockResolvedValue({ id: 'conn-1' });

      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('connected=true')
      );
      // Check that tokenExpiry is null when expires_in is not provided
      const upsertCall = mockPrismaClient.socialConnection.upsert.mock.calls[0][0];
      expect(upsertCall.update.tokenExpiry).toBeNull();
      expect(upsertCall.create.tokenExpiry).toBeNull();
    });

    it('should redirect with callback_failed when token exchange fails', async () => {
      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CLIENT_SECRET = 'test-client-secret';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/callback';

      const state = generateState('user-123');
      const stateId = state.split(':')[0];
      pkceStore.set(stateId, { verifier: 'test-verifier', userId: 'user-123', timestamp: Date.now() });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=callback_failed')
      );
    });

    it('should redirect with callback_failed when user info fetch fails', async () => {
      process.env.X_CLIENT_ID = 'test-client-id';
      process.env.X_CLIENT_SECRET = 'test-client-secret';
      process.env.X_CALLBACK_URL = 'http://localhost:3001/callback';

      const state = generateState('user-123');
      const stateId = state.split(':')[0];
      pkceStore.set(stateId, { verifier: 'test-verifier', userId: 'user-123', timestamp: Date.now() });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', refresh_token: 'rt', expires_in: 3600 }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const request = createMockRequest({
        query: { code: 'auth-code', state },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=callback_failed')
      );
    });

    it('should use FRONTEND_URL from env for redirects', async () => {
      process.env.FRONTEND_URL = 'https://myapp.com';

      const request = createMockRequest({
        query: { code: '', state: '' },
      });
      const reply = createMockReply();

      await xCallbackHandler(request as any, reply as any);

      expect(reply.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://myapp.com')
      );

      delete process.env.FRONTEND_URL;
    });
  });

  // ===== listConnectionsHandler =====

  describe('listConnectionsHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await listConnectionsHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return connections for authenticated user', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      const mockConnections = [
        { id: 'c1', platform: 'x', username: 'user1', createdAt: new Date(), tokenExpiry: null },
      ];
      mockPrismaClient.socialConnection.findMany.mockResolvedValue(mockConnections);

      await listConnectionsHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({ connections: mockConnections });
    });

    it('should return 500 on database error', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.socialConnection.findMany.mockRejectedValue(new Error('DB error'));

      await listConnectionsHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to list connections' });
    });
  });

  // ===== disconnectHandler =====

  describe('disconnectHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {}, params: { connectionId: 'c1' } });
      const reply = createMockReply();

      await disconnectHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return 404 when connection not found', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { connectionId: 'nonexistent' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.socialConnection.findFirst.mockResolvedValue(null);

      await disconnectHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(404);
    });

    it('should delete connection successfully', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { connectionId: 'c1' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrismaClient.socialConnection.delete.mockResolvedValue({ id: 'c1' });

      await disconnectHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({ success: true });
      expect(mockPrismaClient.socialConnection.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('should return 500 on database error', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { connectionId: 'c1' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.socialConnection.findFirst.mockRejectedValue(new Error('DB error'));

      await disconnectHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(500);
    });
  });

  // ===== schedulePostHandler =====

  describe('schedulePostHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({
        headers: {},
        body: { assetId: 'a1', connectionId: 'c1', scheduledFor: '2025-01-01', content: 'test' },
      });
      const reply = createMockReply();

      await schedulePostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return 404 when asset not found', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { assetId: 'a1', connectionId: 'c1', scheduledFor: '2025-01-01', content: 'test' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue(null);

      await schedulePostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Asset not found' });
    });

    it('should return 404 when connection not found', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { assetId: 'a1', connectionId: 'c1', scheduledFor: '2025-01-01', content: 'test' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.socialConnection.findFirst.mockResolvedValue(null);

      await schedulePostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Connection not found' });
    });

    it('should create scheduled post successfully', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: {
          assetId: 'a1',
          connectionId: 'c1',
          scheduledFor: '2025-06-01T10:00:00Z',
          content: 'Check this out!',
          mediaUrls: ['http://example.com/img.png'],
        },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'c1', platform: 'x' });

      const mockPost = { id: 'post-1', status: 'pending' };
      mockPrismaClient.scheduledPost.create.mockResolvedValue(mockPost);

      await schedulePostHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({ scheduledPost: mockPost });
      expect(mockPrismaClient.scheduledPost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUser.id,
          assetId: 'a1',
          platform: 'x',
          content: 'Check this out!',
          status: 'pending',
        }),
      });
    });

    it('should use empty array for mediaUrls when not provided', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: {
          assetId: 'a1',
          connectionId: 'c1',
          scheduledFor: '2025-06-01T10:00:00Z',
          content: 'No media',
        },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'c1', platform: 'x' });
      mockPrismaClient.scheduledPost.create.mockResolvedValue({ id: 'post-1' });

      await schedulePostHandler(request as any, reply as any);

      const createCall = mockPrismaClient.scheduledPost.create.mock.calls[0][0];
      expect(createCall.data.mediaUrls).toEqual([]);
    });

    it('should return 400 on database error', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { assetId: 'a1', connectionId: 'c1', scheduledFor: '2025-01-01', content: 'test' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'c1', platform: 'x' });
      mockPrismaClient.scheduledPost.create.mockRejectedValue(new Error('DB constraint error'));

      await schedulePostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'DB constraint error' });
    });

    it('should return generic error when non-Error thrown', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        body: { assetId: 'a1', connectionId: 'c1', scheduledFor: '2025-01-01', content: 'test' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'c1', platform: 'x' });
      mockPrismaClient.scheduledPost.create.mockRejectedValue('string error');

      await schedulePostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to schedule post' });
    });
  });

  // ===== listScheduledPostsHandler =====

  describe('listScheduledPostsHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await listScheduledPostsHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return posts for authenticated user', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      const mockPosts = [{ id: 'p1', content: 'post content', status: 'pending' }];
      mockPrismaClient.scheduledPost.findMany.mockResolvedValue(mockPosts);

      await listScheduledPostsHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({ posts: mockPosts });
    });

    it('should return 500 on database error', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.scheduledPost.findMany.mockRejectedValue(new Error('DB error'));

      await listScheduledPostsHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(500);
    });
  });

  // ===== cancelScheduledPostHandler =====

  describe('cancelScheduledPostHandler', () => {
    it('should return 401 when not authenticated', async () => {
      const request = createMockRequest({ headers: {}, params: { postId: 'p1' } });
      const reply = createMockReply();

      await cancelScheduledPostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return 404 when post not found', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { postId: 'nonexistent' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.scheduledPost.findFirst.mockResolvedValue(null);

      await cancelScheduledPostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(404);
    });

    it('should cancel post successfully', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { postId: 'p1' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.scheduledPost.findFirst.mockResolvedValue({ id: 'p1', status: 'pending' });
      mockPrismaClient.scheduledPost.update.mockResolvedValue({ id: 'p1', status: 'cancelled' });

      await cancelScheduledPostHandler(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({ success: true });
      expect(mockPrismaClient.scheduledPost.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'cancelled' },
      });
    });

    it('should return 500 on database error', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        params: { postId: 'p1' },
      });
      const reply = createMockReply();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testUser },
        error: null,
      });

      mockPrismaClient.scheduledPost.findFirst.mockRejectedValue(new Error('DB error'));

      await cancelScheduledPostHandler(request as any, reply as any);

      expect(reply.code).toHaveBeenCalledWith(500);
    });
  });
});
