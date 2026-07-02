import { ZodError } from 'zod'
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

function isZodLikeError(error: unknown): error is { issues: Array<{ code: string; path: Array<string | number>; message: string }> } {
  if (error instanceof ZodError) return true
  if (!error || typeof error !== 'object') return false
  const issues = (error as { issues?: unknown }).issues
  return Array.isArray(issues) && issues.every((issue) => {
    if (!issue || typeof issue !== 'object') return false
    const row = issue as { code?: unknown; path?: unknown; message?: unknown }
    return typeof row.code === 'string' && Array.isArray(row.path) && typeof row.message === 'string'
  })
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

  if (isZodLikeError(error)) {
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
