import { FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Store state in session/database for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
    
    // Twitter OAuth 2.0 authorization URL
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=tweet.read%20tweet.write%20users.read%20offline.access&` +
      `state=${state}&` +
      `code_challenge=challenge&` +
      `code_challenge_method=plain`

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
  try {
    const { code, state } = request.query
    
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing code or state' })
    }

    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString())
    
    // Exchange code for access token
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
        code_verifier: 'challenge',
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
    return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/schedule?connected=true`)
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/schedule?error=true`)
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
