import { FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const prisma = new PrismaClient()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In-memory store for PKCE verifiers (in production, use Redis or database)
const pkceStore = new Map<string, { verifier: string; userId: string; timestamp: number }>()

// Clean up expired PKCE entries (older than 10 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of pkceStore.entries()) {
    if (now - value.timestamp > 10 * 60 * 1000) {
      pkceStore.delete(key)
    }
  }
}, 60 * 1000) // Run every minute

// Generate cryptographically secure random string
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const randomBytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters[randomBytes[i] % characters.length]
  }
  return result
}

// Generate PKCE code verifier and challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = generateRandomString(64)
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

// Generate secure state with HMAC signature
function generateState(userId: string): string {
  const stateId = generateRandomString(32)
  const timestamp = Date.now().toString()
  const data = `${stateId}:${userId}:${timestamp}`
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}:${signature}`
}

// Verify state signature
function verifyState(state: string): { stateId: string; userId: string; timestamp: number } | null {
  const parts = state.split(':')
  if (parts.length !== 4) return null

  const [stateId, userId, timestamp, signature] = parts
  const data = `${stateId}:${userId}:${timestamp}`
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url')

  if (signature !== expectedSignature) return null

  const ts = parseInt(timestamp, 10)
  // State expires after 10 minutes
  if (Date.now() - ts > 10 * 60 * 1000) return null

  return { stateId, userId, timestamp: ts }
}

// Helper to get user from Authorization header
async function getUserFromAuth(authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }

  const token = authorization.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

// OAuth Connect - Initiate X/Twitter OAuth flow
export async function connectXHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)

    const clientId = process.env.X_CLIENT_ID
    const redirectUri = process.env.X_CALLBACK_URL

    if (!clientId || !redirectUri) {
      return reply.code(500).send({ error: 'OAuth not configured' })
    }

    // Generate secure PKCE challenge and verifier
    const { verifier, challenge } = generatePKCE()

    // Generate secure state with HMAC signature for CSRF protection
    const state = generateState(user.id)
    const stateId = state.split(':')[0]

    // Store PKCE verifier keyed by stateId
    pkceStore.set(stateId, {
      verifier,
      userId: user.id,
      timestamp: Date.now(),
    })

    // Twitter OAuth 2.0 authorization URL with proper PKCE
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=tweet.read%20tweet.write%20users.read%20offline.access&` +
      `state=${encodeURIComponent(state)}&` +
      `code_challenge=${challenge}&` +
      `code_challenge_method=S256`

    return reply.send({ authUrl })
  } catch (error: any) {
    return reply.code(401).send({ error: error.message })
  }
}

// OAuth Callback - Handle X/Twitter OAuth callback
export async function xCallbackHandler(
  request: FastifyRequest<{
    Querystring: { code: string; state: string }
  }>,
  reply: FastifyReply
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

  try {
    const { code, state } = request.query

    if (!code || !state) {
      return reply.redirect(`${frontendUrl}/app/schedule?error=missing_params`)
    }

    // Verify state signature and extract userId
    const stateData = verifyState(state)
    if (!stateData) {
      console.error('OAuth callback: Invalid or expired state')
      return reply.redirect(`${frontendUrl}/app/schedule?error=invalid_state`)
    }

    const { stateId, userId } = stateData

    // Retrieve PKCE verifier from store
    const pkceData = pkceStore.get(stateId)
    if (!pkceData || pkceData.userId !== userId) {
      console.error('OAuth callback: PKCE verifier not found or userId mismatch')
      return reply.redirect(`${frontendUrl}/app/schedule?error=session_expired`)
    }

    // Clean up the PKCE store entry
    pkceStore.delete(stateId)

    // Exchange code for access token using the stored PKCE verifier
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.X_CALLBACK_URL!,
        code_verifier: pkceData.verifier,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, refresh_token, expires_in } = tokenData

    // Get user info from X
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const userData = await userResponse.json() as any
    const { id: platformUserId, username } = userData.data

    // Calculate token expiry
    const tokenExpiry = expires_in 
      ? new Date(Date.now() + expires_in * 1000) 
      : null

    // Store or update connection
    const connection = await prisma.socialConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: 'x',
        },
      },
      update: {
        platformUserId,
        username,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        metadata: userData,
      },
      create: {
        userId,
        platform: 'x',
        platformUserId,
        username,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        metadata: userData as any,
      },
    })

    // Redirect to frontend success page
    return reply.redirect(`${frontendUrl}/app/schedule?connected=true`)
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return reply.redirect(`${frontendUrl}/app/schedule?error=callback_failed`)
  }
}

// List user's social connections
export async function listConnectionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)

    const connections = await prisma.socialConnection.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        platform: true,
        username: true,
        createdAt: true,
        tokenExpiry: true,
      },
    })

    return reply.send({ connections })
  } catch (error: any) {
    return reply.code(401).send({ error: error.message })
  }
}

// Disconnect social account
export async function disconnectHandler(
  request: FastifyRequest<{
    Params: { connectionId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)
    const { connectionId } = request.params

    // Verify connection belongs to user
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: connectionId,
        userId: user.id,
      },
    })

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' })
    }

    // Delete connection
    await prisma.socialConnection.delete({
      where: { id: connectionId },
    })

    return reply.send({ success: true })
  } catch (error: any) {
    return reply.code(401).send({ error: error.message })
  }
}

// Schedule a post
export async function schedulePostHandler(
  request: FastifyRequest<{
    Body: {
      assetId: string
      connectionId: string
      scheduledFor: string
      content: string
      mediaUrls?: string[]
    }
  }>,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)
    const { assetId, connectionId, scheduledFor, content, mediaUrls = [] } = request.body

    // Verify asset exists and belongs to user
    const asset = await prisma.generatedAsset.findFirst({
      where: {
        id: assetId,
        campaign: {
          userId: user.id,
        },
      },
    })

    if (!asset) {
      return reply.code(404).send({ error: 'Asset not found' })
    }

    // Verify connection belongs to user
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: connectionId,
        userId: user.id,
      },
    })

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' })
    }

    // Create scheduled post
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId: user.id,
        assetId,
        socialConnectionId: connectionId,
        platform: connection.platform,
        content,
        mediaUrls,
        scheduledFor: new Date(scheduledFor),
        status: 'pending',
      },
    })

    return reply.send({ scheduledPost })
  } catch (error: any) {
    console.error('Schedule post error:', error)
    return reply.code(400).send({ error: error.message })
  }
}

// List scheduled posts
export async function listScheduledPostsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)

    const posts = await prisma.scheduledPost.findMany({
      where: { userId: user.id },
      include: {
        asset: {
          select: {
            id: true,
            content: true,
            assetType: true,
          },
        },
        socialConnection: {
          select: {
            platform: true,
            username: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    })

    return reply.send({ posts })
  } catch (error: any) {
    return reply.code(401).send({ error: error.message })
  }
}

// Cancel scheduled post
export async function cancelScheduledPostHandler(
  request: FastifyRequest<{
    Params: { postId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const user = await getUserFromAuth(request.headers.authorization)
    const { postId } = request.params

    // Verify post belongs to user
    const post = await prisma.scheduledPost.findFirst({
      where: {
        id: postId,
        userId: user.id,
        status: 'pending', // Can only cancel pending posts
      },
    })

    if (!post) {
      return reply.code(404).send({ error: 'Post not found or already processed' })
    }

    // Update status to cancelled
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: { status: 'cancelled' },
    })

    return reply.send({ success: true })
  } catch (error: any) {
    return reply.code(401).send({ error: error.message })
  }
}
