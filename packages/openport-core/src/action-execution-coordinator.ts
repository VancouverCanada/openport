import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'

export type ActionExecutionCoordinationInput = {
  scopeKey: string
  requestFingerprint: string
}

export type ActionExecutionCoordinationResult<T> = {
  value: T
  replayed: boolean
}

export type ActionExecutionCoordinator = {
  coordinate: <T>(
    input: ActionExecutionCoordinationInput,
    execute: () => Promise<T>
  ) => Promise<ActionExecutionCoordinationResult<T>>
}

type InFlightExecution = {
  requestFingerprint: string
  promise: Promise<unknown>
}

/**
 * Serializes retry-equivalent executions inside one runtime process.
 *
 * This closes the process-local check-then-effect race. It is deliberately not
 * described as crash-safe or distributed: callers needing those properties
 * must supply a durable coordinator whose contract extends this interface.
 */
export class ProcessLocalActionExecutionCoordinator implements ActionExecutionCoordinator {
  private readonly inFlight = new Map<string, InFlightExecution>()

  async coordinate<T>(
    input: ActionExecutionCoordinationInput,
    execute: () => Promise<T>
  ): Promise<ActionExecutionCoordinationResult<T>> {
    const existing = this.inFlight.get(input.scopeKey)
    if (existing) {
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new OpenPortError(
          409,
          ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
          'Idempotency key is already bound to a different action payload'
        )
      }
      return {
        value: await existing.promise as T,
        replayed: true
      }
    }

    const promise = execute()
    this.inFlight.set(input.scopeKey, {
      requestFingerprint: input.requestFingerprint,
      promise
    })
    try {
      return { value: await promise, replayed: false }
    } finally {
      const current = this.inFlight.get(input.scopeKey)
      if (current?.promise === promise) this.inFlight.delete(input.scopeKey)
    }
  }
}
