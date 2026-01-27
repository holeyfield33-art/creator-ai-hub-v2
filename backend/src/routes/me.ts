import { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Extract bearer token
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7)

    // Validate token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return reply.code(401).send({ error: 'Invalid token' })
    }

    // Upsert user in database
    const dbUser = await prisma.user.upsert({
      where: { email: user.email! },
      update: {
        name: user.user_metadata?.name || user.email?.split('@')[0],
      },
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        password: '', // Empty since auth is handled by Supabase
      },
    })

    // Return user data
    return reply.send({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({ error: 'Internal server error' })
  }
}
