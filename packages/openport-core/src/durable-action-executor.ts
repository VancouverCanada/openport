import crypto from 'node:crypto'
import type {
  DurableActionObligation,
  SqliteDurableActionStore
} from './adapters/sqlite-durable-action-store.js'
import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { base64Url, jcs, randomId, sha256JcsHex } from './utils.js'

export type DurableEffectContext = {
  obligationId: string
  effectId: string
  requestFingerprint: string
  actionType: string
  attempt: number
  reclaimed: boolean
}

export type DurableEffectReceiptLookupInput = {
  obligationId: string
  effectId: string
  requestFingerprint: string
  actionType: string
}

export type DurableEffectReceipt = {
  obligationId?: string
  effectId: string
  requestFingerprint: string
  actionType: string
  resultDigest: string
  result: Record<string, unknown>
  authentication?: {
    algorithm: string
    keyId: string
    signature: string
  }
}

export type DurableEffectReceiptLookup = (
  input: DurableEffectReceiptLookupInput
) => Promise<DurableEffectReceipt | null>

export type SingleHostDurableActionExecutorOptions = {
  workerId?: string
  claimTtlMs?: number
  waitForCompletionMs?: number
  pollIntervalMs?: number
  ambiguousFailureDisposition?: 'retry' | 'manual_review'
  effectReceiptLookup?: DurableEffectReceiptLookup
  effectReceiptAuthentication?: {
    trustedEd25519PublicKeys: Record<string, string>
  }
  faultInjector?: (point: SingleHostDurableActionExecutorFaultPoint) => void
}

export type SingleHostDurableActionExecutorFaultPoint =
  | 'after_action_claim_commit_before_handler'
  | 'after_handler_success_before_obligation_complete'

export type DurableActionExecutionInput = {
  scopeKey: string
  requestFingerprint: string
  actionType: string
  opaqueEffectEnvelope: string
}

export type DurableActionExecutionResult<T> = {
  obligation: DurableActionObligation
  value: T | null
  replayed: boolean
}

export type DurableActionExecutionOptions<T> = {
  receiptComparableResult?: (value: T) => unknown
}

export type DurableEffectReconciliationResult = {
  result: Record<string, unknown>
  resultDigest: string
  authentication: {
    algorithm: 'Ed25519'
    keyId: string
  } | null
}

const RECEIPT_PURPOSE = 'openport.durable-effect-receipt'
const MAX_RECEIPT_KEYS = 32
const MAX_RECEIPT_KEY_ID_LENGTH = 128
const MAX_PUBLIC_KEY_PEM_LENGTH = 8_192

function receiptSigningPayload(receipt: DurableEffectReceipt, keyId: string): Record<string, unknown> {
  return {
    version: 1,
    purpose: RECEIPT_PURPOSE,
    keyId,
    obligationId: receipt.obligationId,
    effectId: receipt.effectId,
    requestFingerprint: receipt.requestFingerprint,
    actionType: receipt.actionType,
    resultDigest: receipt.resultDigest
  }
}

function parseTrustedReceiptKeys(
  configured: Record<string, string> | undefined
): Map<string, crypto.KeyObject> | null {
  if (!configured) return null
  const entries = Object.entries(configured)
  if (entries.length === 0) return null
  if (entries.length > MAX_RECEIPT_KEYS) {
    throw new TypeError('trustedEd25519PublicKeys exceeds the supported key count')
  }

  const keys = new Map<string, crypto.KeyObject>()
  for (const [keyId, pem] of entries) {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(keyId) || keyId.length > MAX_RECEIPT_KEY_ID_LENGTH) {
      throw new TypeError('trustedEd25519PublicKeys contains an invalid key identifier')
    }
    if (typeof pem !== 'string' || pem.length === 0 || pem.length > MAX_PUBLIC_KEY_PEM_LENGTH) {
      throw new TypeError('trustedEd25519PublicKeys contains an invalid public key')
    }
    const normalizedPem = pem.trim()
    if (!normalizedPem.startsWith('-----BEGIN PUBLIC KEY-----\n') ||
      !normalizedPem.endsWith('\n-----END PUBLIC KEY-----')) {
      throw new TypeError('trustedEd25519PublicKeys must contain SPKI public-key PEM values')
    }
    let key: crypto.KeyObject
    try {
      key = crypto.createPublicKey(normalizedPem)
    } catch {
      throw new TypeError('trustedEd25519PublicKeys contains an invalid public key')
    }
    if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
      throw new TypeError('trustedEd25519PublicKeys must contain Ed25519 public keys')
    }
    keys.set(keyId, key)
  }
  return keys
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number, name: string): number {
  const normalized = value === undefined ? fallback : value
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw new TypeError(name + ' is outside the supported range')
  }
  return normalized
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Coordinates one public HTTP action against the single-host durable
 * obligation state machine. Automatic retry is disabled by default. Enabling
 * it is safe only when the receiver durably deduplicates the supplied effectId.
 */
export class SingleHostDurableActionExecutor {
  private readonly workerId: string
  private readonly claimTtlMs: number
  private readonly waitForCompletionMs: number
  private readonly pollIntervalMs: number
  private readonly ambiguousFailureDisposition: 'retry' | 'manual_review'
  private readonly effectReceiptLookup?: DurableEffectReceiptLookup
  private readonly trustedReceiptKeys: Map<string, crypto.KeyObject> | null
  private readonly faultInjector?: (point: SingleHostDurableActionExecutorFaultPoint) => void

  constructor(
    private readonly store: SqliteDurableActionStore,
    options: SingleHostDurableActionExecutorOptions = {}
  ) {
    this.workerId = options.workerId?.trim() || randomId('worker')
    this.claimTtlMs = boundedInteger(options.claimTtlMs, 30_000, 1, 60 * 60 * 1000, 'claimTtlMs')
    this.waitForCompletionMs = boundedInteger(options.waitForCompletionMs, 2_000, 0, 60_000, 'waitForCompletionMs')
    this.pollIntervalMs = boundedInteger(options.pollIntervalMs, 5, 1, 1_000, 'pollIntervalMs')
    this.ambiguousFailureDisposition = options.ambiguousFailureDisposition || 'manual_review'
    this.effectReceiptLookup = options.effectReceiptLookup
    this.trustedReceiptKeys = parseTrustedReceiptKeys(
      options.effectReceiptAuthentication?.trustedEd25519PublicKeys
    )
    this.faultInjector = options.faultInjector
  }

  async execute<T>(
    input: DurableActionExecutionInput,
    handler: (context: DurableEffectContext) => Promise<T>,
    options: DurableActionExecutionOptions<T> = {}
  ): Promise<DurableActionExecutionResult<T>> {
    const submitted = this.store.submit({
      scopeKey: input.scopeKey,
      requestFingerprint: input.requestFingerprint,
      actionType: input.actionType,
      opaqueEffectEnvelope: input.opaqueEffectEnvelope
    })
    let obligation = submitted.obligation
    if (obligation.status === 'succeeded') {
      return { obligation, value: null, replayed: true }
    }
    this.assertActionEligible(obligation)

    const deadline = Date.now() + this.waitForCompletionMs
    let claim = this.store.claimAction(obligation.id, this.workerId, this.claimTtlMs)
    while (!claim && Date.now() < deadline) {
      await delay(this.pollIntervalMs)
      obligation = this.requireObligation(obligation.id)
      if (obligation.status === 'succeeded') {
        return { obligation, value: null, replayed: true }
      }
      this.assertActionEligible(obligation)
      claim = this.store.claimAction(obligation.id, this.workerId, this.claimTtlMs)
    }
    if (!claim) {
      throw new OpenPortError(
        409,
        ErrorCodes.AGENT_PRECONDITION_FAILED,
        'Durable action is currently owned by another live worker',
        { reason: 'durable_action_in_progress', obligationId: obligation.id }
      )
    }

    let value: T
    try {
      this.faultInjector?.('after_action_claim_commit_before_handler')
      value = await handler({
        obligationId: claim.obligation.id,
        effectId: claim.obligation.effectId,
        requestFingerprint: claim.obligation.requestFingerprint,
        actionType: claim.obligation.actionType,
        attempt: claim.obligation.actionAttemptCount,
        reclaimed: claim.reclaimed
      })
    } catch (error) {
      const current = this.requireObligation(claim.obligation.id)
      if (current.status === 'succeeded') {
        return { obligation: current, value: null, replayed: true }
      }
      try {
        this.store.failAction(
          claim.obligation.id,
          claim.claimToken,
          error instanceof OpenPortError ? error.code : ErrorCodes.AGENT_EXECUTION_FAILED,
          this.ambiguousFailureDisposition
        )
      } catch {
        // Preserve the original handler error. An expired or replaced claim is
        // intentionally left for the next fenced worker to reconcile.
      }
      throw error
    }

    const comparableResult = options.receiptComparableResult
      ? options.receiptComparableResult(value)
      : value
    const resultEnvelope = JSON.stringify({
      version: 1,
      resultDigest: 'sha256:' + sha256JcsHex(comparableResult)
    })
    try {
      this.faultInjector?.('after_handler_success_before_obligation_complete')
      obligation = this.store.completeAction(
        claim.obligation.id,
        claim.claimToken,
        resultEnvelope
      )
    } catch (error) {
      const current = this.requireObligation(claim.obligation.id)
      if (current.status !== 'succeeded') throw error
      obligation = current
    }
    return {
      obligation,
      value,
      replayed: submitted.replayed || claim.reclaimed
    }
  }

  getStore(): SqliteDurableActionStore {
    return this.store
  }

  /**
   * Reconstructs only the result value for an already successful obligation.
   * The caller remains responsible for writing its local execution record.
   * Missing evidence returns null; unavailable or invalid evidence fails closed.
   */
  async reconcileSucceededEffect(
    input: DurableActionExecutionInput,
    obligation: DurableActionObligation
  ): Promise<DurableEffectReconciliationResult | null> {
    const expectedScopeKeyDigest = 'sha256:' + sha256JcsHex({ scopeKey: input.scopeKey })
    if (obligation.status !== 'succeeded' ||
      obligation.scopeKeyDigest !== expectedScopeKeyDigest ||
      obligation.requestFingerprint !== input.requestFingerprint ||
      obligation.actionType !== input.actionType) {
      throw this.invalidReceipt(obligation.id)
    }
    if (!this.effectReceiptLookup) return null

    let receipt: DurableEffectReceipt | null
    try {
      receipt = await this.effectReceiptLookup({
        obligationId: obligation.id,
        effectId: obligation.effectId,
        requestFingerprint: obligation.requestFingerprint,
        actionType: obligation.actionType
      })
    } catch {
      throw new OpenPortError(
        409,
        ErrorCodes.AGENT_PRECONDITION_FAILED,
        'Durable effect receipt is temporarily unavailable',
        { reason: 'durable_effect_receipt_unavailable', obligationId: obligation.id }
      )
    }
    if (!receipt) return null

    const authentication = this.verifyReceiptAuthentication(receipt, obligation.id)

    let obligationResultDigest: string
    let computedResultDigest: string
    try {
      const envelope = JSON.parse(obligation.opaqueResultEnvelope || '') as Record<string, unknown>
      obligationResultDigest = String(envelope.resultDigest || '')
      computedResultDigest = 'sha256:' + sha256JcsHex(receipt.result)
      if (Number(envelope.version) !== 1 || !/^sha256:[0-9a-f]{64}$/.test(obligationResultDigest)) {
        throw new Error('invalid obligation result envelope')
      }
    } catch {
      throw this.invalidReceipt(obligation.id)
    }

    const valid = receipt.effectId === obligation.effectId &&
      (!authentication || receipt.obligationId === obligation.id) &&
      receipt.requestFingerprint === obligation.requestFingerprint &&
      receipt.actionType === obligation.actionType &&
      receipt.result !== null &&
      typeof receipt.result === 'object' &&
      !Array.isArray(receipt.result) &&
      receipt.resultDigest === computedResultDigest &&
      receipt.resultDigest === obligationResultDigest
    if (!valid) throw this.invalidReceipt(obligation.id)

    return { result: receipt.result, resultDigest: computedResultDigest, authentication }
  }

  private verifyReceiptAuthentication(
    receipt: DurableEffectReceipt,
    obligationId: string
  ): DurableEffectReconciliationResult['authentication'] {
    if (!this.trustedReceiptKeys) return null
    const authentication = receipt.authentication
    if (!authentication || authentication.algorithm !== 'Ed25519' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(authentication.keyId) ||
      !/^[A-Za-z0-9_-]{86}$/.test(authentication.signature)) {
      throw this.authenticationFailedReceipt(obligationId)
    }
    const publicKey = this.trustedReceiptKeys.get(authentication.keyId)
    if (!publicKey) throw this.authenticationFailedReceipt(obligationId)

    let signature: Buffer
    let payload: Buffer
    try {
      signature = Buffer.from(authentication.signature, 'base64url')
      if (signature.length !== 64 || base64Url(signature) !== authentication.signature) {
        throw new Error('invalid Ed25519 signature encoding')
      }
      payload = Buffer.from(jcs(receiptSigningPayload(receipt, authentication.keyId)), 'utf8')
    } catch {
      throw this.authenticationFailedReceipt(obligationId)
    }
    if (!crypto.verify(null, payload, publicKey, signature)) {
      throw this.authenticationFailedReceipt(obligationId)
    }
    return { algorithm: 'Ed25519', keyId: authentication.keyId }
  }

  private assertActionEligible(obligation: DurableActionObligation): void {
    if (obligation.status === 'pending' || obligation.status === 'in_progress') return
    throw new OpenPortError(
      409,
      ErrorCodes.AGENT_PRECONDITION_FAILED,
      'Durable action cannot execute from its current state',
      { reason: 'durable_action_' + obligation.status, obligationId: obligation.id }
    )
  }

  private requireObligation(obligationId: string): DurableActionObligation {
    const obligation = this.store.getById(obligationId)
    if (!obligation) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Durable action obligation not found')
    }
    return obligation
  }

  private invalidReceipt(obligationId: string): OpenPortError {
    return new OpenPortError(
      409,
      ErrorCodes.AGENT_PRECONDITION_FAILED,
      'Durable effect receipt failed verification',
      { reason: 'durable_effect_receipt_invalid', obligationId }
    )
  }

  private authenticationFailedReceipt(obligationId: string): OpenPortError {
    return new OpenPortError(
      409,
      ErrorCodes.AGENT_PRECONDITION_FAILED,
      'Durable effect receipt authentication failed',
      { reason: 'durable_effect_receipt_authentication_failed', obligationId }
    )
  }
}
