import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from './supabase'
import prisma from './prisma'

/**
 * Extract user ID from the Authorization header by validating the
 * Supabase JWT. Returns null when the token is missing or invalid.
 */
export async function getUserIdFromRequest(request: FastifyRequest): Promise<string | null> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return null
    }
    return data.user.id
  } catch {
    return null
  }
}

/**
 * Require authentication – sends 401 and returns null when the request
 * cannot be authenticated; otherwise returns the Supabase user ID.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return userId
}

/**
 * Ensure the corresponding User row exists in our database.
 * Uses Supabase user data to upsert keyed on ID (the stable identifier).
 */
export async function ensureDbUser(request: FastifyRequest) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return null
  }

  const supabaseUser = data.user

  const dbUser = await prisma.user.upsert({
    where: { id: supabaseUser.id },
    update: {
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
    },
    create: {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
      password: '',
    },
  })

  return dbUser
}
