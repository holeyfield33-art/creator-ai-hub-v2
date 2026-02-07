import { FastifyRequest, FastifyReply } from 'fastify'
import { ensureDbUser } from '../lib/auth'

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const dbUser = await ensureDbUser(request)
    if (!dbUser) {
      return reply.code(401).send({ error: 'Invalid token' })
    }

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
