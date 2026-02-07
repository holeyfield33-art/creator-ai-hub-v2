import {
  createMockRequest,
  createMockReply,
  mockSupabaseClient,
  mockPrismaClient,
  testUser,
  mockAuthenticatedUser,
} from './helpers';

// Mock the modules before importing handlers
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock global fetch for OAuth token exchange
const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

import {
  connectXHandler,
  xCallbackHandler,
  listConnectionsHandler,
  disconnectHandler,
  schedulePostHandler,
  listScheduledPostsHandler,
  cancelScheduledPostHandler,
} from '../src/routes/social';

describe('connectXHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.X_CLIENT_ID = 'test-client-id';
    process.env.X_CALLBACK_URL = 'http://localhost:3001/api/social/x/callback';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key';
  });

  afterEach(() => {
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CALLBACK_URL;
  });

  it('should return auth URL with PKCE challenge', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    await connectXHandler(request as any, reply as any);

    expect(reply.send).toHaveBeenCalled();
    const sendArg = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sendArg.authUrl).toBeDefined();
    expect(sendArg.authUrl).toContain('https://twitter.com/i/oauth2/authorize');
    expect(sendArg.authUrl).toContain('client_id=test-client-id');
    expect(sendArg.authUrl).toContain('code_challenge=');
    expect(sendArg.authUrl).toContain('code_challenge_method=S256');
    expect(sendArg.authUrl).toContain('state=');
  });

  it('should return 401 without authentication', async () => {
    const request = createMockRequest({ headers: {} });
    const reply = createMockReply();

    await connectXHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 401 with error message when getUserIdFromRequest throws', async () => {
    // Covers social.ts line 113 (catch branch in connectXHandler)
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Auth service down'));

    await connectXHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 500 when OAuth is not configured', async () => {
    delete process.env.X_CLIENT_ID;
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    await connectXHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'OAuth not configured' });
  });
});

describe('xCallbackHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.X_CLIENT_ID = 'test-client-id';
    process.env.X_CLIENT_SECRET = 'test-client-secret';
    process.env.X_CALLBACK_URL = 'http://localhost:3001/api/social/x/callback';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key';
  });

  it('should redirect with error on missing params', async () => {
    const request = createMockRequest({
      query: {},
    });
    const reply = createMockReply();

    await xCallbackHandler(request as any, reply as any);

    expect(reply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?error=missing_params'
    );
  });

  it('should redirect with error on invalid state', async () => {
    const request = createMockRequest({
      query: { code: 'auth-code', state: 'invalid:state:format' },
    });
    const reply = createMockReply();

    await xCallbackHandler(request as any, reply as any);

    expect(reply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?error=invalid_state'
    );
  });

  it('should redirect with error when token exchange fails', async () => {
    // First we need a valid state - we do this by calling connectXHandler to populate pkceStore
    const connectRequest = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const connectReply = createMockReply();
    mockAuthenticatedUser();

    await connectXHandler(connectRequest as any, connectReply as any);

    const authUrl = (connectReply.send as jest.Mock).mock.calls[0][0].authUrl;
    const stateParam = new URL(authUrl).searchParams.get('state')!;

    // Now use this valid state for the callback
    const callbackRequest = createMockRequest({
      query: { code: 'auth-code', state: stateParam },
    });
    const callbackReply = createMockReply();

    // Mock fetch to fail on token exchange
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    });

    await xCallbackHandler(callbackRequest as any, callbackReply as any);

    expect(callbackReply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?error=callback_failed'
    );
  });

  it('should complete full OAuth flow and redirect on success', async () => {
    // First populate pkceStore via connectXHandler
    const connectRequest = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const connectReply = createMockReply();
    mockAuthenticatedUser();

    await connectXHandler(connectRequest as any, connectReply as any);

    const authUrl = (connectReply.send as jest.Mock).mock.calls[0][0].authUrl;
    const stateParam = new URL(authUrl).searchParams.get('state')!;

    // Callback request
    const callbackRequest = createMockRequest({
      query: { code: 'auth-code', state: stateParam },
    });
    const callbackReply = createMockReply();

    // Mock token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 7200,
      }),
    });

    // Mock user info fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'twitter-user-id', username: 'testuser' },
      }),
    });

    mockPrismaClient.socialConnection.upsert.mockResolvedValue({
      id: 'conn-1',
      platform: 'x',
    });

    await xCallbackHandler(callbackRequest as any, callbackReply as any);

    expect(mockPrismaClient.socialConnection.upsert).toHaveBeenCalled();
    expect(callbackReply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?connected=true'
    );
  });

  it('should redirect with session_expired when PKCE state was already consumed', async () => {
    // Covers social.ts lines 145-146 (pkceData not found in store)
    // Create a valid state via connectXHandler
    const connectRequest = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const connectReply = createMockReply();
    mockAuthenticatedUser();
    await connectXHandler(connectRequest as any, connectReply as any);

    const authUrl = (connectReply.send as jest.Mock).mock.calls[0][0].authUrl;
    const stateParam = new URL(authUrl).searchParams.get('state')!;

    // First callback consumes the PKCE entry
    const cb1Req = createMockRequest({ query: { code: 'code1', state: stateParam } });
    const cb1Reply = createMockReply();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'uid', username: 'u' } }),
    });
    mockPrismaClient.socialConnection.upsert.mockResolvedValue({});
    await xCallbackHandler(cb1Req as any, cb1Reply as any);

    // Second callback with same state → PKCE entry already deleted
    const cb2Req = createMockRequest({ query: { code: 'code2', state: stateParam } });
    const cb2Reply = createMockReply();
    await xCallbackHandler(cb2Req as any, cb2Reply as any);

    expect(cb2Reply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?error=session_expired'
    );
  });

  it('should redirect with callback_failed when user info fetch fails', async () => {
    // Covers social.ts line 184 (throw 'Failed to get user info')
    const connectRequest = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const connectReply = createMockReply();
    mockAuthenticatedUser();
    await connectXHandler(connectRequest as any, connectReply as any);

    const authUrl = (connectReply.send as jest.Mock).mock.calls[0][0].authUrl;
    const stateParam = new URL(authUrl).searchParams.get('state')!;

    const callbackRequest = createMockRequest({
      query: { code: 'auth-code', state: stateParam },
    });
    const callbackReply = createMockReply();

    // Token exchange succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    });
    // User info fetch fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    await xCallbackHandler(callbackRequest as any, callbackReply as any);

    expect(callbackReply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/app/schedule?error=callback_failed'
    );
  });
});

describe('listConnectionsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when token is present but Supabase returns error', async () => {
    // Covers auth.ts line 18-19 (getUserIdFromRequest returns null on error)
    const request = createMockRequest({
      headers: { authorization: 'Bearer expired-token' },
    });
    const reply = createMockReply();

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Token expired' },
    });

    await listConnectionsHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return user connections', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockConnections = [
      { id: 'conn-1', platform: 'x', username: 'testuser', createdAt: new Date(), tokenExpiry: new Date() },
    ];
    mockPrismaClient.socialConnection.findMany.mockResolvedValue(mockConnections);

    await listConnectionsHandler(request as any, reply as any);

    expect(mockPrismaClient.socialConnection.findMany).toHaveBeenCalledWith({
      where: { userId: testUser.id },
      select: {
        id: true,
        platform: true,
        username: true,
        createdAt: true,
        tokenExpiry: true,
      },
    });
    expect(reply.send).toHaveBeenCalledWith({ connections: mockConnections });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({ headers: {} });
    const reply = createMockReply();

    await listConnectionsHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.socialConnection.findMany.mockRejectedValue(new Error('DB error'));

    await listConnectionsHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
  });
});

describe('disconnectHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete owned connection', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { connectionId: 'conn-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.socialConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId: testUser.id,
    });
    mockPrismaClient.socialConnection.delete.mockResolvedValue({});

    await disconnectHandler(request as any, reply as any);

    expect(mockPrismaClient.socialConnection.delete).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
    });
    expect(reply.send).toHaveBeenCalledWith({ success: true });
  });

  it('should return 404 for non-existent connection', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { connectionId: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.socialConnection.findFirst.mockResolvedValue(null);

    await disconnectHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Connection not found' });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      params: { connectionId: 'conn-1' },
    });
    const reply = createMockReply();

    await disconnectHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { connectionId: 'conn-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    mockPrismaClient.socialConnection.delete.mockRejectedValue(new Error('DB error'));

    await disconnectHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
  });
});

describe('schedulePostHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create scheduled post with valid data', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        assetId: 'asset-1',
        connectionId: 'conn-1',
        scheduledFor: '2026-03-01T12:00:00Z',
        content: 'Hello world tweet',
      },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'asset-1' });
    mockPrismaClient.socialConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      platform: 'x',
    });

    const mockPost = {
      id: 'post-1',
      status: 'pending',
      content: 'Hello world tweet',
    };
    mockPrismaClient.scheduledPost.create.mockResolvedValue(mockPost);

    await schedulePostHandler(request as any, reply as any);

    expect(mockPrismaClient.scheduledPost.create).toHaveBeenCalledWith({
      data: {
        userId: testUser.id,
        assetId: 'asset-1',
        socialConnectionId: 'conn-1',
        platform: 'x',
        content: 'Hello world tweet',
        mediaUrls: [],
        scheduledFor: new Date('2026-03-01T12:00:00Z'),
        status: 'pending',
      },
    });
    expect(reply.send).toHaveBeenCalledWith({ scheduledPost: mockPost });
  });

  it('should return 404 for non-existent asset', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        assetId: 'non-existent',
        connectionId: 'conn-1',
        scheduledFor: '2026-03-01T12:00:00Z',
        content: 'Tweet',
      },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue(null);

    await schedulePostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Asset not found' });
  });

  it('should return 404 for non-existent connection', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        assetId: 'asset-1',
        connectionId: 'non-existent',
        scheduledFor: '2026-03-01T12:00:00Z',
        content: 'Tweet',
      },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'asset-1' });
    mockPrismaClient.socialConnection.findFirst.mockResolvedValue(null);

    await schedulePostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Connection not found' });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      body: {
        assetId: 'asset-1',
        connectionId: 'conn-1',
        scheduledFor: '2026-03-01T12:00:00Z',
        content: 'Tweet',
      },
    });
    const reply = createMockReply();

    await schedulePostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 400 on database error during scheduling', async () => {
    // Covers social.ts lines 362-363 (catch branch in schedulePostHandler)
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        assetId: 'asset-1',
        connectionId: 'conn-1',
        scheduledFor: '2026-03-01T12:00:00Z',
        content: 'Tweet',
      },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.generatedAsset.findFirst.mockResolvedValue({ id: 'asset-1' });
    mockPrismaClient.socialConnection.findFirst.mockResolvedValue({ id: 'conn-1', platform: 'x' });
    mockPrismaClient.scheduledPost.create.mockRejectedValue(new Error('DB write failed'));

    await schedulePostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
  });
});

describe('listScheduledPostsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return scheduled posts with includes', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    const mockPosts = [
      {
        id: 'post-1',
        content: 'Tweet',
        asset: { id: 'asset-1', content: 'Asset content', assetType: 'twitter' },
        socialConnection: { platform: 'x', username: 'testuser' },
      },
    ];
    mockPrismaClient.scheduledPost.findMany.mockResolvedValue(mockPosts);

    await listScheduledPostsHandler(request as any, reply as any);

    expect(mockPrismaClient.scheduledPost.findMany).toHaveBeenCalledWith({
      where: { userId: testUser.id },
      include: {
        asset: { select: { id: true, content: true, assetType: true } },
        socialConnection: { select: { platform: true, username: true } },
      },
      orderBy: { scheduledFor: 'asc' },
    });
    expect(reply.send).toHaveBeenCalledWith({ posts: mockPosts });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({ headers: {} });
    const reply = createMockReply();

    await listScheduledPostsHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    // Covers social.ts lines 400-401 (catch branch)
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.scheduledPost.findMany.mockRejectedValue(new Error('DB error'));

    await listScheduledPostsHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
  });
});

describe('cancelScheduledPostHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel a pending post', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { postId: 'post-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();

    mockPrismaClient.scheduledPost.findFirst.mockResolvedValue({
      id: 'post-1',
      status: 'pending',
    });
    mockPrismaClient.scheduledPost.update.mockResolvedValue({});

    await cancelScheduledPostHandler(request as any, reply as any);

    expect(mockPrismaClient.scheduledPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { status: 'cancelled' },
    });
    expect(reply.send).toHaveBeenCalledWith({ success: true });
  });

  it('should return 404 for non-existent or already processed post', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { postId: 'non-existent' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.scheduledPost.findFirst.mockResolvedValue(null);

    await cancelScheduledPostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Post not found or already processed' });
  });

  it('should return 401 without authorization', async () => {
    const request = createMockRequest({
      headers: {},
      params: { postId: 'post-1' },
    });
    const reply = createMockReply();

    await cancelScheduledPostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
      params: { postId: 'post-1' },
    });
    const reply = createMockReply();
    mockAuthenticatedUser();
    mockPrismaClient.scheduledPost.findFirst.mockResolvedValue({ id: 'post-1' });
    mockPrismaClient.scheduledPost.update.mockRejectedValue(new Error('DB error'));

    await cancelScheduledPostHandler(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
  });
});
