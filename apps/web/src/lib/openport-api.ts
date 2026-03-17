import type {
  OpenPortAuthResponse,
  OpenPortBootstrapResponse,
  OpenPortChatMessagesResponse,
  OpenPortChatSessionsExportResponse,
  OpenPortChatSessionsImportResponse,
  OpenPortChatMessage,
  OpenPortChatSettings,
  OpenPortChatSession,
  OpenPortChatSessionResponse,
  OpenPortClientSession,
  OpenPortCurrentUserResponse,
  OpenPortDeleteProjectResponse,
  OpenPortIntegration,
  OpenPortKnowledgeCollection,
  OpenPortKnowledgeCollectionResponse,
  OpenPortKnowledgeCollectionsResponse,
  OpenPortKnowledgeChunkingOptions,
  OpenPortListResponse,
  OpenPortNote,
  OpenPortNoteAssistantResponse,
  OpenPortNoteCollaborationState,
  OpenPortNoteGrant,
  OpenPortNoteGrantResponse,
  OpenPortNoteResponse,
  OpenPortNotePrincipalType,
  OpenPortSearchContextResponse,
  OpenPortSearchHistoryResponse,
  OpenPortNotePermission,
  OpenPortSearchItem,
  OpenPortSearchResultType,
  OpenPortSearchResponse,
  OpenPortProject,
  OpenPortProjectExportBundle,
  OpenPortProjectFile,
  OpenPortProjectAsset,
  OpenPortProjectAssetResponse,
  OpenPortProjectCollaborationState,
  OpenPortProjectEvent,
  OpenPortProjectGrant,
  OpenPortProjectGrantResponse,
  OpenPortProjectImportResponse,
  OpenPortProjectKnowledgeItem,
  OpenPortProjectKnowledgeChunkMatch,
  OpenPortProjectKnowledgeBatchRebuildResponse,
  OpenPortProjectKnowledgeBatchMaintenanceResponse,
  OpenPortProjectKnowledgeBatchMaintenanceAction,
  OpenPortProjectKnowledgeChunkSearchResponse,
  OpenPortProjectKnowledgeChunkStatsResponse,
  OpenPortProjectKnowledgeSourceBatchResponse,
  OpenPortProjectKnowledgeSource,
  OpenPortProjectKnowledgeResponse,
  OpenPortProjectKnowledgeSearchResponse,
  OpenPortProjectMeta,
  OpenPortProjectPermission,
  OpenPortProjectPrincipalType,
  OpenPortProjectResponse,
  OpenPortWorkspace,
  OpenPortWorkspaceCapabilityPolicy,
  OpenPortWorkspaceCapabilityPolicyResponse,
  OpenPortWorkspaceDeleteResponse,
  OpenPortWorkspaceGroup,
  OpenPortWorkspaceGroupResponse,
  OpenPortWorkspaceInvite,
  OpenPortWorkspaceMember,
  OpenPortWorkspaceMemberResponse,
  OpenPortWorkspaceMemberRole,
  OpenPortWorkspaceUpdateResponse,
  OpenPortWorkspaceModel,
  OpenPortWorkspaceModelResponse,
  OpenPortWorkspacePrompt,
  OpenPortWorkspacePromptResponse,
  OpenPortWorkspacePromptVersion,
  OpenPortWorkspacePromptVersionsResponse,
  OpenPortWorkspaceResourceGrant,
  OpenPortWorkspaceResourceGrantResponse,
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType,
  OpenPortWorkspaceSkill,
  OpenPortWorkspaceSkillResponse,
  OpenPortWorkspaceTool,
  OpenPortWorkspaceToolRun,
  OpenPortWorkspaceToolRunResponse,
  OpenPortWorkspaceToolPackage,
  OpenPortWorkspaceToolPackageImportResponse,
  OpenPortWorkspaceToolPackageResponse,
  OpenPortWorkspaceToolValidationResponse,
  OpenPortWorkspaceToolValveSchemaField,
  OpenPortWorkspaceToolResponse,
  OpenPortWorkspaceConnector,
  OpenPortWorkspaceConnectorResponse,
  OpenPortWorkspaceConnectorCredential,
  OpenPortWorkspaceConnectorCredentialResponse,
  OpenPortWorkspaceConnectorTask,
  OpenPortWorkspaceConnectorTaskResponse,
  OpenPortWorkspaceConnectorAuditEvent
} from '@openport/product-contracts'
import { getPublicApiBaseUrl } from './runtime-env'

export type OpenPortSession = OpenPortClientSession
export type WorkspaceResourceModule = 'models' | 'prompts' | 'tools' | 'skills'
export type UpdateChatSessionMetaInput = {
  title?: string
  archived?: boolean
  pinned?: boolean
  shared?: boolean
  folderId?: string | null
  tags?: string[]
}

export type OllamaConfigResponse = {
  ENABLE_OLLAMA_API: boolean
  OLLAMA_BASE_URLS: string[]
}
export type {
  OpenPortAuthResponse,
  OpenPortBootstrapResponse,
  OpenPortChatMessage,
  OpenPortChatSettings,
  OpenPortChatSession,
  OpenPortIntegration,
  OpenPortNote,
  OpenPortNoteAssistantResponse,
  OpenPortNoteCollaborationState,
  OpenPortNoteGrant,
  OpenPortNoteGrantResponse,
  OpenPortNotePermission,
  OpenPortNotePrincipalType,
  OpenPortProject,
  OpenPortProjectAsset,
  OpenPortProjectCollaborationState,
  OpenPortProjectExportBundle,
  OpenPortProjectFile,
  OpenPortKnowledgeCollection,
  OpenPortProjectKnowledgeItem,
  OpenPortProjectKnowledgeChunkMatch,
  OpenPortProjectKnowledgeBatchRebuildResponse,
  OpenPortProjectKnowledgeBatchMaintenanceResponse,
  OpenPortProjectKnowledgeBatchMaintenanceAction,
  OpenPortProjectKnowledgeChunkSearchResponse,
  OpenPortProjectKnowledgeChunkStatsResponse,
  OpenPortKnowledgeChunkingOptions,
  OpenPortProjectKnowledgeSourceBatchResponse,
  OpenPortProjectKnowledgeSource,
  OpenPortProjectKnowledgeSearchResponse,
  OpenPortProjectGrant,
  OpenPortProjectPermission,
  OpenPortProjectPrincipalType,
  OpenPortProjectMeta,
  OpenPortWorkspace,
  OpenPortWorkspaceGroup,
  OpenPortWorkspaceModel,
  OpenPortWorkspaceCapabilityPolicy,
  OpenPortWorkspaceInvite,
  OpenPortWorkspaceMember,
  OpenPortWorkspaceMemberRole,
  OpenPortWorkspacePrompt,
  OpenPortWorkspacePromptVersion,
  OpenPortWorkspaceResourceGrant,
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType,
  OpenPortWorkspaceSkill,
  OpenPortWorkspaceTool,
  OpenPortWorkspaceToolRun,
  OpenPortWorkspaceToolPackage,
  OpenPortWorkspaceToolPackageImportResponse,
  OpenPortWorkspaceToolPackageResponse,
  OpenPortWorkspaceConnector,
  OpenPortWorkspaceConnectorCredential,
  OpenPortWorkspaceConnectorTask,
  OpenPortWorkspaceConnectorAuditEvent,
  OpenPortWorkspaceToolValidationResponse,
  OpenPortWorkspaceToolValveSchemaField,
  OpenPortSearchContextResponse,
  OpenPortSearchHistoryResponse,
  OpenPortSearchResultType,
  OpenPortSearchItem
}

const SESSION_KEY = 'openport.web.session'

function buildHeaders(session?: OpenPortSession | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    'x-openport-user': session?.userId || 'user_demo',
    'x-openport-workspace': session?.workspaceId || 'ws_user_demo',
    'x-openport-admin-user': session?.userId || 'admin_demo'
  }
}

async function request<T>(path: string, init: RequestInit = {}, session?: OpenPortSession | null): Promise<T> {
  const headers = new Headers(buildHeaders(session))
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store'
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function saveSession(session: OpenPortSession): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): OpenPortSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as OpenPortSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
}

export function switchSessionWorkspace(workspaceId: string): OpenPortSession | null {
  const nextWorkspaceId = workspaceId.trim()
  if (!nextWorkspaceId) return null

  const session = loadSession()
  if (!session) return null

  const nextSession: OpenPortSession = {
    ...session,
    workspaceId: nextWorkspaceId
  }
  saveSession(nextSession)
  return nextSession
}

function toSession(payload: OpenPortAuthResponse): OpenPortSession {
  return {
    accessToken: payload.tokens.accessToken,
    refreshToken: payload.tokens.refreshToken,
    userId: payload.user.id,
    workspaceId: payload.workspace.id,
    email: payload.user.email,
    name: payload.user.name
  }
}

export async function registerOpenPort(input: {
  name: string
  email: string
  password: string
  workspaceName?: string
}): Promise<OpenPortSession> {
  const payload = await request<OpenPortAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return toSession(payload)
}

export async function loginOpenPort(input: {
  email: string
  password: string
  rememberMe?: boolean
}): Promise<OpenPortSession> {
  const payload = await request<OpenPortAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return toSession(payload)
}

export async function fetchCurrentUser(session: OpenPortSession): Promise<OpenPortCurrentUserResponse> {
  return request<OpenPortCurrentUserResponse>('/auth/me', { method: 'GET' }, session)
}

export async function fetchWorkspaces(session: OpenPortSession): Promise<OpenPortListResponse<OpenPortWorkspace>> {
  return request<OpenPortListResponse<OpenPortWorkspace>>('/workspaces', { method: 'GET' }, session)
}

export async function createWorkspace(
  input: {
    name: string
    slug?: string
  },
  session?: OpenPortSession | null
): Promise<{ workspace: OpenPortWorkspace }> {
  return request<{ workspace: OpenPortWorkspace }>('/workspaces', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspace(
  workspaceId: string,
  input: {
    name?: string
    slug?: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceUpdateResponse> {
  return request<OpenPortWorkspaceUpdateResponse>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspace(
  workspaceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceDeleteResponse> {
  return request<OpenPortWorkspaceDeleteResponse>(`/workspaces/${workspaceId}`, {
    method: 'DELETE'
  }, session)
}

export async function fetchWorkspaceCapabilityPolicy(
  workspaceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceCapabilityPolicyResponse> {
  return request<OpenPortWorkspaceCapabilityPolicyResponse>(
    `/workspaces/${workspaceId}/capability-policy`,
    { method: 'GET' },
    session
  )
}

export async function updateWorkspaceCapabilityPolicy(
  workspaceId: string,
  input: {
    change?: {
      role: 'admin' | 'member' | 'viewer'
      module: keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin']
      action: keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin']['models']
      enabled: boolean
    }
    changes?: Array<{
      role: 'admin' | 'member' | 'viewer'
      module: keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin']
      action: keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin']['models']
      enabled: boolean
    }>
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceCapabilityPolicyResponse> {
  return request<OpenPortWorkspaceCapabilityPolicyResponse>(
    `/workspaces/${workspaceId}/capability-policy`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function fetchWorkspaceMembers(
  workspaceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceMember>> {
  return request<OpenPortListResponse<OpenPortWorkspaceMember>>(`/workspaces/${workspaceId}/members`, { method: 'GET' }, session)
}

export async function createWorkspaceMember(
  workspaceId: string,
  input: { userId: string; role: OpenPortWorkspaceMemberRole },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceMemberResponse> {
  return request<OpenPortWorkspaceMemberResponse>(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchWorkspaceInvites(
  workspaceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceInvite>> {
  return request<OpenPortListResponse<OpenPortWorkspaceInvite>>(`/workspaces/${workspaceId}/invites`, { method: 'GET' }, session)
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  input: { email: string; role: OpenPortWorkspaceMemberRole },
  session?: OpenPortSession | null
): Promise<{ invite: OpenPortWorkspaceInvite }> {
  return request<{ invite: OpenPortWorkspaceInvite }>(`/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: OpenPortWorkspaceMemberRole,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceMemberResponse> {
  return request<OpenPortWorkspaceMemberResponse>(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  }, session)
}

export async function fetchGroups(session?: OpenPortSession | null): Promise<OpenPortListResponse<OpenPortWorkspaceGroup>> {
  return request<OpenPortListResponse<OpenPortWorkspaceGroup>>('/groups', { method: 'GET' }, session)
}

export async function createGroup(
  input: {
    name: string
    description?: string
    memberUserIds?: string[]
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceGroupResponse> {
  return request<OpenPortWorkspaceGroupResponse>('/groups', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateGroup(
  groupId: string,
  input: {
    name?: string
    description?: string
    memberUserIds?: string[]
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceGroupResponse> {
  return request<OpenPortWorkspaceGroupResponse>(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteGroup(groupId: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/groups/${groupId}`, { method: 'DELETE' }, session)
}

export async function fetchBootstrap(session?: OpenPortSession | null): Promise<OpenPortBootstrapResponse> {
  return request<OpenPortBootstrapResponse>('/openport-admin/bootstrap', { method: 'GET' }, session)
}

export async function fetchIntegrations(session?: OpenPortSession | null): Promise<OpenPortListResponse<OpenPortIntegration>> {
  return request<OpenPortListResponse<OpenPortIntegration>>('/openport-admin/integrations', { method: 'GET' }, session)
}

export async function fetchChatSessions(
  input: {
    archived?: boolean
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortChatSession>> {
  const params = new URLSearchParams()
  if (typeof input.archived === 'boolean') params.set('archived', String(input.archived))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<OpenPortListResponse<OpenPortChatSession>>(`/ai/sessions${suffix}`, { method: 'GET' }, session)
}

export async function fetchChatList(
  page = 1,
  session?: OpenPortSession | null
): Promise<OpenPortSearchResponse> {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, Math.floor(page))))
  return request<OpenPortSearchResponse>(`/chats?${params.toString()}`, { method: 'GET' }, session)
}

export async function fetchChatListBySearchText(
  text: string,
  page = 1,
  session?: OpenPortSession | null
): Promise<OpenPortSearchResponse> {
  const params = new URLSearchParams()
  params.set('text', text.trim())
  params.set('page', String(Math.max(1, Math.floor(page))))
  return request<OpenPortSearchResponse>(`/chats/search?${params.toString()}`, { method: 'GET' }, session)
}

export async function searchOpenPort(
  input: {
    q?: string
    type?: 'all' | 'chat' | 'note'
    cursor?: string | null
    limit?: number
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortSearchResponse> {
  const params = new URLSearchParams()
  if (input.q?.trim()) params.set('q', input.q.trim())
  if (input.type && input.type !== 'all') params.set('type', input.type)
  if (input.cursor) params.set('cursor', input.cursor)
  if (typeof input.limit === 'number') params.set('limit', String(input.limit))

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<OpenPortSearchResponse>(`/search${suffix}`, { method: 'GET' }, session)
}

export async function fetchSearchContext(
  session?: OpenPortSession | null
): Promise<OpenPortSearchContextResponse> {
  return request<OpenPortSearchContextResponse>('/search/context', { method: 'GET' }, session)
}

export async function trackSearchHistory(
  input: {
    query: string
    lastResultCount?: number
    topResultType?: OpenPortSearchResultType | null
  },
  session?: OpenPortSession | null
): Promise<OpenPortSearchHistoryResponse> {
  return request<OpenPortSearchHistoryResponse>(
    '/search/history',
    {
      method: 'POST',
      body: JSON.stringify({
        query: input.query,
        lastResultCount: input.lastResultCount,
        topResultType: input.topResultType ?? undefined
      })
    },
    session
  )
}

export async function deleteSearchHistory(
  entryId: string,
  session?: OpenPortSession | null
): Promise<OpenPortSearchHistoryResponse> {
  return request<OpenPortSearchHistoryResponse>(`/search/history/${entryId}`, { method: 'DELETE' }, session)
}

export async function createChatSession(
  title: string,
  session?: OpenPortSession | null,
  options?: {
    settings?: OpenPortChatSettings
  }
): Promise<OpenPortChatSessionResponse> {
  return request<OpenPortChatSessionResponse>('/ai/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, settings: options?.settings })
  }, session)
}

export async function fetchChatSession(
  sessionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortChatSessionResponse> {
  return request<OpenPortChatSessionResponse>(`/ai/sessions/${sessionId}`, { method: 'GET' }, session)
}

export async function postChatMessage(
  sessionId: string,
  content: string,
  attachmentsOrSession: OpenPortChatMessage['attachments'] | OpenPortSession | null = [],
  maybeSession?: OpenPortSession | null
): Promise<OpenPortChatMessagesResponse> {
  const attachments = Array.isArray(attachmentsOrSession) ? attachmentsOrSession : []
  const session = Array.isArray(attachmentsOrSession) ? maybeSession : attachmentsOrSession

  return request<OpenPortChatMessagesResponse>(`/ai/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments })
  }, session)
}

export async function updateChatSessionSettings(
  sessionId: string,
  settings: OpenPortChatSettings,
  session?: OpenPortSession | null
): Promise<OpenPortChatSessionResponse> {
  return request<OpenPortChatSessionResponse>(`/ai/sessions/${sessionId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ settings })
  }, session)
}

export async function updateChatSessionMeta(
  sessionId: string,
  input: UpdateChatSessionMetaInput,
  session?: OpenPortSession | null
): Promise<OpenPortChatSessionResponse> {
  return request<OpenPortChatSessionResponse>(`/ai/sessions/${sessionId}/meta`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function exportChatSessions(
  session?: OpenPortSession | null
): Promise<OpenPortChatSessionsExportResponse> {
  return request<OpenPortChatSessionsExportResponse>('/ai/sessions/export', { method: 'GET' }, session)
}

export async function importChatSessions(
  items: unknown[],
  session?: OpenPortSession | null
): Promise<OpenPortChatSessionsImportResponse> {
  return request<OpenPortChatSessionsImportResponse>('/ai/sessions/import', {
    method: 'POST',
    body: JSON.stringify({ items })
  }, session)
}

export async function archiveAllChatSessions(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortChatSession>> {
  return request<OpenPortListResponse<OpenPortChatSession>>('/ai/sessions/archive-all', {
    method: 'POST'
  }, session)
}

export async function deleteAllChatSessions(session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>('/ai/sessions', { method: 'DELETE' }, session)
}

export async function deleteChatSession(
  sessionId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/ai/sessions/${sessionId}`, { method: 'DELETE' }, session)
}

export async function fetchNotes(
  input: {
    query?: string
    archived?: boolean
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortNote>> {
  const params = new URLSearchParams()
  if (input.query?.trim()) params.set('query', input.query.trim())
  if (input.archived !== undefined) params.set('archived', String(input.archived))

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<OpenPortListResponse<OpenPortNote>>(`/notes${suffix}`, { method: 'GET' }, session)
}

export async function fetchProjects(session?: OpenPortSession | null): Promise<OpenPortListResponse<OpenPortProject>> {
  return request<OpenPortListResponse<OpenPortProject>>('/projects', { method: 'GET' }, session)
}

export async function createProject(
  input: {
    name: string
    parentId?: string | null
    isExpanded?: boolean
    meta?: Partial<OpenPortProjectMeta>
    data?: {
      systemPrompt?: string
      defaultModelRoute?: string | null
      modelRoutes?: string[]
      files?: OpenPortProjectFile[]
    }
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectResponse> {
  return request<OpenPortProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateProject(
  projectId: string,
  input: {
    name?: string
    parentId?: string | null
    isExpanded?: boolean
    meta?: Partial<OpenPortProjectMeta>
    data?: {
      systemPrompt?: string
      defaultModelRoute?: string | null
      modelRoutes?: string[]
      files?: OpenPortProjectFile[]
    }
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectResponse> {
  return request<OpenPortProjectResponse>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function moveProject(
  projectId: string,
  parentId: string | null,
  session?: OpenPortSession | null
): Promise<OpenPortProjectResponse> {
  return request<OpenPortProjectResponse>(`/projects/${projectId}/move`, {
    method: 'POST',
    body: JSON.stringify({ parentId })
  }, session)
}

export async function deleteProject(
  projectId: string,
  deleteContents: boolean,
  session?: OpenPortSession | null
): Promise<OpenPortDeleteProjectResponse> {
  const params = new URLSearchParams({ deleteContents: String(deleteContents) })
  return request<OpenPortDeleteProjectResponse>(`/projects/${projectId}?${params.toString()}`, {
    method: 'DELETE'
  }, session)
}

export async function exportProject(
  projectId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectExportBundle> {
  return request<OpenPortProjectExportBundle>(`/projects/${projectId}/export`, { method: 'GET' }, session)
}

export async function importProjectBundle(
  bundle: OpenPortProjectExportBundle,
  parentId?: string | null,
  session?: OpenPortSession | null
): Promise<OpenPortProjectImportResponse> {
  return request<OpenPortProjectImportResponse>('/projects/import', {
    method: 'POST',
    body: JSON.stringify({ bundle, parentId: parentId ?? null })
  }, session)
}

export async function fetchProjectKnowledge(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortProjectKnowledgeItem>> {
  return request<OpenPortListResponse<OpenPortProjectKnowledgeItem>>('/projects/knowledge', { method: 'GET' }, session)
}

export async function fetchKnowledgeCollections(
  session?: OpenPortSession | null
): Promise<OpenPortKnowledgeCollectionsResponse> {
  return request<OpenPortKnowledgeCollectionsResponse>('/projects/knowledge/collections', { method: 'GET' }, session)
}

export async function createKnowledgeCollection(
  input: {
    id?: string
    name: string
    description?: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortKnowledgeCollectionResponse> {
  return request<OpenPortKnowledgeCollectionResponse>('/projects/knowledge/collections', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateKnowledgeCollection(
  collectionId: string,
  input: {
    name?: string
    description?: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortKnowledgeCollectionResponse> {
  return request<OpenPortKnowledgeCollectionResponse>(`/projects/knowledge/collections/${collectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteKnowledgeCollection(
  collectionId: string,
  input: {
    moveToCollectionId?: string
    moveToCollectionName?: string
  } = {},
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/projects/knowledge/collections/${collectionId}`, {
    method: 'DELETE',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchKnowledgeCollectionAccessGrants(
  collectionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
  return request<OpenPortListResponse<OpenPortWorkspaceResourceGrant>>(
    `/projects/knowledge/collections/${collectionId}/access-grants`,
    { method: 'GET' },
    session
  )
}

export async function shareKnowledgeCollection(
  collectionId: string,
  input: {
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId: string
    permission: OpenPortWorkspaceResourcePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceResourceGrantResponse> {
  return request<OpenPortWorkspaceResourceGrantResponse>(
    `/projects/knowledge/collections/${collectionId}/access-grants`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function revokeKnowledgeCollectionShare(
  collectionId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/projects/knowledge/collections/${collectionId}/access-grants/${grantId}`,
    { method: 'DELETE' },
    session
  )
}

export async function fetchProjectKnowledgeItem(
  itemId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}`, { method: 'GET' }, session)
}

export async function fetchKnowledgeItemAccessGrants(
  itemId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
  return request<OpenPortListResponse<OpenPortWorkspaceResourceGrant>>(
    `/projects/knowledge/${itemId}/access-grants`,
    { method: 'GET' },
    session
  )
}

export async function shareKnowledgeItem(
  itemId: string,
  input: {
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId: string
    permission: OpenPortWorkspaceResourcePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceResourceGrantResponse> {
  return request<OpenPortWorkspaceResourceGrantResponse>(
    `/projects/knowledge/${itemId}/access-grants`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function revokeKnowledgeItemShare(
  itemId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/projects/knowledge/${itemId}/access-grants/${grantId}`,
    { method: 'DELETE' },
    session
  )
}

export async function fetchKnowledgeSourceAccessGrants(
  sourceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
  return request<OpenPortListResponse<OpenPortWorkspaceResourceGrant>>(
    `/projects/knowledge/sources/${sourceId}/access-grants`,
    { method: 'GET' },
    session
  )
}

export async function shareKnowledgeSource(
  sourceId: string,
  input: {
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId: string
    permission: OpenPortWorkspaceResourcePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceResourceGrantResponse> {
  return request<OpenPortWorkspaceResourceGrantResponse>(
    `/projects/knowledge/sources/${sourceId}/access-grants`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function revokeKnowledgeSourceShare(
  sourceId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/projects/knowledge/sources/${sourceId}/access-grants/${grantId}`,
    { method: 'DELETE' },
    session
  )
}

export async function fetchKnowledgeChunkAccessGrants(
  chunkId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
  return request<OpenPortListResponse<OpenPortWorkspaceResourceGrant>>(
    `/projects/knowledge/chunks/${chunkId}/access-grants`,
    { method: 'GET' },
    session
  )
}

export async function shareKnowledgeChunk(
  chunkId: string,
  input: {
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId: string
    permission: OpenPortWorkspaceResourcePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceResourceGrantResponse> {
  return request<OpenPortWorkspaceResourceGrantResponse>(
    `/projects/knowledge/chunks/${chunkId}/access-grants`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function revokeKnowledgeChunkShare(
  chunkId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/projects/knowledge/chunks/${chunkId}/access-grants/${grantId}`,
    { method: 'DELETE' },
    session
  )
}

export async function uploadProjectKnowledge(
  input: {
    name: string
    type?: string
    size?: number
    collectionId?: string
    collectionName?: string
    contentBase64: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>('/projects/knowledge/upload', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function createProjectKnowledgeText(
  input: {
    name: string
    collectionId?: string
    collectionName?: string
    contentText: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>('/projects/knowledge/text', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function createProjectKnowledgeWeb(
  input: {
    url: string
    name?: string
    collectionId?: string
    collectionName?: string
    maxChars?: number
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>('/projects/knowledge/web', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function appendProjectKnowledgeContent(
  itemId: string,
  contentText: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/append`, {
    method: 'POST',
    body: JSON.stringify({ contentText })
  }, session)
}

export async function reindexProjectKnowledge(
  itemId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/reindex`, {
    method: 'POST'
  }, session)
}

export async function resetProjectKnowledge(
  itemId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/reset`, {
    method: 'POST'
  }, session)
}

export async function deleteProjectKnowledgeSource(
  itemId: string,
  sourceId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/sources/${sourceId}`, {
    method: 'DELETE'
  }, session)
}

export async function replaceProjectKnowledgeSource(
  itemId: string,
  sourceId: string,
  input: {
    contentText: string
    label?: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function maintainProjectKnowledgeSourceBatch(
  sourceId: string,
  input: {
    action: 'reindex' | 'reset' | 'remove' | 'replace' | 'rebuild'
    contentText?: string
    label?: string
    strategy?: OpenPortKnowledgeChunkingOptions['strategy']
    chunkSize?: number
    overlap?: number
    maxChunks?: number
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeSourceBatchResponse> {
  return request<OpenPortProjectKnowledgeSourceBatchResponse>(`/projects/knowledge/sources/${sourceId}/batch`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function searchProjectKnowledgeChunks(
  itemId: string,
  query: string,
  limit = 12,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeChunkSearchResponse> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  params.set('limit', String(limit))
  const suffix = params.toString()
  return request<OpenPortProjectKnowledgeChunkSearchResponse>(
    `/projects/knowledge/${itemId}/chunks/search${suffix ? `?${suffix}` : ''}`,
    { method: 'GET' },
    session
  )
}

export async function fetchProjectKnowledgeChunkStats(
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeChunkStatsResponse> {
  return request<OpenPortProjectKnowledgeChunkStatsResponse>('/projects/knowledge/chunks/stats', { method: 'GET' }, session)
}

export async function rebuildProjectKnowledge(
  itemId: string,
  input: OpenPortKnowledgeChunkingOptions,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/rebuild`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function rebuildProjectKnowledgeBatch(
  input: {
    itemIds?: string[]
  } & OpenPortKnowledgeChunkingOptions,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeBatchRebuildResponse> {
  return request<OpenPortProjectKnowledgeBatchRebuildResponse>('/projects/knowledge/batch/rebuild', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function maintainProjectKnowledgeBatch(
  input: {
    action: OpenPortProjectKnowledgeBatchMaintenanceAction
    itemIds?: string[]
    collectionId?: string
    collectionName?: string
  } & Partial<OpenPortKnowledgeChunkingOptions>,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeBatchMaintenanceResponse> {
  return request<OpenPortProjectKnowledgeBatchMaintenanceResponse>('/projects/knowledge/batch/maintain', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateProjectKnowledgeContent(
  itemId: string,
  contentText: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/content`, {
    method: 'PATCH',
    body: JSON.stringify({ contentText })
  }, session)
}

export async function updateProjectKnowledgeCollection(
  itemId: string,
  input: {
    collectionId?: string
    collectionName?: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeResponse> {
  return request<OpenPortProjectKnowledgeResponse>(`/projects/knowledge/${itemId}/collection`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteProjectKnowledge(
  itemId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/projects/knowledge/${itemId}`, { method: 'DELETE' }, session)
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function normalizeWorkspaceModel(input: OpenPortWorkspaceModel): OpenPortWorkspaceModel {
  const model = input as Partial<OpenPortWorkspaceModel>
  return {
    ...input,
    description: typeof model.description === 'string' ? model.description : '',
    tags: normalizeStringArray(model.tags),
    filterIds: normalizeStringArray(model.filterIds),
    defaultFilterIds: normalizeStringArray(model.defaultFilterIds),
    actionIds: normalizeStringArray(model.actionIds),
    defaultFeatureIds: normalizeStringArray(model.defaultFeatureIds),
    knowledgeItemIds: normalizeStringArray(model.knowledgeItemIds),
    toolIds: normalizeStringArray(model.toolIds),
    builtinToolIds: normalizeStringArray(model.builtinToolIds),
    skillIds: normalizeStringArray(model.skillIds),
    promptSuggestions: Array.isArray(model.promptSuggestions)
      ? model.promptSuggestions.filter(
          (entry): entry is OpenPortWorkspaceModel['promptSuggestions'][number] =>
            Boolean(entry) &&
            typeof entry.id === 'string' &&
            typeof entry.title === 'string' &&
            typeof entry.prompt === 'string'
        )
      : [],
    capabilities: {
      vision: Boolean(model.capabilities?.vision),
      webSearch: Boolean(model.capabilities?.webSearch),
      imageGeneration: Boolean(model.capabilities?.imageGeneration),
      codeInterpreter: Boolean(model.capabilities?.codeInterpreter)
    },
    accessGrants: Array.isArray(model.accessGrants) ? model.accessGrants : []
  }
}

export async function fetchWorkspaceModels(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceModel>> {
  const response = await request<OpenPortListResponse<OpenPortWorkspaceModel>>('/workspace/models', { method: 'GET' }, session)
  return {
    ...response,
    items: Array.isArray(response.items) ? response.items.map((item) => normalizeWorkspaceModel(item)) : []
  }
}

export async function fetchOllamaConfig(session?: OpenPortSession | null): Promise<OllamaConfigResponse> {
  const response = await request<OllamaConfigResponse>('/ollama/config', { method: 'GET' }, session)
  return {
    ENABLE_OLLAMA_API: Boolean(response.ENABLE_OLLAMA_API),
    OLLAMA_BASE_URLS: Array.isArray(response.OLLAMA_BASE_URLS) ? response.OLLAMA_BASE_URLS : []
  }
}

export async function updateOllamaConfig(
  input: Partial<OllamaConfigResponse>,
  session?: OpenPortSession | null
): Promise<OllamaConfigResponse> {
  const response = await request<OllamaConfigResponse>('/ollama/config/update', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
  return {
    ENABLE_OLLAMA_API: Boolean(response.ENABLE_OLLAMA_API),
    OLLAMA_BASE_URLS: Array.isArray(response.OLLAMA_BASE_URLS) ? response.OLLAMA_BASE_URLS : []
  }
}

export async function verifyOllamaConnection(
  urlIdx = 0,
  session?: OpenPortSession | null
): Promise<{ ok: true; version: string; baseUrl: string }> {
  const suffix = urlIdx ? `/${urlIdx}` : ''
  return request<{ ok: true; version: string; baseUrl: string }>(`/ollama/verify${suffix}`, { method: 'GET' }, session)
}

export async function syncOllamaModels(session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>('/ollama/sync', { method: 'POST' }, session)
}

export async function fetchWorkspaceModel(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceModelResponse> {
  const response = await request<OpenPortWorkspaceModelResponse>(`/workspace/models/${id}`, { method: 'GET' }, session)
  return {
    ...response,
    item: normalizeWorkspaceModel(response.item)
  }
}

export async function createWorkspaceModel(
  input: Partial<Pick<OpenPortWorkspaceModel, 'id'>> &
    Omit<OpenPortWorkspaceModel, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'accessGrants'>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceModelResponse> {
  return request<OpenPortWorkspaceModelResponse>('/workspace/models', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceModel(
  id: string,
  input: Partial<Omit<OpenPortWorkspaceModel, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'accessGrants'>>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceModelResponse> {
  return request<OpenPortWorkspaceModelResponse>(`/workspace/models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspaceModel(id: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/models/${id}`, { method: 'DELETE' }, session)
}

export async function fetchWorkspacePrompts(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspacePrompt>> {
  return request<OpenPortListResponse<OpenPortWorkspacePrompt>>('/workspace/prompts', { method: 'GET' }, session)
}

export async function fetchWorkspacePrompt(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}`, { method: 'GET' }, session)
}

export async function fetchWorkspacePromptVersions(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptVersionsResponse> {
  return request<OpenPortWorkspacePromptVersionsResponse>(`/workspace/prompts/${id}/versions`, { method: 'GET' }, session)
}

export async function createWorkspacePrompt(
  input: (Partial<Pick<OpenPortWorkspacePrompt, 'id' | 'visibility'>> &
    Omit<
      OpenPortWorkspacePrompt,
      | 'id'
      | 'workspaceId'
      | 'createdAt'
      | 'updatedAt'
      | 'productionVersionId'
      | 'publishedVersionId'
      | 'publishedAt'
      | 'communityStatus'
      | 'communitySubmittedVersionId'
      | 'communitySubmittedAt'
      | 'communitySubmissionUrl'
      | 'communitySubmissionNote'
      | 'visibility'
      | 'accessGrants'
    >) & {
      commitMessage?: string
      setAsProduction?: boolean
    },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>('/workspace/prompts', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspacePrompt(
  id: string,
  input: Partial<
    Omit<
      OpenPortWorkspacePrompt,
      | 'id'
      | 'workspaceId'
      | 'createdAt'
      | 'updatedAt'
      | 'productionVersionId'
      | 'publishedVersionId'
      | 'publishedAt'
      | 'communityStatus'
      | 'communitySubmittedVersionId'
      | 'communitySubmittedAt'
      | 'communitySubmissionUrl'
      | 'communitySubmissionNote'
      | 'accessGrants'
    >
  > & {
    commitMessage?: string
    setAsProduction?: boolean
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspacePrompt(id: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/prompts/${id}`, { method: 'DELETE' }, session)
}

export async function restoreWorkspacePromptVersion(
  id: string,
  versionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/versions/${versionId}/restore`, {
    method: 'POST',
    body: JSON.stringify({})
  }, session)
}

export async function setWorkspacePromptProductionVersion(
  id: string,
  versionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/versions/${versionId}/production`, {
    method: 'POST',
    body: JSON.stringify({})
  }, session)
}

export async function publishWorkspacePrompt(
  id: string,
  input: { versionId?: string } = {},
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function unpublishWorkspacePrompt(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({})
  }, session)
}

export async function submitWorkspacePromptCommunity(
  id: string,
  input: {
    versionId?: string
    submissionUrl?: string
    note?: string
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/community/submit`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function retractWorkspacePromptCommunity(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptResponse> {
  return request<OpenPortWorkspacePromptResponse>(`/workspace/prompts/${id}/community/retract`, {
    method: 'POST',
    body: JSON.stringify({})
  }, session)
}

export async function deleteWorkspacePromptVersion(
  id: string,
  versionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspacePromptVersionsResponse> {
  return request<OpenPortWorkspacePromptVersionsResponse>(`/workspace/prompts/${id}/versions/${versionId}`, {
    method: 'DELETE'
  }, session)
}

export async function fetchWorkspaceTools(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceTool>> {
  return request<OpenPortListResponse<OpenPortWorkspaceTool>>('/workspace/tools', { method: 'GET' }, session)
}

export async function fetchWorkspaceTool(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolResponse> {
  return request<OpenPortWorkspaceToolResponse>(`/workspace/tools/${id}`, { method: 'GET' }, session)
}

export async function createWorkspaceTool(
  input: Partial<Pick<OpenPortWorkspaceTool, 'id' | 'tags' | 'examples' | 'executionChain'>> &
    Omit<OpenPortWorkspaceTool, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'tags' | 'examples' | 'executionChain' | 'accessGrants'>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolResponse> {
  return request<OpenPortWorkspaceToolResponse>('/workspace/tools', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceTool(
  id: string,
  input: Partial<Omit<OpenPortWorkspaceTool, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'accessGrants'>>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolResponse> {
  return request<OpenPortWorkspaceToolResponse>(`/workspace/tools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspaceTool(id: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/tools/${id}`, { method: 'DELETE' }, session)
}

export async function validateWorkspaceTool(
  input: {
    name?: string
    description?: string
    integrationId?: string | null
    enabled?: boolean
    scopes?: string[]
    tags?: string[]
    manifest?: string
    valves?: Record<string, string>
    valveSchema?: Array<{
      id?: string
      key?: string
      label?: string
      type?: 'string' | 'number' | 'boolean' | 'json'
      description?: string
      defaultValue?: string
      required?: boolean
    }>
    examples?: Array<{
      id?: string
      name?: string
      input?: string
      output?: string
    }>
    executionChain?: OpenPortWorkspaceTool['executionChain']
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolValidationResponse> {
  return request<OpenPortWorkspaceToolValidationResponse>('/workspace/tools/validate', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchWorkspaceToolPackage(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolPackageResponse> {
  return request<OpenPortWorkspaceToolPackageResponse>(`/workspace/tools/${id}/package`, { method: 'GET' }, session)
}

export async function importWorkspaceToolPackage(
  input: {
    package: OpenPortWorkspaceToolPackage | Record<string, unknown>
    targetToolId?: string
    forceEnable?: boolean
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolPackageImportResponse> {
  return request<OpenPortWorkspaceToolPackageImportResponse>('/workspace/tools/package/import', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function runWorkspaceToolOrchestration(
  id: string,
  input: {
    inputPayload?: string
    debug?: boolean
    stepLimit?: number
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolRunResponse> {
  return request<OpenPortWorkspaceToolRunResponse>(`/workspace/tools/${id}/orchestration/runs`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchWorkspaceToolOrchestrationRuns(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceToolRun>> {
  return request<OpenPortListResponse<OpenPortWorkspaceToolRun>>(
    `/workspace/tools/${id}/orchestration/runs`,
    { method: 'GET' },
    session
  )
}

export async function fetchWorkspaceToolOrchestrationRun(
  id: string,
  runId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolRunResponse> {
  return request<OpenPortWorkspaceToolRunResponse>(
    `/workspace/tools/${id}/orchestration/runs/${runId}`,
    { method: 'GET' },
    session
  )
}

export async function replayWorkspaceToolOrchestrationRun(
  id: string,
  runId: string,
  input: {
    inputPayload?: string
    debug?: boolean
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolRunResponse> {
  return request<OpenPortWorkspaceToolRunResponse>(
    `/workspace/tools/${id}/orchestration/runs/${runId}/replay`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function cancelWorkspaceToolOrchestrationRun(
  id: string,
  runId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceToolRunResponse> {
  return request<OpenPortWorkspaceToolRunResponse>(
    `/workspace/tools/${id}/orchestration/runs/${runId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    session
  )
}

export async function fetchWorkspaceConnectorCredentials(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorCredential>> {
  return request<OpenPortListResponse<OpenPortWorkspaceConnectorCredential>>(
    '/workspace/connectors/credentials',
    { method: 'GET' },
    session
  )
}

export async function createWorkspaceConnectorCredential(
  input: {
    id?: string
    name: string
    provider: OpenPortWorkspaceConnector['adapter']
    description?: string
    fields: Array<{
      key?: string
      label?: string
      secret?: boolean
      value?: string
    }>
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorCredentialResponse> {
  return request<OpenPortWorkspaceConnectorCredentialResponse>('/workspace/connectors/credentials', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceConnectorCredential(
  id: string,
  input: {
    name?: string
    provider?: OpenPortWorkspaceConnector['adapter']
    description?: string
    fields?: Array<{
      key?: string
      label?: string
      secret?: boolean
      value?: string
    }>
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorCredentialResponse> {
  return request<OpenPortWorkspaceConnectorCredentialResponse>(`/workspace/connectors/credentials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspaceConnectorCredential(
  id: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/connectors/credentials/${id}`, { method: 'DELETE' }, session)
}

export async function fetchWorkspaceConnectors(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceConnector>> {
  return request<OpenPortListResponse<OpenPortWorkspaceConnector>>('/workspace/connectors', { method: 'GET' }, session)
}

export async function fetchWorkspaceConnector(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorResponse> {
  return request<OpenPortWorkspaceConnectorResponse>(`/workspace/connectors/${id}`, { method: 'GET' }, session)
}

export async function createWorkspaceConnector(
  input: {
    id?: string
    name: string
    adapter: OpenPortWorkspaceConnector['adapter']
    description?: string
    enabled?: boolean
    credentialId?: string | null
    tags?: string[]
    schedule?: OpenPortWorkspaceConnector['schedule']
    syncPolicy?: OpenPortWorkspaceConnector['syncPolicy']
    sourceConfig?: OpenPortWorkspaceConnector['sourceConfig']
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorResponse> {
  return request<OpenPortWorkspaceConnectorResponse>('/workspace/connectors', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceConnector(
  id: string,
  input: {
    name?: string
    adapter?: OpenPortWorkspaceConnector['adapter']
    description?: string
    enabled?: boolean
    credentialId?: string | null
    tags?: string[]
    schedule?: Partial<OpenPortWorkspaceConnector['schedule']>
    syncPolicy?: Partial<OpenPortWorkspaceConnector['syncPolicy']>
    sourceConfig?: Partial<OpenPortWorkspaceConnector['sourceConfig']>
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorResponse> {
  return request<OpenPortWorkspaceConnectorResponse>(`/workspace/connectors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspaceConnector(id: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/connectors/${id}`, { method: 'DELETE' }, session)
}

export async function triggerWorkspaceConnectorSync(
  id: string,
  input: {
    mode?: OpenPortWorkspaceConnectorTask['mode']
    debug?: boolean
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorTaskResponse> {
  return request<OpenPortWorkspaceConnectorTaskResponse>(`/workspace/connectors/${id}/sync`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchWorkspaceConnectorTasks(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorTask>> {
  return request<OpenPortListResponse<OpenPortWorkspaceConnectorTask>>(
    `/workspace/connectors/${id}/tasks`,
    { method: 'GET' },
    session
  )
}

export async function fetchWorkspaceConnectorTask(
  taskId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorTaskResponse> {
  return request<OpenPortWorkspaceConnectorTaskResponse>(
    `/workspace/connectors/tasks/${taskId}`,
    { method: 'GET' },
    session
  )
}

export async function retryWorkspaceConnectorTask(
  taskId: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceConnectorTaskResponse> {
  return request<OpenPortWorkspaceConnectorTaskResponse>(
    `/workspace/connectors/tasks/${taskId}/retry`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    session
  )
}

export async function fetchWorkspaceConnectorAudit(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorAuditEvent>> {
  return request<OpenPortListResponse<OpenPortWorkspaceConnectorAuditEvent>>(
    `/workspace/connectors/${id}/audit`,
    { method: 'GET' },
    session
  )
}

export async function fetchWorkspaceSkills(
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceSkill>> {
  return request<OpenPortListResponse<OpenPortWorkspaceSkill>>('/workspace/skills', { method: 'GET' }, session)
}

export async function fetchWorkspaceSkill(
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceSkillResponse> {
  return request<OpenPortWorkspaceSkillResponse>(`/workspace/skills/${id}`, { method: 'GET' }, session)
}

export async function createWorkspaceSkill(
  input: Partial<Pick<OpenPortWorkspaceSkill, 'id'>> &
    Omit<OpenPortWorkspaceSkill, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'accessGrants'>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceSkillResponse> {
  return request<OpenPortWorkspaceSkillResponse>('/workspace/skills', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateWorkspaceSkill(
  id: string,
  input: Partial<Omit<OpenPortWorkspaceSkill, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'accessGrants'>>,
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceSkillResponse> {
  return request<OpenPortWorkspaceSkillResponse>(`/workspace/skills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteWorkspaceSkill(id: string, session?: OpenPortSession | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/skills/${id}`, { method: 'DELETE' }, session)
}

export async function fetchWorkspaceResourceAccessGrants(
  module: WorkspaceResourceModule,
  id: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
  return request<OpenPortListResponse<OpenPortWorkspaceResourceGrant>>(
    `/workspace/${module}/${id}/access-grants`,
    { method: 'GET' },
    session
  )
}

export async function shareWorkspaceResource(
  module: WorkspaceResourceModule,
  id: string,
  input: {
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId?: string
    permission: OpenPortWorkspaceResourcePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortWorkspaceResourceGrantResponse> {
  return request<OpenPortWorkspaceResourceGrantResponse>(
    `/workspace/${module}/${id}/access-grants`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    session
  )
}

export async function revokeWorkspaceResourceShare(
  module: WorkspaceResourceModule,
  id: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/workspace/${module}/${id}/access-grants/${grantId}`, { method: 'DELETE' }, session)
}

export async function uploadProjectAsset(
  input: {
    kind: OpenPortProjectAsset['kind']
    name: string
    type?: string
    size?: number
    contentBase64: string
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectAssetResponse> {
  return request<OpenPortProjectAssetResponse>('/projects/assets/upload', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchProjectAssets(
  input: {
    kind?: OpenPortProjectAsset['kind']
    scope?: 'workspace' | 'user'
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortProjectAsset>> {
  const params = new URLSearchParams()
  if (input.kind) params.set('kind', input.kind)
  if (input.scope) params.set('scope', input.scope)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<OpenPortListResponse<OpenPortProjectAsset>>(`/projects/assets${suffix}`, { method: 'GET' }, session)
}

export async function deleteProjectAsset(
  assetId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/projects/assets/${assetId}`, { method: 'DELETE' }, session)
}

export async function createProjectWebAsset(
  input: {
    url: string
    name?: string
    maxChars?: number
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectAssetResponse> {
  return request<OpenPortProjectAssetResponse>('/projects/assets/web', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function fetchProjectAccessGrants(
  projectId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortProjectGrant>> {
  return request<OpenPortListResponse<OpenPortProjectGrant>>(`/projects/${projectId}/access-grants`, { method: 'GET' }, session)
}

export async function shareProject(
  projectId: string,
  input: {
    principalType: OpenPortProjectPrincipalType
    principalId?: string
    permission: OpenPortProjectPermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortProjectGrantResponse> {
  return request<OpenPortProjectGrantResponse>(`/projects/${projectId}/access-grants`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function revokeProjectGrant(
  projectId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/projects/${projectId}/access-grants/${grantId}`, { method: 'DELETE' }, session)
}

export async function searchProjectKnowledge(
  projectId: string,
  query: string,
  limit = 5,
  session?: OpenPortSession | null
): Promise<OpenPortProjectKnowledgeSearchResponse> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  params.set('limit', String(limit))
  return request<OpenPortProjectKnowledgeSearchResponse>(`/projects/${projectId}/knowledge/search?${params.toString()}`, { method: 'GET' }, session)
}

export async function fetchProjectCollaboration(
  projectId: string,
  session?: OpenPortSession | null
): Promise<OpenPortProjectCollaborationState> {
  return request<OpenPortProjectCollaborationState>(`/projects/${projectId}/collaboration`, { method: 'GET' }, session)
}

export async function heartbeatProjectCollaboration(
  projectId: string,
  state: 'viewing' | 'editing',
  session?: OpenPortSession | null
): Promise<OpenPortProjectCollaborationState> {
  return request<OpenPortProjectCollaborationState>(`/projects/${projectId}/collaboration/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ state })
  }, session)
}

export function buildProjectEventsUrl(session?: OpenPortSession | null): string {
  const params = new URLSearchParams()
  if (session?.accessToken) params.set('accessToken', session.accessToken)
  if (session?.userId) params.set('userId', session.userId)
  if (session?.workspaceId) params.set('workspaceId', session.workspaceId)
  return `${getPublicApiBaseUrl()}/projects/events/stream?${params.toString()}`
}

export async function fetchNote(
  noteId: string,
  session?: OpenPortSession | null
): Promise<OpenPortNoteResponse> {
  return request<OpenPortNoteResponse>(`/notes/${noteId}`, { method: 'GET' }, session)
}

export async function createOpenPortNote(
  input: {
    title?: string
    contentMd?: string
    contentHtml?: string | null
    tags?: string[]
  } = {},
  session?: OpenPortSession | null
): Promise<OpenPortNoteResponse> {
  return request<OpenPortNoteResponse>('/notes', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function updateOpenPortNote(
  noteId: string,
  input: {
    title?: string
    contentMd?: string
    contentHtml?: string | null
    pinned?: boolean
    archived?: boolean
    tags?: string[]
  },
  session?: OpenPortSession | null
): Promise<OpenPortNoteResponse> {
  return request<OpenPortNoteResponse>(`/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, session)
}

export async function uploadOpenPortNoteImage(
  input: {
    noteId?: string
    fileName?: string
    dataUrl: string
  },
  session?: OpenPortSession | null
): Promise<{
  asset: {
    fileName: string
    contentType: string
    proxyPath: string
    apiPath: string
  }
}> {
  return request<{
    asset: {
      fileName: string
      contentType: string
      proxyPath: string
      apiPath: string
    }
  }>('/notes/uploads', {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function deleteOpenPortNote(
  noteId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/notes/${noteId}`, { method: 'DELETE' }, session)
}

export async function duplicateOpenPortNote(
  noteId: string,
  session?: OpenPortSession | null
): Promise<OpenPortNoteResponse> {
  return request<OpenPortNoteResponse>(`/notes/${noteId}/duplicate`, { method: 'POST' }, session)
}

export async function restoreOpenPortNoteVersion(
  noteId: string,
  versionId: string,
  session?: OpenPortSession | null
): Promise<OpenPortNoteResponse> {
  return request<OpenPortNoteResponse>(`/notes/${noteId}/restore-version`, {
    method: 'POST',
    body: JSON.stringify({ versionId })
  }, session)
}

export async function fetchOpenPortNoteAccessGrants(
  noteId: string,
  session?: OpenPortSession | null
): Promise<OpenPortListResponse<OpenPortNoteGrant>> {
  return request<OpenPortListResponse<OpenPortNoteGrant>>(`/notes/${noteId}/access-grants`, { method: 'GET' }, session)
}

export async function shareOpenPortNote(
  noteId: string,
  input: {
    principalType: OpenPortNotePrincipalType
    principalId?: string
    permission: OpenPortNotePermission
  },
  session?: OpenPortSession | null
): Promise<OpenPortNoteGrantResponse> {
  return request<OpenPortNoteGrantResponse>(`/notes/${noteId}/access-grants`, {
    method: 'POST',
    body: JSON.stringify(input)
  }, session)
}

export async function revokeOpenPortNoteGrant(
  noteId: string,
  grantId: string,
  session?: OpenPortSession | null
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/notes/${noteId}/access-grants/${grantId}`, { method: 'DELETE' }, session)
}

export async function askOpenPortNoteAssistant(
  noteId: string,
  prompt: string,
  session?: OpenPortSession | null
): Promise<OpenPortNoteAssistantResponse> {
  return request<OpenPortNoteAssistantResponse>(`/notes/${noteId}/assistant`, {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }, session)
}

export async function fetchOpenPortNoteCollaboration(
  noteId: string,
  session?: OpenPortSession | null
): Promise<OpenPortNoteCollaborationState> {
  return request<OpenPortNoteCollaborationState>(`/notes/${noteId}/collaboration`, { method: 'GET' }, session)
}

export async function heartbeatOpenPortNoteCollaboration(
  noteId: string,
  state: 'viewing' | 'editing',
  session?: OpenPortSession | null
): Promise<OpenPortNoteCollaborationState> {
  return request<OpenPortNoteCollaborationState>(`/notes/${noteId}/collaboration/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ state })
  }, session)
}
