import type { ErrorCode } from './error-codes.js'

export class OpenPortError extends Error {
  statusCode: number
  code: ErrorCode
  details?: Record<string, unknown>

  constructor(statusCode: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'OpenPortError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function toErrorResponse(error: unknown): { statusCode: number; payload: { ok: false; code: string; message: string; details?: Record<string, unknown> } } {
  if (error instanceof OpenPortError) {
    return {
      statusCode: error.statusCode,
      payload: {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    }
  }

  return {
    statusCode: 500,
    payload: {
      ok: false,
      code: 'common.internal_error',
      message: 'Internal server error'
    }
  }
}
