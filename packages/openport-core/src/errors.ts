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

function isOpenPortLikeError(error: unknown): error is OpenPortError {
  if (error instanceof OpenPortError) return true
  if (!error || typeof error !== 'object') return false
  const row = error as {
    name?: unknown
    statusCode?: unknown
    code?: unknown
    message?: unknown
    details?: unknown
  }
  return row.name === 'OpenPortError' &&
    Number.isInteger(row.statusCode) &&
    Number(row.statusCode) >= 400 &&
    Number(row.statusCode) <= 599 &&
    typeof row.code === 'string' &&
    /^[a-z][a-z0-9_.-]{1,199}$/.test(row.code) &&
    typeof row.message === 'string' &&
    (row.details === undefined || (
      row.details !== null && typeof row.details === 'object' && !Array.isArray(row.details)
    ))
}

export function toErrorResponse(error: unknown): { statusCode: number; payload: { ok: false; code: string; message: string; details?: Record<string, unknown> } } {
  if (isOpenPortLikeError(error)) {
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
