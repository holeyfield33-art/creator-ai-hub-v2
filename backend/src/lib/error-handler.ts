/**
 * Error Handler - Production-ready error handling
 * Phase 14: Production Hardening
 */

import { FastifyRequest, FastifyReply, FastifyError } from 'fastify'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

/**
 * Global error handler
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the full error for debugging
  request.log.error({
    error: {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    },
    url: request.url,
    method: request.method,
  })

  // Default error response
  let statusCode = error.statusCode || 500
  let message = 'An unexpected error occurred'
  let code = error.code || 'INTERNAL_ERROR'

  // Handle specific error types
  if (error.validation) {
    statusCode = 400
    message = 'Invalid request data'
    code = 'VALIDATION_ERROR'
  } else if (error.statusCode === 404) {
    message = 'Resource not found'
    code = 'NOT_FOUND'
  } else if (error.statusCode === 401) {
    message = 'Unauthorized'
    code = 'UNAUTHORIZED'
  } else if (error.statusCode === 429) {
    message = 'Too many requests'
    code = 'RATE_LIMIT'
  } else if (statusCode >= 500) {
    // Don't expose internal errors to clients
    message = 'Internal server error'
    code = 'INTERNAL_ERROR'
  } else if (error.message) {
    // Use error message for 4xx errors
    message = error.message
  }

  // Send clean error response (no stack traces)
  reply.status(statusCode).send({
    error: {
      message,
      code,
      statusCode,
    },
  })
}

/**
 * Create a standardized error
 */
export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.code = code
  return error
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await handler(request, reply)
    } catch (error) {
      errorHandler(error as FastifyError, request, reply)
    }
  }
}
