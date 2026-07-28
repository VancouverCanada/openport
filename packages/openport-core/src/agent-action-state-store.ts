import type { AgentDraft, AgentExecution, DraftStatus } from './types.js'

/**
 * Persistence boundary for the public HTTP action lifecycle.
 *
 * Authentication, intent, context, and capability-lease state remain separate
 * concerns. Implementations must bind idempotency keys to request fingerprints
 * and must never treat a failed execution as a successful replay.
 */
export interface AgentActionStateStore {
  saveDraft(input: Omit<AgentDraft, 'id' | 'created_at' | 'updated_at'> & { id?: string }): AgentDraft
  updateDraft(draftId: string, patch: Partial<AgentDraft>): AgentDraft | null
  getDraft(draftId: string): AgentDraft | null
  listDrafts(filter?: { appId?: string; status?: DraftStatus }): AgentDraft[]
  findDraftByIdempotency(appId: string, idempotencyKey: string): AgentDraft | null
  saveExecution(
    input: Omit<AgentExecution, 'id' | 'created_at'>,
    requestFingerprint?: string | null
  ): AgentExecution
  getExecutionRequestFingerprint(executionId: string): string | null
  getLatestExecutionForDraft(draftId: string): AgentExecution | null
  findExecutionByIdempotency(appId: string, idempotencyKey: string): AgentExecution | null
  deleteActionsForApp(appId: string): void
  close?: () => void
}
