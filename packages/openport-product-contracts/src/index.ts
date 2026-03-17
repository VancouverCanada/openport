export type ProductHealthResponse = {
  status: 'ok'
  service: 'openport-api' | 'openport-web' | 'openport-reference-server'
  phase: string
  domainAdapter: 'memory' | 'postgres'
}

export type OpenPortUser = {
  id: string
  email: string
  name: string
  defaultWorkspaceId: string
  createdAt?: string
}

export type OpenPortWorkspace = {
  id: string
  ownerUserId?: string
  name: string
  slug?: string
  createdAt?: string
}

export type OpenPortAuthTokens = {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
}

export type OpenPortAuthResponse = {
  user: OpenPortUser
  workspace: OpenPortWorkspace
  tokens: OpenPortAuthTokens
}

export type OpenPortClientSession = {
  accessToken: string
  refreshToken: string
  userId: string
  workspaceId: string
  email: string
  name: string
}

export type OpenPortCurrentSession = {
  id: string
  createdAt: string
  rememberMe: boolean
}

export type OpenPortWorkspaceModulePermissions = {
  models: boolean
  knowledge: boolean
  prompts: boolean
  tools: boolean
  skills: boolean
}

export type OpenPortWorkspaceModuleCapabilities = {
  read: boolean
  manage: boolean
  import: boolean
  export: boolean
  publish: boolean
  share: boolean
  validate: boolean
}

export type OpenPortWorkspaceResourceCapabilities = {
  models: OpenPortWorkspaceModuleCapabilities
  knowledge: OpenPortWorkspaceModuleCapabilities
  prompts: OpenPortWorkspaceModuleCapabilities
  tools: OpenPortWorkspaceModuleCapabilities
  skills: OpenPortWorkspaceModuleCapabilities
}

export type OpenPortWorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type OpenPortWorkspaceCapabilityRole = 'admin' | 'member' | 'viewer'

export type OpenPortWorkspaceCapabilityPolicy = {
  workspaceId: string
  roles: {
    admin: OpenPortWorkspaceResourceCapabilities
    member: OpenPortWorkspaceResourceCapabilities
    viewer: OpenPortWorkspaceResourceCapabilities
  }
  updatedAt: string
}

export type OpenPortWorkspaceCapabilityPolicyResponse = {
  policy: OpenPortWorkspaceCapabilityPolicy
}

export type OpenPortCurrentUserResponse = {
  user: OpenPortUser
  session: OpenPortCurrentSession
  role: 'admin' | 'member'
  workspaceRole: OpenPortWorkspaceMemberRole
  permissions: {
    workspace: OpenPortWorkspaceModulePermissions
    workspaceCapabilities: OpenPortWorkspaceResourceCapabilities
  }
}

export type OpenPortWorkspaceMember = {
  id: string
  workspaceId: string
  userId: string
  role: OpenPortWorkspaceMemberRole
  createdAt: string
}

export type OpenPortWorkspaceMemberResponse = {
  item: OpenPortWorkspaceMember
}

export type OpenPortWorkspaceInvite = {
  id: string
  workspaceId: string
  email: string
  role: string
  status: 'pending'
  createdAt: string
}

export type OpenPortListResponse<T> = {
  items: T[]
}

export type OpenPortSearchType = 'chat' | 'note'

export type OpenPortSearchResultType =
  | OpenPortSearchType
  | 'model'
  | 'prompt'
  | 'tool'
  | 'skill'
  | 'knowledge'

export type OpenPortSearchField = 'title' | 'excerpt'

export type OpenPortSearchHighlight = {
  field: OpenPortSearchField
  start: number
  end: number
}

export type OpenPortSearchItem = {
  id: string
  type: OpenPortSearchType
  title: string
  excerpt: string
  href: string
  updatedAt: string
  metadata: string | null
  projectId?: string | null
  highlights: OpenPortSearchHighlight[]
}

export type OpenPortSearchResponse = {
  items: OpenPortSearchItem[]
  hasMore: boolean
  nextCursor: string | null
  total: number
}

export type OpenPortSearchTagFacet = {
  tag: string
  count: number
}

export type OpenPortSearchHistoryItem = {
  id: string
  query: string
  createdAt: string
  updatedAt: string
  count: number
  lastResultCount?: number
  topResultType?: OpenPortSearchResultType | null
}

export type OpenPortSearchRecommendation = {
  id: string
  query: string
  label: string
  description: string
  reason?: string
}

export type OpenPortSearchContextResponse = {
  recentSearches: OpenPortSearchHistoryItem[]
  recommendations: OpenPortSearchRecommendation[]
  tags: OpenPortSearchTagFacet[]
  operators: string[]
}

export type OpenPortSearchHistoryResponse = {
  items: OpenPortSearchHistoryItem[]
}

export type OpenPortWorkspaceCreateResponse = {
  workspace: OpenPortWorkspace
}

export type OpenPortWorkspaceUpdateResponse = {
  workspace: OpenPortWorkspace
}

export type OpenPortWorkspaceInviteResponse = {
  invite: OpenPortWorkspaceInvite
}

export type OpenPortWorkspaceDeleteResponse = {
  ok: true
}

export type OpenPortRoleTemplate = {
  id: string
  name: string
  capabilities: string[]
}

export type OpenPortRoleScope = 'workspace' | 'integrations'

export type OpenPortRoleTemplatesResponse = {
  scope: OpenPortRoleScope
  items: OpenPortRoleTemplate[]
}

export type OpenPortRoleAssignment = {
  scope: OpenPortRoleScope
  roleTemplateId: string
  inherited: boolean
}

export type OpenPortRoleAssignmentsResponse = {
  userId: string
  workspaceId: string
  assignments: OpenPortRoleAssignment[]
}

export type OpenPortRuntimeSummary = Record<string, unknown>

export type OpenPortBootstrapResponse = {
  status: string
  runtime: OpenPortRuntimeSummary
  modules: string[]
}

export type OpenPortIntegrationKey = {
  id: string
  name: string
  token_prefix: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export type OpenPortIntegration = {
  id: string
  scope: 'personal' | 'workspace'
  status: 'active' | 'revoked'
  name: string
  description: string | null
  user_id: string | null
  org_id: string | null
  service_user_id: string | null
  scopes: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  keys: OpenPortIntegrationKey[]
}

export type OpenPortChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  attachments?: OpenPortChatAttachment[]
}

export type OpenPortChatAttachment = {
  id: string
  type: 'chat' | 'file' | 'knowledge' | 'note' | 'prompt' | 'web'
  label: string
  meta?: string
  payload: string
  assetId?: string | null
  contentUrl?: string | null
}

export type OpenPortChatSettings = {
  projectId: string | null
  systemPrompt: string
  valves: {
    modelRoute: string
    operatorMode: string
    functionCalling: boolean
  }
  params: {
    streamResponse: boolean
    reasoningEffort: 'low' | 'medium' | 'high'
    temperature: number
    maxTokens: number
    topP: number
  }
}

export type OpenPortChatSession = {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  archived: boolean
  pinned: boolean
  shared?: boolean
  folderId?: string | null
  tags: string[]
  settings: OpenPortChatSettings
  messages: OpenPortChatMessage[]
}

export type OpenPortChatSessionResponse = {
  session: OpenPortChatSession
}

export type OpenPortChatMessagesResponse = {
  session: OpenPortChatSession
  messages: OpenPortChatMessage[]
}

export type OpenPortChatSessionsExportResponse = {
  exportedAt: string
  items: OpenPortChatSession[]
}

export type OpenPortChatSessionsImportResponse = {
  imported: number
  items: OpenPortChatSession[]
}

export type OpenPortProjectKnowledgeItem = {
  id: string
  workspaceId: string
  assetId: string | null
  collectionId: string | null
  collectionName: string
  name: string
  type: string
  size: number
  uploadedAt: string
  source: 'upload' | 'text' | 'append'
  contentUrl: string | null
  contentText: string
  previewText: string
  retrievalState: 'indexed' | 'binary'
  chunkCount: number
  chunkPreview?: OpenPortProjectKnowledgeChunkPreview[]
  sources?: OpenPortProjectKnowledgeSource[]
  accessGrants: OpenPortWorkspaceResourceGrant[]
}

export type OpenPortProjectKnowledgeChunkPreview = {
  id: string
  index: number
  text: string
}

export type OpenPortProjectKnowledgeSource = {
  id: string
  label: string
  kind: 'asset' | 'text'
  source: 'upload' | 'text' | 'append'
  size: number
}

export type OpenPortKnowledgeChunkingOptions = {
  strategy: 'balanced' | 'dense' | 'sparse' | 'semantic'
  chunkSize: number
  overlap: number
  maxChunks: number
}

export type OpenPortKnowledgeCollection = {
  id: string
  workspaceId: string
  name: string
  description: string
  itemCount: number
  updatedAt: string
  accessGrants: OpenPortWorkspaceResourceGrant[]
}

export type OpenPortProjectFile = {
  id: string
  name: string
  type: string
  size: number
  addedAt: number
  selected: boolean
  knowledgeItemId?: string | null
  assetId?: string | null
}

export type OpenPortProjectMeta = {
  backgroundImageUrl: string | null
  backgroundImageAssetId: string | null
  description: string
  icon: string | null
  color: string | null
  hiddenInSidebar: boolean
}

export type OpenPortProjectData = {
  systemPrompt: string
  defaultModelRoute: string | null
  modelRoutes: string[]
  files: OpenPortProjectFile[]
}

export type OpenPortProjectPermission = 'read' | 'write' | 'admin'

export type OpenPortProjectPrincipalType = 'user' | 'workspace' | 'group' | 'public'

export type OpenPortProjectGrant = {
  id: string
  projectId: string
  principalType: OpenPortProjectPrincipalType
  principalId: string
  permission: OpenPortProjectPermission
  createdAt: string
}

export type OpenPortProjectAssetKind = 'background' | 'knowledge' | 'chat' | 'webpage'

export type OpenPortProjectAsset = {
  id: string
  workspaceId: string
  ownerUserId?: string | null
  kind: OpenPortProjectAssetKind
  name: string
  type: string
  size: number
  createdAt: string
  contentUrl: string
  sourceUrl?: string | null
  previewText?: string
}

export type OpenPortProject = {
  id: string
  workspaceId: string
  ownerUserId: string
  name: string
  chatIds: string[]
  createdAt: number
  updatedAt: number
  parentId: string | null
  isExpanded: boolean
  meta: OpenPortProjectMeta
  data: OpenPortProjectData
  accessGrants: OpenPortProjectGrant[]
}

export type OpenPortProjectKnowledgeMatch = {
  itemId: string
  itemName: string
  chunkId: string
  snippet: string
  score: number
}

export type OpenPortProjectKnowledgeChunkMatch = {
  itemId: string
  itemName: string
  chunkId: string
  chunkIndex: number
  snippet: string
  score: number
}

export type OpenPortProjectExportBundle = {
  exportedAt: string
  project: OpenPortProject
  descendants: OpenPortProject[]
  chats: OpenPortChatSession[]
}

export type OpenPortProjectResponse = {
  project: OpenPortProject
}

export type OpenPortProjectImportResponse = {
  project: OpenPortProject
  descendants: OpenPortProject[]
}

export type OpenPortProjectKnowledgeResponse = {
  item: OpenPortProjectKnowledgeItem
}

export type OpenPortKnowledgeCollectionsResponse = {
  items: OpenPortKnowledgeCollection[]
}

export type OpenPortKnowledgeCollectionResponse = {
  item: OpenPortKnowledgeCollection
}

export type OpenPortProjectAssetResponse = {
  asset: OpenPortProjectAsset
}

export type OpenPortDeleteProjectResponse = {
  ok: true
  deletedProjectIds: string[]
  deletedChatIds: string[]
}

export type OpenPortProjectGrantResponse = {
  grant: OpenPortProjectGrant
}

export type OpenPortProjectKnowledgeSearchResponse = {
  items: OpenPortProjectKnowledgeMatch[]
}

export type OpenPortProjectKnowledgeChunkSearchResponse = {
  items: OpenPortProjectKnowledgeChunkMatch[]
  summary?: {
    totalMatches: number
    maxScore: number
    averageScore: number
  }
}

export type OpenPortProjectKnowledgeSourceBatchResponse = {
  sourceId: string
  action: 'reindex' | 'reset' | 'remove' | 'replace' | 'rebuild'
  affectedCount: number
  items: OpenPortProjectKnowledgeItem[]
}

export type OpenPortProjectKnowledgeBatchMaintenanceAction =
  | 'reindex'
  | 'reset'
  | 'rebuild'
  | 'move_collection'
  | 'delete'

export type OpenPortProjectKnowledgeBatchMaintenanceResponse = {
  action: OpenPortProjectKnowledgeBatchMaintenanceAction
  itemIds: string[]
  affectedCount: number
  items: OpenPortProjectKnowledgeItem[]
}

export type OpenPortProjectKnowledgeBatchRebuildResponse = {
  itemIds: string[]
  affectedCount: number
  items: OpenPortProjectKnowledgeItem[]
}

export type OpenPortProjectKnowledgeChunkStatsResponse = {
  summary: {
    totalItems: number
    totalChunks: number
    indexedItems: number
    averageChunkLength: number
    medianChunkLength: number
    thinChunkCount: number
    balancedChunkCount: number
    oversizedChunkCount: number
  }
  topItems: Array<{
    itemId: string
    itemName: string
    chunkCount: number
    retrievalState: 'indexed' | 'binary'
  }>
}

export type OpenPortProjectPresence = {
  userId: string
  name: string
  email: string
  state: 'viewing' | 'editing'
  seenAt: string
}

export type OpenPortProjectCollaborationState = {
  projectId: string
  activeUsers: OpenPortProjectPresence[]
}

export type OpenPortProjectEvent = {
  id: string
  workspaceId: string
  type:
    | 'project.created'
    | 'project.updated'
    | 'project.deleted'
    | 'project.imported'
    | 'knowledge.updated'
    | 'permissions.updated'
    | 'collaboration.updated'
  projectId: string | null
  userId: string | null
  createdAt: string
  payload: Record<string, unknown> | null
}

export type OpenPortWorkspaceGroup = {
  id: string
  workspaceId: string
  name: string
  description: string
  memberUserIds: string[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceGroupResponse = {
  item: OpenPortWorkspaceGroup
}

export type OpenPortNotePermission = 'read' | 'write' | 'admin'

export type OpenPortNotePrincipalType = 'user' | 'workspace' | 'public'

export type OpenPortNoteGrant = {
  id: string
  noteId: string
  principalType: OpenPortNotePrincipalType
  principalId: string
  permission: OpenPortNotePermission
  createdAt: string
}

export type OpenPortNoteVersion = {
  id: string
  noteId: string
  title: string
  contentMd: string
  contentHtml: string | null
  savedAt: string
  savedByUserId: string
}

export type OpenPortNoteAssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type OpenPortNote = {
  id: string
  workspaceId: string
  ownerUserId: string
  title: string
  contentMd: string
  contentHtml: string | null
  excerpt: string
  pinned: boolean
  archived: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  accessGrants: OpenPortNoteGrant[]
  versions: OpenPortNoteVersion[]
  assistantMessages: OpenPortNoteAssistantMessage[]
}

export type OpenPortNoteResponse = {
  note: OpenPortNote
}

export type OpenPortNoteGrantResponse = {
  grant: OpenPortNoteGrant
}

export type OpenPortNoteAssistantResponse = {
  noteId: string
  messages: OpenPortNoteAssistantMessage[]
}

export type OpenPortNotePresence = {
  userId: string
  name: string
  email: string
  state: 'viewing' | 'editing'
  seenAt: string
}

export type OpenPortNoteCollaborationState = {
  noteId: string
  activeUsers: OpenPortNotePresence[]
}

export type OpenPortWorkspaceModelStatus = 'active' | 'disabled'

export type OpenPortWorkspaceModelCapabilities = {
  vision: boolean
  webSearch: boolean
  imageGeneration: boolean
  codeInterpreter: boolean
}

export type OpenPortWorkspacePromptSuggestion = {
  id: string
  title: string
  prompt: string
}

export type OpenPortWorkspaceResourcePermission = 'read' | 'write' | 'admin'

export type OpenPortWorkspaceResourcePrincipalType = 'user' | 'workspace' | 'group' | 'public'

export type OpenPortWorkspaceResourceType =
  | 'model'
  | 'prompt'
  | 'tool'
  | 'skill'
  | 'knowledge_item'
  | 'knowledge_collection'
  | 'knowledge_source'
  | 'knowledge_chunk'

export type OpenPortWorkspaceResourceGrant = {
  id: string
  workspaceId: string
  resourceType: OpenPortWorkspaceResourceType
  resourceId: string
  principalType: OpenPortWorkspaceResourcePrincipalType
  principalId: string
  permission: OpenPortWorkspaceResourcePermission
  createdAt: string
}

export type OpenPortWorkspaceModel = {
  id: string
  workspaceId: string
  name: string
  route: string
  provider: string
  description: string
  tags: string[]
  status: OpenPortWorkspaceModelStatus
  isDefault: boolean
  filterIds: string[]
  defaultFilterIds: string[]
  actionIds: string[]
  defaultFeatureIds: string[]
  capabilities: OpenPortWorkspaceModelCapabilities
  knowledgeItemIds: string[]
  toolIds: string[]
  builtinToolIds: string[]
  skillIds: string[]
  promptSuggestions: OpenPortWorkspacePromptSuggestion[]
  accessGrants: OpenPortWorkspaceResourceGrant[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspacePromptVersion = {
  id: string
  promptId: string
  workspaceId: string
  title: string
  command: string
  description: string
  content: string
  tags: string[]
  versionLabel: string
  commitMessage?: string
  savedAt: string
}

export type OpenPortWorkspacePromptCommunityStatus = 'none' | 'submitted'

export type OpenPortWorkspacePrompt = {
  id: string
  workspaceId: string
  title: string
  command: string
  description: string
  content: string
  tags: string[]
  visibility: 'private' | 'workspace'
  productionVersionId: string | null
  publishedVersionId: string | null
  publishedAt: string | null
  communityStatus: OpenPortWorkspacePromptCommunityStatus
  communitySubmittedVersionId: string | null
  communitySubmittedAt: string | null
  communitySubmissionUrl: string | null
  communitySubmissionNote: string
  accessGrants: OpenPortWorkspaceResourceGrant[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceToolValveSchemaType = 'string' | 'number' | 'boolean' | 'json'

export type OpenPortWorkspaceToolValveSchemaField = {
  id: string
  key: string
  label: string
  type: OpenPortWorkspaceToolValveSchemaType
  description: string
  defaultValue: string
  required: boolean
}

export type OpenPortWorkspaceToolExample = {
  id: string
  name: string
  input: string
  output: string
}

export type OpenPortWorkspaceToolExecutionStepMode = 'sequential' | 'parallel' | 'fallback'

export type OpenPortWorkspaceToolExecutionStepWhen = 'always' | 'on_success' | 'on_error'

export type OpenPortWorkspaceToolExecutionStep = {
  id: string
  toolId: string
  mode: OpenPortWorkspaceToolExecutionStepMode
  when: OpenPortWorkspaceToolExecutionStepWhen
  condition: string
  outputKey: string
}

export type OpenPortWorkspaceToolExecutionChain = {
  enabled: boolean
  steps: OpenPortWorkspaceToolExecutionStep[]
}

export type OpenPortWorkspaceToolRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type OpenPortWorkspaceToolRunStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export type OpenPortWorkspaceToolRunStep = {
  id: string
  chainStepId: string
  toolId: string
  toolName: string
  mode: OpenPortWorkspaceToolExecutionStepMode
  when: OpenPortWorkspaceToolExecutionStepWhen
  condition: string
  conditionMatched: boolean
  branchPath: string
  outputKey: string
  status: OpenPortWorkspaceToolRunStepStatus
  inputSnapshot: string
  outputSnapshot: string
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
}

export type OpenPortWorkspaceToolRun = {
  id: string
  workspaceId: string
  toolId: string
  trigger: 'manual' | 'replay' | 'api'
  status: OpenPortWorkspaceToolRunStatus
  debug: boolean
  replayOfRunId: string | null
  inputPayload: string
  outputPayload: string
  errorMessage: string | null
  steps: OpenPortWorkspaceToolRunStep[]
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceTool = {
  id: string
  workspaceId: string
  name: string
  description: string
  integrationId: string | null
  enabled: boolean
  scopes: string[]
  tags: string[]
  manifest: string
  valves: Record<string, string>
  valveSchema: OpenPortWorkspaceToolValveSchemaField[]
  examples: OpenPortWorkspaceToolExample[]
  executionChain: OpenPortWorkspaceToolExecutionChain
  accessGrants: OpenPortWorkspaceResourceGrant[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceConnectorAdapter = 'directory' | 'web' | 's3' | 'github' | 'notion' | 'rss'

export type OpenPortWorkspaceConnectorSyncMode = 'full' | 'incremental'

export type OpenPortWorkspaceConnectorTaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type OpenPortWorkspaceConnectorSchedule = {
  enabled: boolean
  intervalMinutes: number
  timezone: string
  incremental: boolean
  nextRunAt: string | null
}

export type OpenPortWorkspaceConnectorSyncPolicy = {
  autoRetry: boolean
  maxRetries: number
  retryBackoffSeconds: number
  maxDocumentsPerRun: number
}

export type OpenPortWorkspaceConnectorSourceConfig = {
  directoryPath: string
  urls: string[]
  bucket: string
  prefix: string
  repository: string
  branch: string
  notionDatabaseId: string
  rssFeedUrls: string[]
  includePatterns: string[]
  excludePatterns: string[]
}

export type OpenPortWorkspaceConnectorStatus = {
  health: 'idle' | 'running' | 'ok' | 'error'
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastTaskId: string | null
  lastErrorMessage: string | null
}

export type OpenPortWorkspaceConnector = {
  id: string
  workspaceId: string
  name: string
  adapter: OpenPortWorkspaceConnectorAdapter
  description: string
  enabled: boolean
  credentialId: string | null
  tags: string[]
  schedule: OpenPortWorkspaceConnectorSchedule
  syncPolicy: OpenPortWorkspaceConnectorSyncPolicy
  sourceConfig: OpenPortWorkspaceConnectorSourceConfig
  status: OpenPortWorkspaceConnectorStatus
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceConnectorCredentialField = {
  key: string
  label: string
  secret: boolean
  configured: boolean
  valuePreview: string
}

export type OpenPortWorkspaceConnectorCredential = {
  id: string
  workspaceId: string
  name: string
  provider: OpenPortWorkspaceConnectorAdapter
  description: string
  fields: OpenPortWorkspaceConnectorCredentialField[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceConnectorTaskSummary = {
  scanned: number
  created: number
  updated: number
  removed: number
  errors: number
}

export type OpenPortWorkspaceConnectorTask = {
  id: string
  workspaceId: string
  connectorId: string
  trigger: 'manual' | 'schedule' | 'retry'
  mode: OpenPortWorkspaceConnectorSyncMode
  status: OpenPortWorkspaceConnectorTaskStatus
  attempt: number
  maxAttempts: number
  scheduledAt: string
  startedAt: string | null
  finishedAt: string | null
  retryOfTaskId: string | null
  nextRetryAt: string | null
  errorMessage: string | null
  summary: OpenPortWorkspaceConnectorTaskSummary
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceConnectorAuditLevel = 'info' | 'warn' | 'error'

export type OpenPortWorkspaceConnectorAuditEvent = {
  id: string
  workspaceId: string
  connectorId: string
  taskId: string | null
  level: OpenPortWorkspaceConnectorAuditLevel
  action: string
  message: string
  detail: string
  createdAt: string
}

export type OpenPortWorkspaceToolValidationResponse = {
  valid: boolean
  errors: string[]
  warnings: string[]
  parsedManifest: Record<string, string>
  schemaCoverage: {
    schemaFields: number
    requiredFields: number
    fieldsWithDefaults: number
    valvesBound: number
    missingRequired: string[]
    unknownValves: string[]
  }
}

export type OpenPortWorkspaceToolPackage = {
  metadata: {
    schemaVersion: 1
    source: 'openport-workspace-tool'
    sourceToolId: string | null
    sourceWorkspaceId: string
    exportedAt: string
    checksum: string
  }
  tool: {
    name: string
    description: string
    integrationId: string | null
    enabled: boolean
    scopes: string[]
    tags: string[]
    manifest: string
    valves: Record<string, string>
    valveSchema: OpenPortWorkspaceToolValveSchemaField[]
    examples: OpenPortWorkspaceToolExample[]
    executionChain: OpenPortWorkspaceToolExecutionChain
  }
  validation: OpenPortWorkspaceToolValidationResponse
}

export type OpenPortWorkspaceSkill = {
  id: string
  workspaceId: string
  name: string
  description: string
  content: string
  tags: string[]
  enabled: boolean
  linkedModelIds: string[]
  linkedToolIds: string[]
  accessGrants: OpenPortWorkspaceResourceGrant[]
  createdAt: string
  updatedAt: string
}

export type OpenPortWorkspaceModelResponse = {
  item: OpenPortWorkspaceModel
}

export type OpenPortWorkspacePromptResponse = {
  item: OpenPortWorkspacePrompt
}

export type OpenPortWorkspacePromptVersionsResponse = {
  items: OpenPortWorkspacePromptVersion[]
}

export type OpenPortWorkspaceToolResponse = {
  item: OpenPortWorkspaceTool
}

export type OpenPortWorkspaceToolPackageResponse = {
  package: OpenPortWorkspaceToolPackage
}

export type OpenPortWorkspaceToolPackageImportResponse = {
  item: OpenPortWorkspaceTool
  validation: OpenPortWorkspaceToolValidationResponse
}

export type OpenPortWorkspaceToolRunResponse = {
  item: OpenPortWorkspaceToolRun
}

export type OpenPortWorkspaceConnectorResponse = {
  item: OpenPortWorkspaceConnector
}

export type OpenPortWorkspaceConnectorCredentialResponse = {
  item: OpenPortWorkspaceConnectorCredential
}

export type OpenPortWorkspaceConnectorTaskResponse = {
  item: OpenPortWorkspaceConnectorTask
}

export type OpenPortWorkspaceSkillResponse = {
  item: OpenPortWorkspaceSkill
}

export type OpenPortWorkspaceResourceGrantResponse = {
  grant: OpenPortWorkspaceResourceGrant
}
