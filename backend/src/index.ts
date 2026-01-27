import Fastify from 'fastify'
import cors from '@fastify/cors'

const fastify = Fastify({
  logger: true,
})

// Register CORS with Authorization header support
fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { ok: true }
})

// Start server
const start = async () => {
  try {
    const port = 3001
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Backend server listening on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
