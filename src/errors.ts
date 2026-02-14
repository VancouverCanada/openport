import type { ErrorCode } from './error-codes.js'
import { ZodError } from 'zod'

export class OpenMCPError extends Error {
  statusCode: number
  code: ErrorCode
  details?: Record<string, unknown>

  constructor(statusCode: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'OpenMCPError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function toErrorResponse(error: unknown): { statusCode: number; payload: { ok: false; code: string; message: string; details?: Record<string, unknown> } } {
  if (error instanceof OpenMCPError) {
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

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: 'common.validation',
        message: 'Validation failed',
        details: {
          issues: error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message
          }))
        }
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
