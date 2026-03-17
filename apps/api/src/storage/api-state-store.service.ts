import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type {
  OpenPortChatAttachment,
  OpenPortChatSession,
  OpenPortKnowledgeCollection,
  OpenPortProject,
  OpenPortProjectAsset,
  OpenPortProjectData,
  OpenPortProjectFile,
  OpenPortProjectGrant,
  OpenPortProjectKnowledgeChunkPreview,
  OpenPortProjectKnowledgeItem,
  OpenPortProjectKnowledgeSource,
  OpenPortWorkspaceConnector,
  OpenPortWorkspaceConnectorAuditEvent,
  OpenPortWorkspaceConnectorCredential,
  OpenPortWorkspaceConnectorTask,
  OpenPortProjectMeta,
  OpenPortWorkspaceModelCapabilities,
  OpenPortWorkspaceModel,
  OpenPortWorkspacePromptSuggestion,
  OpenPortWorkspacePrompt,
  OpenPortWorkspacePromptVersion,
  OpenPortWorkspaceResourceGrant,
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType,
  OpenPortWorkspaceResourceType,
  OpenPortWorkspaceSkill,
  OpenPortWorkspaceToolRun,
  OpenPortWorkspaceGroup,
  OpenPortWorkspaceToolExample,
  OpenPortWorkspaceTool,
  OpenPortWorkspaceToolValveSchemaField,
  OpenPortSearchHistoryItem
} from '@openport/product-contracts'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

type ProductApiState = {
  version: 18
  chatSessionsByUser: Record<string, OpenPortChatSession[]>
  projectsByWorkspace: Record<string, OpenPortProject[]>
  knowledgeItemsByWorkspace: Record<string, OpenPortProjectKnowledgeItem[]>
  knowledgeCollectionsByWorkspace: Record<string, OpenPortKnowledgeCollection[]>
  projectAssetsByWorkspace: Record<string, OpenPortProjectAsset[]>
  knowledgeChunksByWorkspace: Record<string, ProjectKnowledgeChunkRecord[]>
  denseKnowledgeChunksByWorkspace: Record<string, ProjectDenseKnowledgeChunkRecord[]>
  knowledgeSourceGrantsByWorkspace: Record<string, OpenPortWorkspaceResourceGrant[]>
  knowledgeChunkGrantsByWorkspace: Record<string, OpenPortWorkspaceResourceGrant[]>
  workspaceGroupsByWorkspace: Record<string, OpenPortWorkspaceGroup[]>
  workspaceModelsByWorkspace: Record<string, OpenPortWorkspaceModel[]>
  workspacePromptsByWorkspace: Record<string, OpenPortWorkspacePrompt[]>
  workspacePromptVersionsByWorkspace: Record<string, OpenPortWorkspacePromptVersion[]>
  workspaceSkillsByWorkspace: Record<string, OpenPortWorkspaceSkill[]>
  workspaceToolsByWorkspace: Record<string, OpenPortWorkspaceTool[]>
  workspaceConnectorCredentialsByWorkspace: Record<string, OpenPortWorkspaceConnectorCredential[]>
  workspaceConnectorsByWorkspace: Record<string, OpenPortWorkspaceConnector[]>
  workspaceConnectorTasksByWorkspace: Record<string, OpenPortWorkspaceConnectorTask[]>
  workspaceConnectorAuditEventsByWorkspace: Record<string, OpenPortWorkspaceConnectorAuditEvent[]>
  workspaceToolRunsByWorkspace: Record<string, OpenPortWorkspaceToolRun[]>
  searchHistoryByScope: Record<string, OpenPortSearchHistoryItem[]>
  ollamaConfigByWorkspace: Record<string, OllamaWorkspaceConfig>
}

type OllamaWorkspaceConfig = {
  enabled: boolean
  baseUrls: string[]
  updatedAt: string
}

export type ProjectKnowledgeChunkRecord = {
  id: string
  workspaceId: string
  itemId: string
  text: string
  vector: Record<string, number>
}

export type ProjectDenseKnowledgeChunkRecord = {
  id: string
  workspaceId: string
  itemId: string
  text: string
  vector: number[]
}

type PersistenceBackend = 'file' | 'postgres'

function normalizeVector(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((result, [token, score]) => {
    const numericScore =
      typeof score === 'number'
        ? score
        : typeof score === 'string'
          ? Number(score)
          : Number.NaN

    if (Number.isFinite(numericScore)) {
      result[token] = numericScore
    }

    return result
  }, {})
}

function normalizeDenseVector(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : Number.NaN))
    .filter((entry) => Number.isFinite(entry))
}

function normalizeChatSession(session: OpenPortChatSession): OpenPortChatSession {
  const normalizedTags = Array.isArray(session.tags) ? session.tags.filter((tag) => typeof tag === 'string') : []
  const inferredShared = normalizedTags.some((tag) => {
    const lowered = tag.toLowerCase()
    return lowered === 'shared' || lowered === 'public'
  })
  const normalizedFolderId =
    typeof session.folderId === 'string' && session.folderId.trim().length > 0
      ? session.folderId.trim()
      : session.settings?.projectId ?? null

  return {
    ...session,
    archived: typeof session.archived === 'boolean' ? session.archived : false,
    pinned: typeof session.pinned === 'boolean' ? session.pinned : false,
    shared: typeof session.shared === 'boolean' ? session.shared : inferredShared,
    folderId: normalizedFolderId,
    tags: normalizedTags,
    settings: {
      projectId: normalizedFolderId,
      systemPrompt: session.settings?.systemPrompt ?? '',
      valves: {
        modelRoute: session.settings?.valves?.modelRoute ?? 'openport/local',
        operatorMode: session.settings?.valves?.operatorMode ?? 'default',
        functionCalling: session.settings?.valves?.functionCalling ?? true
      },
      params: {
        streamResponse: session.settings?.params?.streamResponse ?? true,
        reasoningEffort: session.settings?.params?.reasoningEffort ?? 'medium',
        temperature: session.settings?.params?.temperature ?? 0.7,
        maxTokens: session.settings?.params?.maxTokens ?? 2048,
        topP: session.settings?.params?.topP ?? 0.9
      }
    },
    messages: Array.isArray(session.messages)
      ? session.messages.map((message) => ({
          ...message,
          attachments: normalizeChatAttachments(message.attachments)
        }))
      : []
  }
}

function normalizeChatAttachments(input: OpenPortChatAttachment[] | undefined | null): OpenPortChatAttachment[] {
  if (!Array.isArray(input)) return []

  return input
    .map((attachment, index) => ({
      id: typeof attachment?.id === 'string' && attachment.id.trim() ? attachment.id : `attachment_${index}`,
      type:
        attachment?.type === 'chat' ||
        attachment?.type === 'file' ||
        attachment?.type === 'knowledge' ||
        attachment?.type === 'note' ||
        attachment?.type === 'prompt' ||
        attachment?.type === 'web'
          ? attachment.type
          : 'file',
      label: typeof attachment?.label === 'string' && attachment.label.trim() ? attachment.label.trim() : `Attachment ${index + 1}`,
      meta: typeof attachment?.meta === 'string' && attachment.meta.trim() ? attachment.meta.trim() : undefined,
      payload: typeof attachment?.payload === 'string' ? attachment.payload : '',
      assetId: typeof attachment?.assetId === 'string' && attachment.assetId.trim() ? attachment.assetId.trim() : null,
      contentUrl:
        typeof attachment?.contentUrl === 'string' && attachment.contentUrl.trim() ? attachment.contentUrl.trim() : null
    }))
    .filter((attachment) => attachment.payload.length > 0 || attachment.assetId || attachment.contentUrl)
}

function normalizeSearchHistoryEntry(item: OpenPortSearchHistoryItem): OpenPortSearchHistoryItem | null {
  const query = typeof item.query === 'string' ? item.query.trim() : ''
  if (!query) return null

  const createdAt = typeof item.createdAt === 'string' && item.createdAt.trim() ? item.createdAt : new Date().toISOString()
  const updatedAt = typeof item.updatedAt === 'string' && item.updatedAt.trim() ? item.updatedAt : createdAt
  const count = Number.isFinite(item.count) && item.count > 0 ? Math.floor(item.count) : 1
  const topResultType =
    item.topResultType === 'chat' ||
    item.topResultType === 'note' ||
    item.topResultType === 'model' ||
    item.topResultType === 'prompt' ||
    item.topResultType === 'tool' ||
    item.topResultType === 'skill' ||
    item.topResultType === 'knowledge'
      ? item.topResultType
      : null
  const lastResultCount = Number.isFinite(item.lastResultCount)
    ? Math.max(0, Math.floor(item.lastResultCount as number))
    : undefined

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `search_history_${Date.now()}`,
    query,
    createdAt,
    updatedAt,
    count,
    lastResultCount,
    topResultType
  }
}

function buildSearchHistoryScopeKey(workspaceId: string, userId: string): string {
  return `${workspaceId}::${userId}`
}

function createEmptyState(): ProductApiState {
  return {
    version: 18,
    chatSessionsByUser: {},
    projectsByWorkspace: {},
    knowledgeItemsByWorkspace: {},
    knowledgeCollectionsByWorkspace: {},
    projectAssetsByWorkspace: {},
    knowledgeChunksByWorkspace: {},
    denseKnowledgeChunksByWorkspace: {},
    knowledgeSourceGrantsByWorkspace: {},
    knowledgeChunkGrantsByWorkspace: {},
    workspaceGroupsByWorkspace: {},
    workspaceModelsByWorkspace: {},
    workspacePromptsByWorkspace: {},
    workspacePromptVersionsByWorkspace: {},
    workspaceSkillsByWorkspace: {},
    workspaceToolsByWorkspace: {},
    workspaceConnectorCredentialsByWorkspace: {},
    workspaceConnectorsByWorkspace: {},
    workspaceConnectorTasksByWorkspace: {},
    workspaceConnectorAuditEventsByWorkspace: {},
    workspaceToolRunsByWorkspace: {},
    searchHistoryByScope: {},
    ollamaConfigByWorkspace: {}
  }
}

function normalizeKnowledgeCollection(collection: OpenPortKnowledgeCollection): OpenPortKnowledgeCollection {
  return {
    id: collection.id,
    workspaceId: collection.workspaceId,
    name: collection.name.trim() || 'General',
    description: collection.description ?? '',
    itemCount: typeof collection.itemCount === 'number' ? collection.itemCount : 0,
    updatedAt: collection.updatedAt,
    accessGrants: normalizeWorkspaceResourceGrants(
      'knowledge_collection',
      collection.id,
      collection.workspaceId,
      collection.accessGrants
    )
  }
}

function normalizeModelCapabilities(
  capabilities: OpenPortWorkspaceModelCapabilities | null | undefined
): OpenPortWorkspaceModelCapabilities {
  return {
    vision: Boolean(capabilities?.vision),
    webSearch: Boolean(capabilities?.webSearch),
    imageGeneration: Boolean(capabilities?.imageGeneration),
    codeInterpreter: Boolean(capabilities?.codeInterpreter)
  }
}

function normalizePromptSuggestions(
  suggestions: OpenPortWorkspacePromptSuggestion[] | undefined | null
): OpenPortWorkspacePromptSuggestion[] {
  if (!Array.isArray(suggestions)) return []

  return suggestions
    .map((suggestion, index) => ({
      id: suggestion?.id?.trim() || `suggestion_${index}`,
      title: suggestion?.title?.trim() || `Suggestion ${index + 1}`,
      prompt: suggestion?.prompt?.trim() || ''
    }))
    .filter((suggestion) => suggestion.prompt.length > 0)
}

function normalizeProjectFile(file: OpenPortProjectFile): OpenPortProjectFile {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    addedAt: file.addedAt,
    selected: file.selected,
    knowledgeItemId: file.knowledgeItemId ?? null,
    assetId: file.assetId ?? null
  }
}

function normalizeProjectMeta(meta: OpenPortProjectMeta | null | undefined): OpenPortProjectMeta {
  return {
    backgroundImageUrl: meta?.backgroundImageUrl ?? null,
    backgroundImageAssetId: meta?.backgroundImageAssetId ?? null,
    description: meta?.description ?? '',
    icon: meta?.icon ?? null,
    color: meta?.color ?? null,
    hiddenInSidebar: Boolean(meta?.hiddenInSidebar)
  }
}

function normalizeProjectModelRoutes(modelRoutes: string[] | null | undefined): string[] {
  if (!Array.isArray(modelRoutes)) return []

  const uniqueRoutes = new Set<string>()
  for (const route of modelRoutes) {
    if (typeof route !== 'string') continue
    const normalizedRoute = route.trim()
    if (!normalizedRoute) continue
    uniqueRoutes.add(normalizedRoute)
  }

  return Array.from(uniqueRoutes)
}

function normalizeProjectData(data: OpenPortProjectData | null | undefined): OpenPortProjectData {
  const normalizedDefaultModelRoute =
    typeof data?.defaultModelRoute === 'string' && data.defaultModelRoute.trim().length > 0
      ? data.defaultModelRoute.trim()
      : null
  const modelRoutes = normalizeProjectModelRoutes([
    ...(Array.isArray(data?.modelRoutes) ? data.modelRoutes : []),
    normalizedDefaultModelRoute || ''
  ])
  const defaultModelRoute = normalizedDefaultModelRoute || modelRoutes[0] || null

  return {
    systemPrompt: data?.systemPrompt ?? '',
    defaultModelRoute,
    modelRoutes,
    files: Array.isArray(data?.files) ? data.files.map((file) => normalizeProjectFile(file)) : []
  }
}

function normalizeProjectGrant(projectId: string, grant: OpenPortProjectGrant): OpenPortProjectGrant {
  return {
    id: grant.id,
    projectId,
    principalType: grant.principalType,
    principalId: grant.principalId,
    permission: grant.permission,
    createdAt: grant.createdAt
  }
}

function normalizeWorkspaceResourceGrant(
  resourceType: OpenPortWorkspaceResourceType,
  resourceId: string,
  workspaceId: string,
  grant: OpenPortWorkspaceResourceGrant
): OpenPortWorkspaceResourceGrant | null {
  const principalType: OpenPortWorkspaceResourcePrincipalType =
    grant.principalType === 'workspace' || grant.principalType === 'group' || grant.principalType === 'public'
      ? grant.principalType
      : 'user'

  const principalId =
    principalType === 'workspace'
      ? workspaceId
      : principalType === 'public'
        ? '*'
        : typeof grant.principalId === 'string'
          ? grant.principalId.trim()
          : ''

  if (!principalId) {
    return null
  }

  const permission: OpenPortWorkspaceResourcePermission =
    grant.permission === 'admin' || grant.permission === 'write' ? grant.permission : 'read'

  return {
    id: typeof grant.id === 'string' ? grant.id : `workspace_resource_grant_${resourceType}_${resourceId}_${Date.now()}`,
    workspaceId,
    resourceType,
    resourceId,
    principalType,
    principalId,
    permission,
    createdAt: typeof grant.createdAt === 'string' ? grant.createdAt : new Date().toISOString()
  }
}

function normalizeWorkspaceResourceGrants(
  resourceType: OpenPortWorkspaceResourceType,
  resourceId: string,
  workspaceId: string,
  grants: OpenPortWorkspaceResourceGrant[] | undefined | null
): OpenPortWorkspaceResourceGrant[] {
  const normalized = Array.isArray(grants)
    ? grants
        .map((grant) => normalizeWorkspaceResourceGrant(resourceType, resourceId, workspaceId, grant))
        .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))
    : []

  if (normalized.length > 0) {
    return normalized
  }

  return [
    {
      id: `workspace_resource_grant_${resourceType}_${resourceId}`,
      workspaceId,
      resourceType,
      resourceId,
      principalType: 'workspace',
      principalId: workspaceId,
      permission: 'admin',
      createdAt: new Date().toISOString()
    }
  ]
}

function normalizeProject(project: OpenPortProject): OpenPortProject {
  return {
    ...project,
    workspaceId: project.workspaceId,
    ownerUserId: project.ownerUserId,
    name: project.name.trim() || 'Untitled project',
    chatIds: Array.isArray(project.chatIds) ? project.chatIds.filter((value) => typeof value === 'string') : [],
    createdAt: typeof project.createdAt === 'number' ? project.createdAt : Date.now(),
    updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : Date.now(),
    parentId: project.parentId ?? null,
    isExpanded: typeof project.isExpanded === 'boolean' ? project.isExpanded : true,
    meta: normalizeProjectMeta(project.meta),
    data: normalizeProjectData(project.data),
    accessGrants: Array.isArray(project.accessGrants)
      ? project.accessGrants.map((grant) => normalizeProjectGrant(project.id, grant))
      : []
  }
}

function normalizeKnowledgeItem(item: OpenPortProjectKnowledgeItem): OpenPortProjectKnowledgeItem {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    assetId: item.assetId ?? null,
    collectionId: item.collectionId ?? null,
    collectionName: item.collectionName?.trim() || 'General',
    name: item.name,
    type: item.type,
    size: item.size,
    uploadedAt: item.uploadedAt,
    source: item.source === 'text' ? 'text' : item.source === 'append' ? 'append' : 'upload',
    contentUrl: item.contentUrl ?? null,
    contentText: item.contentText ?? '',
    previewText: item.previewText ?? '',
    retrievalState: item.retrievalState === 'indexed' ? 'indexed' : 'binary',
    chunkCount: typeof item.chunkCount === 'number' ? item.chunkCount : 0,
    chunkPreview: normalizeKnowledgeChunkPreview(item.chunkPreview),
    sources: normalizeKnowledgeSources(item.sources, item),
    accessGrants: normalizeWorkspaceResourceGrants('knowledge_item', item.id, item.workspaceId, item.accessGrants)
  }
}

function normalizeKnowledgeChunkPreview(
  input: OpenPortProjectKnowledgeChunkPreview[] | undefined | null
): OpenPortProjectKnowledgeChunkPreview[] {
  if (!Array.isArray(input)) return []
  return input
    .map((chunk, index) => ({
      id: chunk?.id?.trim() || `chunk_preview_${index}`,
      index: typeof chunk?.index === 'number' ? chunk.index : index,
      text: chunk?.text?.trim() || ''
    }))
    .filter((chunk) => chunk.text.length > 0)
}

function normalizeKnowledgeSources(
  input: OpenPortProjectKnowledgeSource[] | undefined | null,
  item: OpenPortProjectKnowledgeItem
): OpenPortProjectKnowledgeSource[] {
  if (!Array.isArray(input)) {
    return [
      {
        id: item.assetId || `${item.id}_source`,
        label: item.name,
        kind: item.assetId ? 'asset' : 'text',
        source: item.source,
        size: item.size
      } satisfies OpenPortProjectKnowledgeSource
    ]
  }

  return input
    .map((source, index) => ({
      id: source?.id?.trim() || `${item.id}_source_${index}`,
      label: source?.label?.trim() || item.name,
      kind: source?.kind === 'asset' ? 'asset' : 'text',
      source: source?.source === 'append' ? 'append' : source?.source === 'text' ? 'text' : 'upload',
      size: typeof source?.size === 'number' ? source.size : item.size
    }) satisfies OpenPortProjectKnowledgeSource)
    .filter((source) => source.label.length > 0)
}

function normalizeProjectAsset(asset: OpenPortProjectAsset): OpenPortProjectAsset {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    ownerUserId: asset.ownerUserId ?? null,
    kind: asset.kind,
    name: asset.name,
    type: asset.type,
    size: asset.size,
    createdAt: asset.createdAt,
    contentUrl: asset.contentUrl,
    sourceUrl: asset.sourceUrl ?? null,
    previewText: asset.previewText ?? ''
  }
}

function normalizeWorkspaceModel(model: OpenPortWorkspaceModel): OpenPortWorkspaceModel {
  return {
    id: model.id,
    workspaceId: model.workspaceId,
    name: model.name.trim() || 'Untitled model',
    route: model.route.trim() || 'openport/local',
    provider: model.provider.trim() || 'openport',
    description: model.description ?? '',
    tags: Array.isArray(model.tags) ? model.tags.filter((tag) => typeof tag === 'string') : [],
    status: model.status === 'disabled' ? 'disabled' : 'active',
    isDefault: Boolean(model.isDefault),
    filterIds: Array.isArray(model.filterIds) ? model.filterIds.filter((value) => typeof value === 'string') : [],
    defaultFilterIds: Array.isArray(model.defaultFilterIds)
      ? model.defaultFilterIds.filter((value) => typeof value === 'string')
      : [],
    actionIds: Array.isArray(model.actionIds) ? model.actionIds.filter((value) => typeof value === 'string') : [],
    defaultFeatureIds: Array.isArray(model.defaultFeatureIds)
      ? model.defaultFeatureIds.filter((value) => typeof value === 'string')
      : [],
    capabilities: normalizeModelCapabilities(model.capabilities),
    knowledgeItemIds: Array.isArray(model.knowledgeItemIds)
      ? model.knowledgeItemIds.filter((value) => typeof value === 'string')
      : [],
    toolIds: Array.isArray(model.toolIds) ? model.toolIds.filter((value) => typeof value === 'string') : [],
    builtinToolIds: Array.isArray(model.builtinToolIds)
      ? model.builtinToolIds.filter((value) => typeof value === 'string')
      : [],
    skillIds: Array.isArray(model.skillIds) ? model.skillIds.filter((value) => typeof value === 'string') : [],
    promptSuggestions: normalizePromptSuggestions(model.promptSuggestions),
    accessGrants: normalizeWorkspaceResourceGrants('model', model.id, model.workspaceId, model.accessGrants),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  }
}

function normalizeWorkspacePrompt(prompt: OpenPortWorkspacePrompt): OpenPortWorkspacePrompt {
  return {
    id: prompt.id,
    workspaceId: prompt.workspaceId,
    title: prompt.title.trim() || 'Untitled prompt',
    command: prompt.command.trim() || '/untitled',
    description: prompt.description ?? '',
    content: prompt.content ?? '',
    tags: Array.isArray(prompt.tags) ? prompt.tags.filter((tag) => typeof tag === 'string') : [],
    visibility: prompt.visibility === 'private' ? 'private' : 'workspace',
    productionVersionId: prompt.productionVersionId?.trim() || null,
    publishedVersionId: prompt.publishedVersionId?.trim() || null,
    publishedAt: prompt.publishedAt || null,
    communityStatus: prompt.communityStatus === 'submitted' ? 'submitted' : 'none',
    communitySubmittedVersionId: prompt.communitySubmittedVersionId?.trim() || null,
    communitySubmittedAt: prompt.communitySubmittedAt || null,
    communitySubmissionUrl: prompt.communitySubmissionUrl?.trim() || null,
    communitySubmissionNote: prompt.communitySubmissionNote ?? '',
    accessGrants: normalizeWorkspaceResourceGrants('prompt', prompt.id, prompt.workspaceId, prompt.accessGrants),
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt
  }
}

function normalizeWorkspacePromptVersion(version: OpenPortWorkspacePromptVersion): OpenPortWorkspacePromptVersion {
  return {
    id: version.id,
    promptId: version.promptId,
    workspaceId: version.workspaceId,
    title: version.title.trim() || 'Untitled prompt',
    command: version.command.trim() || '/untitled',
    description: version.description ?? '',
    content: version.content ?? '',
    tags: Array.isArray(version.tags) ? version.tags.filter((tag) => typeof tag === 'string') : [],
    versionLabel: version.versionLabel?.trim() || 'Version',
    commitMessage: version.commitMessage?.trim() || '',
    savedAt: version.savedAt
  }
}

function normalizeWorkspaceTool(tool: OpenPortWorkspaceTool): OpenPortWorkspaceTool {
  return {
    id: tool.id,
    workspaceId: tool.workspaceId,
    name: tool.name.trim() || 'Untitled tool',
    description: tool.description ?? '',
    integrationId: tool.integrationId ?? null,
    enabled: Boolean(tool.enabled),
    scopes: Array.isArray(tool.scopes) ? tool.scopes.filter((scope) => typeof scope === 'string') : [],
    tags: Array.isArray(tool.tags) ? tool.tags.filter((tag) => typeof tag === 'string') : [],
    manifest: tool.manifest ?? '',
    valves:
      tool.valves && typeof tool.valves === 'object' && !Array.isArray(tool.valves)
        ? Object.entries(tool.valves).reduce<Record<string, string>>((result, [key, value]) => {
            if (typeof value === 'string') result[key] = value
            return result
          }, {})
        : {},
    valveSchema: normalizeWorkspaceToolValveSchema(tool.valveSchema),
    examples: normalizeWorkspaceToolExamples(tool.examples),
    executionChain: normalizeWorkspaceToolExecutionChain(tool.executionChain),
    accessGrants: normalizeWorkspaceResourceGrants('tool', tool.id, tool.workspaceId, tool.accessGrants),
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt
  }
}

function normalizeWorkspaceToolExamples(
  input: OpenPortWorkspaceToolExample[] | undefined | null
): OpenPortWorkspaceToolExample[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((example, index) => ({
      id: example?.id?.trim() || `tool_example_${index}`,
      name: example?.name?.trim() || `Example ${index + 1}`,
      input: example?.input ?? '',
      output: example?.output ?? ''
    }))
      .filter((example) => example.name.length > 0)
}

function normalizeWorkspaceToolExecutionChain(
  input: OpenPortWorkspaceTool['executionChain'] | undefined | null
): OpenPortWorkspaceTool['executionChain'] {
  if (!input || typeof input !== 'object') {
    return {
      enabled: false,
      steps: []
    }
  }

  const steps = Array.isArray(input.steps)
    ? input.steps
        .map((step, index) => {
          const mode: OpenPortWorkspaceTool['executionChain']['steps'][number]['mode'] =
            step?.mode === 'parallel' || step?.mode === 'fallback' ? step.mode : 'sequential'
          const when: OpenPortWorkspaceTool['executionChain']['steps'][number]['when'] =
            step?.when === 'on_success' || step?.when === 'on_error' ? step.when : 'always'
          return {
            id: step?.id?.trim() || `tool_chain_step_${index}`,
            toolId: step?.toolId?.trim() || '',
            mode,
            when,
            condition: step?.condition?.trim() || '',
            outputKey: step?.outputKey?.trim() || ''
          }
        })
        .filter((step) => step.toolId.length > 0)
    : []

  return {
    enabled: Boolean(input.enabled),
    steps
  }
}

function normalizeWorkspaceSkill(skill: OpenPortWorkspaceSkill): OpenPortWorkspaceSkill {
  return {
    id: skill.id,
    workspaceId: skill.workspaceId,
    name: skill.name.trim() || 'Untitled skill',
    description: skill.description ?? '',
    content: skill.content ?? '',
    tags: Array.isArray(skill.tags) ? skill.tags.filter((tag) => typeof tag === 'string') : [],
    enabled: Boolean(skill.enabled),
    linkedModelIds: Array.isArray(skill.linkedModelIds)
      ? skill.linkedModelIds.filter((entry) => typeof entry === 'string')
      : [],
    linkedToolIds: Array.isArray(skill.linkedToolIds)
      ? skill.linkedToolIds.filter((entry) => typeof entry === 'string')
      : [],
    accessGrants: normalizeWorkspaceResourceGrants('skill', skill.id, skill.workspaceId, skill.accessGrants),
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt
  }
}

function normalizeWorkspaceToolValveSchema(
  input: OpenPortWorkspaceToolValveSchemaField[] | undefined | null
): OpenPortWorkspaceToolValveSchemaField[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((field, index) => ({
      id: field?.id?.trim() || `valve_schema_${index}`,
      key: field?.key?.trim() || '',
      label: field?.label?.trim() || '',
      type:
        field?.type === 'number' || field?.type === 'boolean' || field?.type === 'json' || field?.type === 'string'
          ? field.type
          : 'string',
      description: field?.description?.trim() || '',
      defaultValue: field?.defaultValue?.trim() || '',
      required: Boolean(field?.required)
    }))
    .filter((field) => field.key.length > 0)
}

function normalizeWorkspaceGroup(group: OpenPortWorkspaceGroup): OpenPortWorkspaceGroup {
  return {
    id: group.id,
    workspaceId: group.workspaceId,
    name: group.name.trim() || 'Untitled group',
    description: group.description ?? '',
    memberUserIds: Array.isArray(group.memberUserIds)
      ? group.memberUserIds.filter((value) => typeof value === 'string')
      : [],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }
}

function normalizeWorkspaceConnectorCredential(
  credential: OpenPortWorkspaceConnectorCredential
): OpenPortWorkspaceConnectorCredential {
  return {
    id: credential.id,
    workspaceId: credential.workspaceId,
    name: credential.name.trim() || 'Connector credential',
    provider:
      credential.provider === 'web' ||
      credential.provider === 's3' ||
      credential.provider === 'github' ||
      credential.provider === 'notion' ||
      credential.provider === 'rss'
        ? credential.provider
        : 'directory',
    description: credential.description ?? '',
    fields: Array.isArray(credential.fields)
      ? credential.fields
          .map((field) => ({
            key: field?.key?.trim() || '',
            label: field?.label?.trim() || '',
            secret: Boolean(field?.secret),
            configured: Boolean(field?.configured),
            valuePreview: field?.valuePreview?.trim() || ''
          }))
          .filter((field) => field.key.length > 0)
      : [],
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  }
}

function normalizeWorkspaceConnector(connector: OpenPortWorkspaceConnector): OpenPortWorkspaceConnector {
  const adapter =
    connector.adapter === 'web' ||
    connector.adapter === 's3' ||
    connector.adapter === 'github' ||
    connector.adapter === 'notion' ||
    connector.adapter === 'rss'
      ? connector.adapter
      : 'directory'
  return {
    id: connector.id,
    workspaceId: connector.workspaceId,
    name: connector.name.trim() || 'Connector',
    adapter,
    description: connector.description ?? '',
    enabled: Boolean(connector.enabled),
    credentialId: connector.credentialId?.trim() || null,
    tags: Array.isArray(connector.tags) ? connector.tags.filter((entry) => typeof entry === 'string') : [],
    schedule: {
      enabled: Boolean(connector.schedule?.enabled),
      intervalMinutes: Math.max(5, Number(connector.schedule?.intervalMinutes || 60)),
      timezone: connector.schedule?.timezone?.trim() || 'UTC',
      incremental: connector.schedule?.incremental ?? true,
      nextRunAt: connector.schedule?.nextRunAt?.trim() || null
    },
    syncPolicy: {
      autoRetry: connector.syncPolicy?.autoRetry ?? true,
      maxRetries: Math.max(0, Number(connector.syncPolicy?.maxRetries || 0)),
      retryBackoffSeconds: Math.max(5, Number(connector.syncPolicy?.retryBackoffSeconds || 30)),
      maxDocumentsPerRun: Math.max(10, Number(connector.syncPolicy?.maxDocumentsPerRun || 500))
    },
    sourceConfig: {
      directoryPath: connector.sourceConfig?.directoryPath?.trim() || '',
      urls: Array.isArray(connector.sourceConfig?.urls)
        ? connector.sourceConfig.urls.filter((entry) => typeof entry === 'string')
        : [],
      bucket: connector.sourceConfig?.bucket?.trim() || '',
      prefix: connector.sourceConfig?.prefix?.trim() || '',
      repository: connector.sourceConfig?.repository?.trim() || '',
      branch: connector.sourceConfig?.branch?.trim() || 'main',
      notionDatabaseId: connector.sourceConfig?.notionDatabaseId?.trim() || '',
      rssFeedUrls: Array.isArray(connector.sourceConfig?.rssFeedUrls)
        ? connector.sourceConfig.rssFeedUrls.filter((entry) => typeof entry === 'string')
        : [],
      includePatterns: Array.isArray(connector.sourceConfig?.includePatterns)
        ? connector.sourceConfig.includePatterns.filter((entry) => typeof entry === 'string')
        : [],
      excludePatterns: Array.isArray(connector.sourceConfig?.excludePatterns)
        ? connector.sourceConfig.excludePatterns.filter((entry) => typeof entry === 'string')
        : []
    },
    status: {
      health:
        connector.status?.health === 'running' ||
        connector.status?.health === 'ok' ||
        connector.status?.health === 'error'
          ? connector.status.health
          : 'idle',
      lastRunAt: connector.status?.lastRunAt?.trim() || null,
      lastSuccessAt: connector.status?.lastSuccessAt?.trim() || null,
      lastFailureAt: connector.status?.lastFailureAt?.trim() || null,
      lastTaskId: connector.status?.lastTaskId?.trim() || null,
      lastErrorMessage: connector.status?.lastErrorMessage?.trim() || null
    },
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt
  }
}

function normalizeWorkspaceConnectorTask(task: OpenPortWorkspaceConnectorTask): OpenPortWorkspaceConnectorTask {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    connectorId: task.connectorId,
    trigger: task.trigger === 'schedule' ? 'schedule' : task.trigger === 'retry' ? 'retry' : 'manual',
    mode: task.mode === 'incremental' ? 'incremental' : 'full',
    status:
      task.status === 'queued' ||
      task.status === 'running' ||
      task.status === 'success' ||
      task.status === 'failed' ||
      task.status === 'cancelled'
        ? task.status
        : 'queued',
    attempt: Math.max(1, Number(task.attempt || 1)),
    maxAttempts: Math.max(1, Number(task.maxAttempts || 1)),
    scheduledAt: task.scheduledAt,
    startedAt: task.startedAt || null,
    finishedAt: task.finishedAt || null,
    retryOfTaskId: task.retryOfTaskId || null,
    nextRetryAt: task.nextRetryAt || null,
    errorMessage: task.errorMessage || null,
    summary: {
      scanned: Math.max(0, Number(task.summary?.scanned || 0)),
      created: Math.max(0, Number(task.summary?.created || 0)),
      updated: Math.max(0, Number(task.summary?.updated || 0)),
      removed: Math.max(0, Number(task.summary?.removed || 0)),
      errors: Math.max(0, Number(task.summary?.errors || 0))
    },
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }
}

function normalizeWorkspaceConnectorAuditEvent(
  event: OpenPortWorkspaceConnectorAuditEvent
): OpenPortWorkspaceConnectorAuditEvent {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    connectorId: event.connectorId,
    taskId: event.taskId || null,
    level: event.level === 'warn' ? 'warn' : event.level === 'error' ? 'error' : 'info',
    action: event.action,
    message: event.message,
    detail: event.detail ?? '',
    createdAt: event.createdAt
  }
}

function normalizeWorkspaceToolRunStep(
  step: OpenPortWorkspaceToolRun['steps'][number],
  index: number
): OpenPortWorkspaceToolRun['steps'][number] {
  return {
    id: step.id || `tool_run_step_${index}`,
    chainStepId: step.chainStepId || `chain_step_${index}`,
    toolId: step.toolId || '',
    toolName: step.toolName || step.toolId || 'unknown',
    mode: step.mode === 'parallel' || step.mode === 'fallback' ? step.mode : 'sequential',
    when: step.when === 'on_success' || step.when === 'on_error' ? step.when : 'always',
    condition: step.condition ?? '',
    conditionMatched: Boolean(step.conditionMatched),
    branchPath: step.branchPath || `step-${index + 1}`,
    outputKey: step.outputKey ?? '',
    status:
      step.status === 'running' ||
      step.status === 'success' ||
      step.status === 'failed' ||
      step.status === 'skipped'
        ? step.status
        : 'pending',
    inputSnapshot: step.inputSnapshot ?? '',
    outputSnapshot: step.outputSnapshot ?? '',
    errorMessage: step.errorMessage || null,
    startedAt: step.startedAt || null,
    finishedAt: step.finishedAt || null
  }
}

function normalizeWorkspaceToolRun(run: OpenPortWorkspaceToolRun): OpenPortWorkspaceToolRun {
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    toolId: run.toolId,
    trigger: run.trigger === 'replay' ? 'replay' : run.trigger === 'api' ? 'api' : 'manual',
    status:
      run.status === 'queued' ||
      run.status === 'running' ||
      run.status === 'success' ||
      run.status === 'failed' ||
      run.status === 'cancelled'
        ? run.status
        : 'queued',
    debug: Boolean(run.debug),
    replayOfRunId: run.replayOfRunId || null,
    inputPayload: run.inputPayload ?? '',
    outputPayload: run.outputPayload ?? '',
    errorMessage: run.errorMessage || null,
    steps: Array.isArray(run.steps) ? run.steps.map((step, index) => normalizeWorkspaceToolRunStep(step, index)) : [],
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  }
}

function resolveStateFilePath(): string {
  const configured = process.env.OPENPORT_API_STATE_FILE?.trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }

  return path.resolve(process.cwd(), '.openport-product/data/api-state.json')
}

function resolvePersistenceBackend(): PersistenceBackend {
  const configured = process.env.OPENPORT_API_STATE_BACKEND?.trim().toLowerCase()
  if (configured === 'postgres' || configured === 'file') {
    return configured
  }
  return process.env.OPENPORT_DATABASE_URL?.trim() ? 'postgres' : 'file'
}

@Injectable()
export class ApiStateStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiStateStoreService.name)
  private readonly backend = resolvePersistenceBackend()
  private readonly stateFilePath = resolveStateFilePath()
  private state: ProductApiState = this.loadState()
  private pool: Pool | null = null

  async onModuleInit(): Promise<void> {
    if (this.backend !== 'postgres') {
      this.logger.log(`API state backend: file (${this.stateFilePath})`)
      return
    }

    const connectionString = process.env.OPENPORT_DATABASE_URL?.trim()
    if (!connectionString) {
      throw new Error('OPENPORT_DATABASE_URL is required when OPENPORT_API_STATE_BACKEND=postgres')
    }

    this.pool = new Pool({ connectionString })
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_chat_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_chat_sessions
      ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
    `)
    await this.pool.query(`
      ALTER TABLE openport_chat_sessions
      ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE
    `)
    await this.pool.query(`
      ALTER TABLE openport_chat_sessions
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_chat_sessions
      ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE
    `)
    await this.pool.query(`
      ALTER TABLE openport_chat_sessions
      ADD COLUMN IF NOT EXISTS folder_id TEXT
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_chat_sessions_user_updated_idx
      ON openport_chat_sessions (user_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_chat_sessions_user_folder_updated_idx
      ON openport_chat_sessions (user_id, folder_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_projects (
        project_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        chat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        parent_id TEXT,
        is_expanded BOOLEAN NOT NULL DEFAULT TRUE,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_projects
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_projects_workspace_updated_idx
      ON openport_projects (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_items (
        item_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        asset_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        uploaded_at TIMESTAMPTZ NOT NULL,
        source TEXT NOT NULL DEFAULT 'upload',
        content_url TEXT,
        preview_text TEXT NOT NULL DEFAULT '',
        retrieval_state TEXT NOT NULL DEFAULT 'binary',
        chunk_count INTEGER NOT NULL DEFAULT 0,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS asset_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS content_url TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS preview_text TEXT NOT NULL DEFAULT ''
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS retrieval_state TEXT NOT NULL DEFAULT 'binary'
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS collection_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS collection_name TEXT NOT NULL DEFAULT 'General'
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS content_text TEXT NOT NULL DEFAULT ''
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_items
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_items_workspace_uploaded_idx
      ON openport_project_knowledge_items (workspace_id, uploaded_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_collections (
        collection_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_knowledge_collections
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_collections_workspace_updated_idx
      ON openport_project_knowledge_collections (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_assets (
        asset_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        owner_user_id TEXT,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        content_url TEXT NOT NULL,
        source_url TEXT,
        preview_text TEXT NOT NULL DEFAULT ''
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_assets
      ADD COLUMN IF NOT EXISTS owner_user_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_assets
      ADD COLUMN IF NOT EXISTS source_url TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_project_assets
      ADD COLUMN IF NOT EXISTS preview_text TEXT NOT NULL DEFAULT ''
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_assets_workspace_created_idx
      ON openport_project_assets (workspace_id, created_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_asset_blobs (
        asset_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        content BYTEA NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_chunks (
        chunk_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        text TEXT NOT NULL,
        vector JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_chunks_workspace_item_idx
      ON openport_project_knowledge_chunks (workspace_id, item_id)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_dense_chunks (
        chunk_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        text TEXT NOT NULL,
        vector JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_dense_chunks_workspace_item_idx
      ON openport_project_knowledge_dense_chunks (workspace_id, item_id)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_source_grants (
        grant_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        principal_type TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_source_grants_workspace_source_idx
      ON openport_project_knowledge_source_grants (workspace_id, source_id)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_project_knowledge_chunk_grants (
        grant_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        principal_type TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_project_knowledge_chunk_grants_workspace_chunk_idx
      ON openport_project_knowledge_chunk_grants (workspace_id, chunk_id)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_models (
        model_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        route TEXT NOT NULL,
        provider TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'active',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        filter_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        default_filter_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        default_feature_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
        knowledge_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        builtin_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        skill_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        prompt_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS filter_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS default_filter_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS action_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS default_feature_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS builtin_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS skill_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS prompt_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_models
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_models_workspace_updated_idx
      ON openport_workspace_models (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_ollama_configs (
        workspace_id TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        base_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_prompts (
        prompt_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        visibility TEXT NOT NULL DEFAULT 'workspace',
        production_version_id TEXT,
        published_version_id TEXT,
        published_at TIMESTAMPTZ,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS production_version_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'workspace'
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS published_version_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS community_status TEXT NOT NULL DEFAULT 'none'
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS community_submitted_version_id TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS community_submitted_at TIMESTAMPTZ
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS community_submission_url TEXT
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS community_submission_note TEXT NOT NULL DEFAULT ''
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompts
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_prompts_workspace_updated_idx
      ON openport_workspace_prompts (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_prompt_versions (
        version_id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        version_label TEXT NOT NULL DEFAULT 'Version',
        commit_message TEXT NOT NULL DEFAULT '',
        saved_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_prompt_versions
      ADD COLUMN IF NOT EXISTS commit_message TEXT NOT NULL DEFAULT ''
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_prompt_versions_prompt_saved_idx
      ON openport_workspace_prompt_versions (prompt_id, saved_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_tools (
        tool_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        integration_id TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        manifest TEXT NOT NULL DEFAULT '',
        valves JSONB NOT NULL DEFAULT '{}'::jsonb,
        valve_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
        examples JSONB NOT NULL DEFAULT '[]'::jsonb,
        execution_chain JSONB NOT NULL DEFAULT '{}'::jsonb,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS valves JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS valve_schema JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS execution_chain JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_tools
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_tools_workspace_updated_idx
      ON openport_workspace_tools (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_connector_credentials (
        credential_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_connector_credentials_workspace_updated_idx
      ON openport_workspace_connector_credentials (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_connectors (
        connector_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        adapter TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        credential_id TEXT,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
        sync_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        status JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_connectors_workspace_updated_idx
      ON openport_workspace_connectors (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_connector_tasks (
        task_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 1,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        scheduled_at TIMESTAMPTZ NOT NULL,
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        retry_of_task_id TEXT,
        next_retry_at TIMESTAMPTZ,
        error_message TEXT,
        summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_connector_tasks_workspace_created_idx
      ON openport_workspace_connector_tasks (workspace_id, created_at DESC)
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_connector_tasks_workspace_status_scheduled_idx
      ON openport_workspace_connector_tasks (workspace_id, status, scheduled_at ASC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_connector_audit_events (
        event_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        task_id TEXT,
        level TEXT NOT NULL,
        action TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_connector_audit_events_workspace_created_idx
      ON openport_workspace_connector_audit_events (workspace_id, created_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_tool_runs (
        run_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        debug BOOLEAN NOT NULL DEFAULT FALSE,
        replay_of_run_id TEXT,
        input_payload TEXT NOT NULL DEFAULT '',
        output_payload TEXT NOT NULL DEFAULT '',
        error_message TEXT,
        steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_tool_runs_workspace_created_idx
      ON openport_workspace_tool_runs (workspace_id, created_at DESC)
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_tool_runs_workspace_status_created_idx
      ON openport_workspace_tool_runs (workspace_id, status, created_at ASC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_skills (
        skill_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        linked_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        linked_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        access_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_skills
      ADD COLUMN IF NOT EXISTS access_grants JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_skills
      ADD COLUMN IF NOT EXISTS linked_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      ALTER TABLE openport_workspace_skills
      ADD COLUMN IF NOT EXISTS linked_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_skills_workspace_updated_idx
      ON openport_workspace_skills (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_workspace_groups (
        group_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        member_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_workspace_groups_workspace_updated_idx
      ON openport_workspace_groups (workspace_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_search_history (
        entry_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 1,
        last_result_count INTEGER,
        top_result_type TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_search_history_scope_updated_idx
      ON openport_search_history (workspace_id, user_id, updated_at DESC)
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openport_search_history_scope_query_idx
      ON openport_search_history (workspace_id, user_id, query)
    `)
    this.logger.log('API state backend: postgres')
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end()
  }

  async readChatSessions(userId: string): Promise<OpenPortChatSession[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        session_id: string
        user_id: string
        title: string
        created_at: Date | string
        updated_at: Date | string
        archived: boolean
        pinned: boolean
        shared: boolean
        folder_id: string | null
        tags: string[]
        settings: OpenPortChatSession['settings']
        messages: OpenPortChatSession['messages']
      }>(
        `
          SELECT session_id, user_id, title, created_at, updated_at, archived, pinned, shared, folder_id, tags, settings, messages
          FROM openport_chat_sessions
          WHERE user_id = $1
          ORDER BY updated_at DESC
        `,
        [userId]
      )

      return result.rows.map((row) =>
        normalizeChatSession({
          id: row.session_id,
          userId: row.user_id,
          title: row.title,
          archived: row.archived,
          pinned: row.pinned,
          shared: row.shared,
          folderId: row.folder_id,
          tags: row.tags,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          settings: row.settings,
          messages: row.messages
        })
      )
    }

    return structuredClone(this.state.chatSessionsByUser[userId] || []).map((session) =>
      normalizeChatSession(session)
    )
  }

  async writeChatSessions(userId: string, sessions: OpenPortChatSession[]): Promise<void> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const sessionIds = sessions.map((session) => session.id)
        if (sessionIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_chat_sessions
              WHERE user_id = $1
                AND NOT (session_id = ANY($2::text[]))
            `,
            [userId, sessionIds]
          )
        } else {
          await client.query('DELETE FROM openport_chat_sessions WHERE user_id = $1', [userId])
        }

        for (const session of sessions) {
          await client.query(
            `
              INSERT INTO openport_chat_sessions (
                session_id,
                user_id,
                title,
                created_at,
                updated_at,
                archived,
                pinned,
                shared,
                folder_id,
                tags,
                settings,
                messages
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
              ON CONFLICT (session_id) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                title = EXCLUDED.title,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                archived = EXCLUDED.archived,
                pinned = EXCLUDED.pinned,
                shared = EXCLUDED.shared,
                folder_id = EXCLUDED.folder_id,
                tags = EXCLUDED.tags,
                settings = EXCLUDED.settings,
                messages = EXCLUDED.messages
            `,
            [
              session.id,
              session.userId,
              session.title,
              session.createdAt,
              session.updatedAt,
              session.archived,
              session.pinned,
              Boolean(session.shared),
              session.folderId ?? session.settings?.projectId ?? null,
              JSON.stringify(session.tags),
              JSON.stringify(session.settings),
              JSON.stringify(session.messages)
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.chatSessionsByUser[userId] = structuredClone(sessions).map((session) =>
      normalizeChatSession(session)
    )
    this.flush()
  }

  async readProjects(workspaceId: string): Promise<OpenPortProject[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        project_id: string
        workspace_id: string
        owner_user_id: string
        name: string
        chat_ids: string[]
        created_at: number | string
        updated_at: number | string
        parent_id: string | null
        is_expanded: boolean
        meta: OpenPortProjectMeta
        data: OpenPortProjectData
        access_grants: OpenPortProjectGrant[]
      }>(
        `
          SELECT project_id, workspace_id, owner_user_id, name, chat_ids, created_at, updated_at, parent_id, is_expanded, meta, data, access_grants
          FROM openport_projects
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeProject({
          id: row.project_id,
          workspaceId: row.workspace_id,
          ownerUserId: row.owner_user_id,
          name: row.name,
          chatIds: row.chat_ids,
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
          parentId: row.parent_id,
          isExpanded: row.is_expanded,
          meta: row.meta,
          data: row.data,
          accessGrants: Array.isArray(row.access_grants) ? row.access_grants : []
        })
      )
    }

    return structuredClone(this.state.projectsByWorkspace[workspaceId] || []).map((project) => normalizeProject(project))
  }

  async writeProjects(workspaceId: string, projects: OpenPortProject[]): Promise<void> {
    const normalizedProjects = structuredClone(projects).map((project) => normalizeProject(project))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const projectIds = normalizedProjects.map((project) => project.id)
        if (projectIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_projects
              WHERE workspace_id = $1
                AND NOT (project_id = ANY($2::text[]))
            `,
            [workspaceId, projectIds]
          )
        } else {
          await client.query('DELETE FROM openport_projects WHERE workspace_id = $1', [workspaceId])
        }

        for (const project of normalizedProjects) {
          await client.query(
            `
              INSERT INTO openport_projects (
                project_id,
                workspace_id,
                owner_user_id,
                name,
                chat_ids,
                created_at,
                updated_at,
                parent_id,
                is_expanded,
                meta,
                data,
                access_grants
              )
              VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
              ON CONFLICT (project_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                owner_user_id = EXCLUDED.owner_user_id,
                name = EXCLUDED.name,
                chat_ids = EXCLUDED.chat_ids,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                parent_id = EXCLUDED.parent_id,
                is_expanded = EXCLUDED.is_expanded,
                meta = EXCLUDED.meta,
                data = EXCLUDED.data,
                access_grants = EXCLUDED.access_grants
            `,
            [
              project.id,
              project.workspaceId,
              project.ownerUserId,
              project.name,
              JSON.stringify(project.chatIds),
              project.createdAt,
              project.updatedAt,
              project.parentId,
              project.isExpanded,
              JSON.stringify(project.meta),
              JSON.stringify(project.data),
              JSON.stringify(project.accessGrants || [])
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.projectsByWorkspace[workspaceId] = normalizedProjects
    this.flush()
  }

  async readKnowledgeItems(workspaceId: string): Promise<OpenPortProjectKnowledgeItem[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        item_id: string
        workspace_id: string
        asset_id: string | null
        collection_id: string | null
        collection_name: string
        name: string
        type: string
        size: number | string
        uploaded_at: Date | string
        source: OpenPortProjectKnowledgeItem['source']
        content_url: string | null
        content_text: string
        preview_text: string
        retrieval_state: 'indexed' | 'binary'
        chunk_count: number | string
        sources: OpenPortProjectKnowledgeSource[] | null
        access_grants: OpenPortProjectKnowledgeItem['accessGrants'] | null
      }>(
        `
          SELECT item_id, workspace_id, asset_id, collection_id, collection_name, name, type, size, uploaded_at, source, content_url, content_text, preview_text, retrieval_state, chunk_count, sources, access_grants
          FROM openport_project_knowledge_items
          WHERE workspace_id = $1
          ORDER BY uploaded_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeKnowledgeItem({
          id: row.item_id,
          workspaceId: row.workspace_id,
          assetId: row.asset_id,
          collectionId: row.collection_id,
          collectionName: row.collection_name,
          name: row.name,
          type: row.type,
          size: Number(row.size),
          uploadedAt: new Date(row.uploaded_at).toISOString(),
          source: row.source,
          contentUrl: row.content_url,
          contentText: row.content_text,
          previewText: row.preview_text,
          retrievalState: row.retrieval_state,
          chunkCount: Number(row.chunk_count),
          sources: row.sources || [],
          accessGrants: row.access_grants || []
        })
      )
    }

    return structuredClone(this.state.knowledgeItemsByWorkspace[workspaceId] || []).map((item) =>
      normalizeKnowledgeItem(item)
    )
  }

  async readKnowledgeCollections(workspaceId: string): Promise<OpenPortKnowledgeCollection[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        collection_id: string
        workspace_id: string
        name: string
        description: string
        updated_at: Date | string
        access_grants: OpenPortKnowledgeCollection['accessGrants'] | null
      }>(
        `
          SELECT collection_id, workspace_id, name, description, updated_at, access_grants
          FROM openport_project_knowledge_collections
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeKnowledgeCollection({
          id: row.collection_id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          itemCount: 0,
          updatedAt: new Date(row.updated_at).toISOString(),
          accessGrants: row.access_grants || []
        })
      )
    }

    return structuredClone(this.state.knowledgeCollectionsByWorkspace[workspaceId] || []).map((item) =>
      normalizeKnowledgeCollection(item)
    )
  }

  async writeKnowledgeItems(workspaceId: string, items: OpenPortProjectKnowledgeItem[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeKnowledgeItem(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const itemIds = normalizedItems.map((item) => item.id)
        if (itemIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_items
              WHERE workspace_id = $1
                AND NOT (item_id = ANY($2::text[]))
            `,
            [workspaceId, itemIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_items WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_items (
                item_id,
                workspace_id,
                asset_id,
                collection_id,
                collection_name,
                name,
                type,
                size,
                uploaded_at,
                source,
                content_url,
                content_text,
                preview_text,
                retrieval_state,
                chunk_count,
                sources,
                access_grants
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              ON CONFLICT (item_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                asset_id = EXCLUDED.asset_id,
                collection_id = EXCLUDED.collection_id,
                collection_name = EXCLUDED.collection_name,
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                size = EXCLUDED.size,
                uploaded_at = EXCLUDED.uploaded_at,
                source = EXCLUDED.source,
                content_url = EXCLUDED.content_url,
                content_text = EXCLUDED.content_text,
                preview_text = EXCLUDED.preview_text,
                retrieval_state = EXCLUDED.retrieval_state,
                chunk_count = EXCLUDED.chunk_count,
                sources = EXCLUDED.sources,
                access_grants = EXCLUDED.access_grants
            `,
            [
              item.id,
              item.workspaceId,
              item.assetId,
              item.collectionId,
              item.collectionName,
              item.name,
              item.type,
              item.size,
              item.uploadedAt,
              item.source,
              item.contentUrl,
              item.contentText,
              item.previewText,
              item.retrievalState,
              item.chunkCount,
              JSON.stringify(item.sources || []),
              JSON.stringify(item.accessGrants || [])
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.knowledgeItemsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async writeKnowledgeCollections(workspaceId: string, items: OpenPortKnowledgeCollection[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeKnowledgeCollection(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_collections
              WHERE workspace_id = $1
                AND NOT (collection_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_collections WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_collections (
                collection_id,
                workspace_id,
                name,
                description,
                updated_at,
                access_grants
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (collection_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at,
                access_grants = EXCLUDED.access_grants
            `,
            [item.id, item.workspaceId, item.name, item.description, item.updatedAt, JSON.stringify(item.accessGrants || [])]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.knowledgeCollectionsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readProjectAssets(workspaceId: string): Promise<OpenPortProjectAsset[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        asset_id: string
        workspace_id: string
        owner_user_id: string | null
        kind: OpenPortProjectAsset['kind']
        name: string
        type: string
        size: number | string
        created_at: Date | string
        content_url: string
        source_url: string | null
        preview_text: string | null
      }>(
        `
          SELECT asset_id, workspace_id, owner_user_id, kind, name, type, size, created_at, content_url, source_url, preview_text
          FROM openport_project_assets
          WHERE workspace_id = $1
          ORDER BY created_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeProjectAsset({
          id: row.asset_id,
          workspaceId: row.workspace_id,
          ownerUserId: row.owner_user_id,
          kind: row.kind,
          name: row.name,
          type: row.type,
          size: Number(row.size),
          createdAt: new Date(row.created_at).toISOString(),
          contentUrl: row.content_url,
          sourceUrl: row.source_url,
          previewText: row.preview_text ?? ''
        })
      )
    }

    return structuredClone(this.state.projectAssetsByWorkspace[workspaceId] || []).map((asset) =>
      normalizeProjectAsset(asset)
    )
  }

  async writeProjectAssets(workspaceId: string, assets: OpenPortProjectAsset[]): Promise<void> {
    const normalizedAssets = structuredClone(assets).map((asset) => normalizeProjectAsset(asset))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const assetIds = normalizedAssets.map((asset) => asset.id)
        if (assetIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_assets
              WHERE workspace_id = $1
                AND NOT (asset_id = ANY($2::text[]))
            `,
            [workspaceId, assetIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_assets WHERE workspace_id = $1', [workspaceId])
        }

        for (const asset of normalizedAssets) {
          await client.query(
            `
              INSERT INTO openport_project_assets (
                asset_id,
                workspace_id,
                owner_user_id,
                kind,
                name,
                type,
                size,
                created_at,
                content_url,
                source_url,
                preview_text
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (asset_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                owner_user_id = EXCLUDED.owner_user_id,
                kind = EXCLUDED.kind,
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                size = EXCLUDED.size,
                created_at = EXCLUDED.created_at,
                content_url = EXCLUDED.content_url,
                source_url = EXCLUDED.source_url,
                preview_text = EXCLUDED.preview_text
            `,
            [
              asset.id,
              asset.workspaceId,
              asset.ownerUserId ?? null,
              asset.kind,
              asset.name,
              asset.type,
              asset.size,
              asset.createdAt,
              asset.contentUrl,
              asset.sourceUrl ?? null,
              asset.previewText ?? ''
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.projectAssetsByWorkspace[workspaceId] = normalizedAssets
    this.flush()
  }

  async readAllProjectAssets(): Promise<OpenPortProjectAsset[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        asset_id: string
        workspace_id: string
        owner_user_id: string | null
        kind: OpenPortProjectAsset['kind']
        name: string
        type: string
        size: number | string
        created_at: Date | string
        content_url: string
        source_url: string | null
        preview_text: string | null
      }>(
        `
          SELECT asset_id, workspace_id, owner_user_id, kind, name, type, size, created_at, content_url, source_url, preview_text
          FROM openport_project_assets
        `
      )

      return result.rows.map((row) =>
        normalizeProjectAsset({
          id: row.asset_id,
          workspaceId: row.workspace_id,
          ownerUserId: row.owner_user_id,
          kind: row.kind,
          name: row.name,
          type: row.type,
          size: Number(row.size),
          createdAt: new Date(row.created_at).toISOString(),
          contentUrl: row.content_url,
          sourceUrl: row.source_url,
          previewText: row.preview_text ?? ''
        })
      )
    }

    return Object.values(this.state.projectAssetsByWorkspace)
      .flat()
      .map((asset) => normalizeProjectAsset(asset))
  }

  async writeProjectAssetBlob(workspaceId: string, assetId: string, buffer: Buffer): Promise<void> {
    if (this.backend !== 'postgres') {
      throw new Error('Project asset blob storage requires postgres backend')
    }

    const pool = this.requirePool()
    await pool.query(
      `
        INSERT INTO openport_project_asset_blobs (asset_id, workspace_id, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (asset_id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          content = EXCLUDED.content
      `,
      [assetId, workspaceId, buffer]
    )
  }

  async readProjectAssetBlob(assetId: string): Promise<{ workspaceId: string; buffer: Buffer } | null> {
    if (this.backend !== 'postgres') {
      return null
    }

    const pool = this.requirePool()
    const result = await pool.query<{ workspace_id: string; content: Buffer }>(
      `
        SELECT workspace_id, content
        FROM openport_project_asset_blobs
        WHERE asset_id = $1
      `,
      [assetId]
    )

    const row = result.rows[0]
    if (!row) return null
    return {
      workspaceId: row.workspace_id,
      buffer: Buffer.from(row.content)
    }
  }

  async deleteProjectAssetBlob(assetId: string): Promise<void> {
    if (this.backend !== 'postgres') {
      return
    }

    const pool = this.requirePool()
    await pool.query('DELETE FROM openport_project_asset_blobs WHERE asset_id = $1', [assetId])
  }

  async readKnowledgeChunks(workspaceId: string): Promise<ProjectKnowledgeChunkRecord[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        chunk_id: string
        workspace_id: string
        item_id: string
        text: string
        vector: Record<string, number>
      }>(
        `
          SELECT chunk_id, workspace_id, item_id, text, vector
          FROM openport_project_knowledge_chunks
          WHERE workspace_id = $1
        `,
        [workspaceId]
      )

      return result.rows.map((row) => ({
        id: row.chunk_id,
        workspaceId: row.workspace_id,
        itemId: row.item_id,
        text: row.text,
        vector: normalizeVector(row.vector)
      }))
    }

    return structuredClone(this.state.knowledgeChunksByWorkspace[workspaceId] || []).map((chunk) => ({
      ...chunk,
      vector: normalizeVector(chunk.vector)
    }))
  }

  async writeKnowledgeChunks(workspaceId: string, chunks: ProjectKnowledgeChunkRecord[]): Promise<void> {
    const normalizedChunks = structuredClone(chunks).map((chunk) => ({
      ...chunk,
      workspaceId,
      vector: normalizeVector(chunk.vector)
    }))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const chunkIds = normalizedChunks.map((chunk) => chunk.id)
        if (chunkIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_chunks
              WHERE workspace_id = $1
                AND NOT (chunk_id = ANY($2::text[]))
            `,
            [workspaceId, chunkIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_chunks WHERE workspace_id = $1', [workspaceId])
        }

        for (const chunk of normalizedChunks) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_chunks (
                chunk_id,
                workspace_id,
                item_id,
                text,
                vector
              )
              VALUES ($1, $2, $3, $4, $5::jsonb)
              ON CONFLICT (chunk_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                item_id = EXCLUDED.item_id,
                text = EXCLUDED.text,
                vector = EXCLUDED.vector
            `,
            [chunk.id, chunk.workspaceId, chunk.itemId, chunk.text, JSON.stringify(chunk.vector)]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.knowledgeChunksByWorkspace[workspaceId] = normalizedChunks
    this.flush()
  }

  async readDenseKnowledgeChunks(workspaceId: string): Promise<ProjectDenseKnowledgeChunkRecord[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        chunk_id: string
        workspace_id: string
        item_id: string
        text: string
        vector: number[]
      }>(
        `
          SELECT chunk_id, workspace_id, item_id, text, vector
          FROM openport_project_knowledge_dense_chunks
          WHERE workspace_id = $1
        `,
        [workspaceId]
      )

      return result.rows.map((row) => ({
        id: row.chunk_id,
        workspaceId: row.workspace_id,
        itemId: row.item_id,
        text: row.text,
        vector: normalizeDenseVector(row.vector)
      }))
    }

    return structuredClone(this.state.denseKnowledgeChunksByWorkspace[workspaceId] || []).map((chunk) => ({
      ...chunk,
      vector: normalizeDenseVector(chunk.vector)
    }))
  }

  async writeDenseKnowledgeChunks(workspaceId: string, chunks: ProjectDenseKnowledgeChunkRecord[]): Promise<void> {
    const normalizedChunks = structuredClone(chunks).map((chunk) => ({
      ...chunk,
      workspaceId,
      vector: normalizeDenseVector(chunk.vector)
    }))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const chunkIds = normalizedChunks.map((chunk) => chunk.id)
        if (chunkIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_dense_chunks
              WHERE workspace_id = $1
                AND NOT (chunk_id = ANY($2::text[]))
            `,
            [workspaceId, chunkIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_dense_chunks WHERE workspace_id = $1', [workspaceId])
        }

        for (const chunk of normalizedChunks) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_dense_chunks (
                chunk_id,
                workspace_id,
                item_id,
                text,
                vector
              )
              VALUES ($1, $2, $3, $4, $5::jsonb)
              ON CONFLICT (chunk_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                item_id = EXCLUDED.item_id,
                text = EXCLUDED.text,
                vector = EXCLUDED.vector
            `,
            [chunk.id, chunk.workspaceId, chunk.itemId, chunk.text, JSON.stringify(chunk.vector)]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.denseKnowledgeChunksByWorkspace[workspaceId] = normalizedChunks
    this.flush()
  }

  async readKnowledgeSourceGrants(workspaceId: string): Promise<OpenPortWorkspaceResourceGrant[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        grant_id: string
        workspace_id: string
        source_id: string
        principal_type: OpenPortWorkspaceResourcePrincipalType
        principal_id: string
        permission: OpenPortWorkspaceResourcePermission
        created_at: Date | string
      }>(
        `
          SELECT grant_id, workspace_id, source_id, principal_type, principal_id, permission, created_at
          FROM openport_project_knowledge_source_grants
          WHERE workspace_id = $1
          ORDER BY created_at ASC
        `,
        [workspaceId]
      )
      return result.rows
        .map((row) =>
          normalizeWorkspaceResourceGrant('knowledge_source', row.source_id, row.workspace_id, {
            id: row.grant_id,
            workspaceId: row.workspace_id,
            resourceType: 'knowledge_source',
            resourceId: row.source_id,
            principalType: row.principal_type,
            principalId: row.principal_id,
            permission: row.permission,
            createdAt: new Date(row.created_at).toISOString()
          })
        )
        .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))
    }

    return structuredClone(this.state.knowledgeSourceGrantsByWorkspace[workspaceId] || [])
      .map((grant) => normalizeWorkspaceResourceGrant('knowledge_source', grant.resourceId, workspaceId, grant))
      .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))
  }

  async writeKnowledgeSourceGrants(workspaceId: string, grants: OpenPortWorkspaceResourceGrant[]): Promise<void> {
    const normalized = structuredClone(grants)
      .map((grant) => normalizeWorkspaceResourceGrant('knowledge_source', grant.resourceId, workspaceId, grant))
      .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const grantIds = normalized.map((grant) => grant.id)
        if (grantIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_source_grants
              WHERE workspace_id = $1
                AND NOT (grant_id = ANY($2::text[]))
            `,
            [workspaceId, grantIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_source_grants WHERE workspace_id = $1', [workspaceId])
        }

        for (const grant of normalized) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_source_grants (
                grant_id,
                workspace_id,
                source_id,
                principal_type,
                principal_id,
                permission,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (grant_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                source_id = EXCLUDED.source_id,
                principal_type = EXCLUDED.principal_type,
                principal_id = EXCLUDED.principal_id,
                permission = EXCLUDED.permission,
                created_at = EXCLUDED.created_at
            `,
            [
              grant.id,
              workspaceId,
              grant.resourceId,
              grant.principalType,
              grant.principalId,
              grant.permission,
              grant.createdAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.knowledgeSourceGrantsByWorkspace[workspaceId] = normalized
    this.flush()
  }

  async readKnowledgeChunkGrants(workspaceId: string): Promise<OpenPortWorkspaceResourceGrant[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        grant_id: string
        workspace_id: string
        chunk_id: string
        principal_type: OpenPortWorkspaceResourcePrincipalType
        principal_id: string
        permission: OpenPortWorkspaceResourcePermission
        created_at: Date | string
      }>(
        `
          SELECT grant_id, workspace_id, chunk_id, principal_type, principal_id, permission, created_at
          FROM openport_project_knowledge_chunk_grants
          WHERE workspace_id = $1
          ORDER BY created_at ASC
        `,
        [workspaceId]
      )
      return result.rows
        .map((row) =>
          normalizeWorkspaceResourceGrant('knowledge_chunk', row.chunk_id, row.workspace_id, {
            id: row.grant_id,
            workspaceId: row.workspace_id,
            resourceType: 'knowledge_chunk',
            resourceId: row.chunk_id,
            principalType: row.principal_type,
            principalId: row.principal_id,
            permission: row.permission,
            createdAt: new Date(row.created_at).toISOString()
          })
        )
        .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))
    }

    return structuredClone(this.state.knowledgeChunkGrantsByWorkspace[workspaceId] || [])
      .map((grant) => normalizeWorkspaceResourceGrant('knowledge_chunk', grant.resourceId, workspaceId, grant))
      .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))
  }

  async writeKnowledgeChunkGrants(workspaceId: string, grants: OpenPortWorkspaceResourceGrant[]): Promise<void> {
    const normalized = structuredClone(grants)
      .map((grant) => normalizeWorkspaceResourceGrant('knowledge_chunk', grant.resourceId, workspaceId, grant))
      .filter((grant): grant is OpenPortWorkspaceResourceGrant => Boolean(grant))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const grantIds = normalized.map((grant) => grant.id)
        if (grantIds.length > 0) {
          await client.query(
            `
              DELETE FROM openport_project_knowledge_chunk_grants
              WHERE workspace_id = $1
                AND NOT (grant_id = ANY($2::text[]))
            `,
            [workspaceId, grantIds]
          )
        } else {
          await client.query('DELETE FROM openport_project_knowledge_chunk_grants WHERE workspace_id = $1', [workspaceId])
        }

        for (const grant of normalized) {
          await client.query(
            `
              INSERT INTO openport_project_knowledge_chunk_grants (
                grant_id,
                workspace_id,
                chunk_id,
                principal_type,
                principal_id,
                permission,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (grant_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                chunk_id = EXCLUDED.chunk_id,
                principal_type = EXCLUDED.principal_type,
                principal_id = EXCLUDED.principal_id,
                permission = EXCLUDED.permission,
                created_at = EXCLUDED.created_at
            `,
            [
              grant.id,
              workspaceId,
              grant.resourceId,
              grant.principalType,
              grant.principalId,
              grant.permission,
              grant.createdAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.knowledgeChunkGrantsByWorkspace[workspaceId] = normalized
    this.flush()
  }

  async readWorkspaceGroups(workspaceId: string): Promise<OpenPortWorkspaceGroup[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        group_id: string
        workspace_id: string
        name: string
        description: string
        member_user_ids: string[]
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT group_id, workspace_id, name, description, member_user_ids, created_at, updated_at
          FROM openport_workspace_groups
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspaceGroup({
          id: row.group_id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          memberUserIds: row.member_user_ids,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceGroupsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceGroup(item)
    )
  }

  async writeWorkspaceGroups(workspaceId: string, items: OpenPortWorkspaceGroup[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceGroup(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_groups
              WHERE workspace_id = $1
                AND NOT (group_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_groups WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_groups (
                group_id,
                workspace_id,
                name,
                description,
                member_user_ids,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
              ON CONFLICT (group_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                member_user_ids = EXCLUDED.member_user_ids,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.description,
              JSON.stringify(item.memberUserIds),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceGroupsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceModels(workspaceId: string): Promise<OpenPortWorkspaceModel[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        model_id: string
        workspace_id: string
        name: string
        route: string
        provider: string
        description: string
        tags: string[]
        status: OpenPortWorkspaceModel['status']
        is_default: boolean
        filter_ids: string[]
        default_filter_ids: string[]
        action_ids: string[]
        default_feature_ids: string[]
        capabilities: OpenPortWorkspaceModelCapabilities
        knowledge_item_ids: string[]
        tool_ids: string[]
        builtin_tool_ids: string[]
        skill_ids: string[]
        prompt_suggestions: OpenPortWorkspacePromptSuggestion[]
        access_grants: OpenPortWorkspaceResourceGrant[]
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT model_id, workspace_id, name, route, provider, description, tags, status, is_default, filter_ids, default_filter_ids, action_ids, default_feature_ids, capabilities, knowledge_item_ids, tool_ids, builtin_tool_ids, skill_ids, prompt_suggestions, access_grants, created_at, updated_at
          FROM openport_workspace_models
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspaceModel({
          id: row.model_id,
          workspaceId: row.workspace_id,
          name: row.name,
          route: row.route,
          provider: row.provider,
          description: row.description,
          tags: row.tags,
          status: row.status,
          isDefault: row.is_default,
          filterIds: row.filter_ids,
          defaultFilterIds: row.default_filter_ids,
          actionIds: row.action_ids,
          defaultFeatureIds: row.default_feature_ids,
          capabilities: row.capabilities,
          knowledgeItemIds: row.knowledge_item_ids,
          toolIds: row.tool_ids,
          builtinToolIds: row.builtin_tool_ids,
          skillIds: row.skill_ids,
          promptSuggestions: row.prompt_suggestions,
          accessGrants: row.access_grants,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceModelsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceModel(item)
    )
  }

  async writeWorkspaceModels(workspaceId: string, items: OpenPortWorkspaceModel[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceModel(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_models
              WHERE workspace_id = $1
                AND NOT (model_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_models WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_models (
                model_id,
                workspace_id,
                name,
                route,
                provider,
                description,
                tags,
                status,
                is_default,
                filter_ids,
                default_filter_ids,
                action_ids,
                default_feature_ids,
                capabilities,
                knowledge_item_ids,
                tool_ids,
                builtin_tool_ids,
                skill_ids,
                prompt_suggestions,
                access_grants,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21, $22)
              ON CONFLICT (model_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                route = EXCLUDED.route,
                provider = EXCLUDED.provider,
                description = EXCLUDED.description,
                tags = EXCLUDED.tags,
                status = EXCLUDED.status,
                is_default = EXCLUDED.is_default,
                filter_ids = EXCLUDED.filter_ids,
                default_filter_ids = EXCLUDED.default_filter_ids,
                action_ids = EXCLUDED.action_ids,
                default_feature_ids = EXCLUDED.default_feature_ids,
                capabilities = EXCLUDED.capabilities,
                knowledge_item_ids = EXCLUDED.knowledge_item_ids,
                tool_ids = EXCLUDED.tool_ids,
                builtin_tool_ids = EXCLUDED.builtin_tool_ids,
                skill_ids = EXCLUDED.skill_ids,
                prompt_suggestions = EXCLUDED.prompt_suggestions,
                access_grants = EXCLUDED.access_grants,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.route,
              item.provider,
              item.description,
              JSON.stringify(item.tags),
              item.status,
              item.isDefault,
              JSON.stringify(item.filterIds),
              JSON.stringify(item.defaultFilterIds),
              JSON.stringify(item.actionIds),
              JSON.stringify(item.defaultFeatureIds),
              JSON.stringify(item.capabilities),
              JSON.stringify(item.knowledgeItemIds),
              JSON.stringify(item.toolIds),
              JSON.stringify(item.builtinToolIds),
              JSON.stringify(item.skillIds),
              JSON.stringify(item.promptSuggestions),
              JSON.stringify(item.accessGrants),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceModelsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readOllamaConfig(workspaceId: string): Promise<OllamaWorkspaceConfig | null> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        workspace_id: string
        enabled: boolean
        base_urls: string[]
        updated_at: Date | string
      }>(
        `
          SELECT workspace_id, enabled, base_urls, updated_at
          FROM openport_ollama_configs
          WHERE workspace_id = $1
        `,
        [workspaceId]
      )
      const row = result.rows[0]
      if (!row) return null
      return {
        enabled: Boolean(row.enabled),
        baseUrls: Array.isArray(row.base_urls) ? row.base_urls : [],
        updatedAt: new Date(row.updated_at).toISOString()
      }
    }

    const entry = this.state.ollamaConfigByWorkspace[workspaceId]
    if (!entry) return null
    return structuredClone(entry)
  }

  async writeOllamaConfig(workspaceId: string, input: Pick<OllamaWorkspaceConfig, 'enabled' | 'baseUrls'>): Promise<OllamaWorkspaceConfig> {
    const now = new Date().toISOString()
    const next: OllamaWorkspaceConfig = {
      enabled: Boolean(input.enabled),
      baseUrls: Array.isArray(input.baseUrls) ? input.baseUrls.map((url) => String(url).trim()).filter(Boolean).slice(0, 8) : [],
      updatedAt: now
    }

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      await pool.query(
        `
          INSERT INTO openport_ollama_configs (workspace_id, enabled, base_urls, updated_at)
          VALUES ($1, $2, $3::jsonb, $4)
          ON CONFLICT (workspace_id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            base_urls = EXCLUDED.base_urls,
            updated_at = EXCLUDED.updated_at
        `,
        [workspaceId, next.enabled, JSON.stringify(next.baseUrls), next.updatedAt]
      )
      return next
    }

    this.state.ollamaConfigByWorkspace[workspaceId] = next
    this.flush()
    return this.readOllamaConfig(workspaceId).then((value) => value || next)
  }

  async readWorkspacePrompts(workspaceId: string): Promise<OpenPortWorkspacePrompt[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        prompt_id: string
        workspace_id: string
        title: string
        command: string
        description: string
        content: string
        tags: string[]
        visibility: 'private' | 'workspace'
        production_version_id: string | null
        published_version_id: string | null
        published_at: Date | string | null
        community_status: 'none' | 'submitted'
        community_submitted_version_id: string | null
        community_submitted_at: Date | string | null
        community_submission_url: string | null
        community_submission_note: string
        access_grants: OpenPortWorkspaceResourceGrant[]
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT prompt_id, workspace_id, title, command, description, content, tags, visibility, production_version_id, published_version_id, published_at, community_status, community_submitted_version_id, community_submitted_at, community_submission_url, community_submission_note, access_grants, created_at, updated_at
          FROM openport_workspace_prompts
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspacePrompt({
          id: row.prompt_id,
          workspaceId: row.workspace_id,
          title: row.title,
          command: row.command,
          description: row.description,
          content: row.content,
          tags: row.tags,
          visibility: row.visibility,
          productionVersionId: row.production_version_id,
          publishedVersionId: row.published_version_id,
          publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
          communityStatus: row.community_status === 'submitted' ? 'submitted' : 'none',
          communitySubmittedVersionId: row.community_submitted_version_id,
          communitySubmittedAt: row.community_submitted_at ? new Date(row.community_submitted_at).toISOString() : null,
          communitySubmissionUrl: row.community_submission_url,
          communitySubmissionNote: row.community_submission_note ?? '',
          accessGrants: row.access_grants,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspacePromptsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspacePrompt(item)
    )
  }

  async writeWorkspacePrompts(workspaceId: string, items: OpenPortWorkspacePrompt[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspacePrompt(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_prompts
              WHERE workspace_id = $1
                AND NOT (prompt_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_prompts WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_prompts (
                prompt_id,
                workspace_id,
                title,
                command,
                description,
                content,
                tags,
                visibility,
                production_version_id,
                published_version_id,
                published_at,
                community_status,
                community_submitted_version_id,
                community_submitted_at,
                community_submission_url,
                community_submission_note,
                access_grants,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19)
              ON CONFLICT (prompt_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                title = EXCLUDED.title,
                command = EXCLUDED.command,
                description = EXCLUDED.description,
                content = EXCLUDED.content,
                tags = EXCLUDED.tags,
                visibility = EXCLUDED.visibility,
                production_version_id = EXCLUDED.production_version_id,
                published_version_id = EXCLUDED.published_version_id,
                published_at = EXCLUDED.published_at,
                community_status = EXCLUDED.community_status,
                community_submitted_version_id = EXCLUDED.community_submitted_version_id,
                community_submitted_at = EXCLUDED.community_submitted_at,
                community_submission_url = EXCLUDED.community_submission_url,
                community_submission_note = EXCLUDED.community_submission_note,
                access_grants = EXCLUDED.access_grants,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.title,
              item.command,
              item.description,
              item.content,
              JSON.stringify(item.tags),
              item.visibility,
              item.productionVersionId,
              item.publishedVersionId,
              item.publishedAt,
              item.communityStatus,
              item.communitySubmittedVersionId,
              item.communitySubmittedAt,
              item.communitySubmissionUrl,
              item.communitySubmissionNote,
              JSON.stringify(item.accessGrants),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspacePromptsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspacePromptVersions(workspaceId: string): Promise<OpenPortWorkspacePromptVersion[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        version_id: string
        prompt_id: string
        workspace_id: string
        title: string
        command: string
        description: string
        content: string
        tags: string[]
        version_label: string
        commit_message: string
        saved_at: Date | string
      }>(
        `
          SELECT version_id, prompt_id, workspace_id, title, command, description, content, tags, version_label, commit_message, saved_at
          FROM openport_workspace_prompt_versions
          WHERE workspace_id = $1
          ORDER BY saved_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspacePromptVersion({
          id: row.version_id,
          promptId: row.prompt_id,
          workspaceId: row.workspace_id,
          title: row.title,
          command: row.command,
          description: row.description,
          content: row.content,
          tags: row.tags,
          versionLabel: row.version_label,
          commitMessage: row.commit_message,
          savedAt: new Date(row.saved_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspacePromptVersionsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspacePromptVersion(item)
    )
  }

  async writeWorkspacePromptVersions(workspaceId: string, items: OpenPortWorkspacePromptVersion[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspacePromptVersion(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_prompt_versions
              WHERE workspace_id = $1
                AND NOT (version_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_prompt_versions WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_prompt_versions (
                version_id,
                prompt_id,
                workspace_id,
                title,
                command,
                description,
                content,
                tags,
                version_label,
                commit_message,
                saved_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
              ON CONFLICT (version_id) DO UPDATE SET
                prompt_id = EXCLUDED.prompt_id,
                workspace_id = EXCLUDED.workspace_id,
                title = EXCLUDED.title,
                command = EXCLUDED.command,
                description = EXCLUDED.description,
                content = EXCLUDED.content,
                tags = EXCLUDED.tags,
                version_label = EXCLUDED.version_label,
                commit_message = EXCLUDED.commit_message,
                saved_at = EXCLUDED.saved_at
            `,
            [
              item.id,
              item.promptId,
              item.workspaceId,
              item.title,
              item.command,
              item.description,
              item.content,
              JSON.stringify(item.tags),
              item.versionLabel,
              item.commitMessage ?? '',
              item.savedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspacePromptVersionsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceTools(workspaceId: string): Promise<OpenPortWorkspaceTool[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        tool_id: string
        workspace_id: string
        name: string
        description: string
        integration_id: string | null
        enabled: boolean
        scopes: string[]
        tags: string[]
        manifest: string
        valves: Record<string, string>
        valve_schema: OpenPortWorkspaceToolValveSchemaField[]
        examples: OpenPortWorkspaceToolExample[]
        execution_chain: OpenPortWorkspaceTool['executionChain']
        access_grants: OpenPortWorkspaceResourceGrant[]
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT tool_id, workspace_id, name, description, integration_id, enabled, scopes, tags, manifest, valves, valve_schema, examples, execution_chain, access_grants, created_at, updated_at
          FROM openport_workspace_tools
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspaceTool({
          id: row.tool_id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          integrationId: row.integration_id,
          enabled: row.enabled,
          scopes: row.scopes,
          tags: row.tags,
          manifest: row.manifest,
          valves: row.valves,
          valveSchema: row.valve_schema,
          examples: row.examples,
          executionChain: row.execution_chain,
          accessGrants: row.access_grants,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceToolsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceTool(item)
    )
  }

  async readWorkspaceSkills(workspaceId: string): Promise<OpenPortWorkspaceSkill[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        skill_id: string
        workspace_id: string
        name: string
        description: string
        content: string
        tags: string[]
        enabled: boolean
        linked_model_ids: string[]
        linked_tool_ids: string[]
        access_grants: OpenPortWorkspaceResourceGrant[]
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT skill_id, workspace_id, name, description, content, tags, enabled, linked_model_ids, linked_tool_ids, access_grants, created_at, updated_at
          FROM openport_workspace_skills
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )

      return result.rows.map((row) =>
        normalizeWorkspaceSkill({
          id: row.skill_id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          content: row.content,
          tags: row.tags,
          enabled: row.enabled,
          linkedModelIds: row.linked_model_ids,
          linkedToolIds: row.linked_tool_ids,
          accessGrants: row.access_grants,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceSkillsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceSkill(item)
    )
  }

  async writeWorkspaceTools(workspaceId: string, items: OpenPortWorkspaceTool[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceTool(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_tools
              WHERE workspace_id = $1
                AND NOT (tool_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_tools WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_tools (
                tool_id,
                workspace_id,
                name,
                description,
                integration_id,
                enabled,
                scopes,
                tags,
                manifest,
                valves,
                valve_schema,
                examples,
                execution_chain,
                access_grants,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16)
              ON CONFLICT (tool_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                integration_id = EXCLUDED.integration_id,
                enabled = EXCLUDED.enabled,
                scopes = EXCLUDED.scopes,
                tags = EXCLUDED.tags,
                manifest = EXCLUDED.manifest,
                valves = EXCLUDED.valves,
                valve_schema = EXCLUDED.valve_schema,
                examples = EXCLUDED.examples,
                execution_chain = EXCLUDED.execution_chain,
                access_grants = EXCLUDED.access_grants,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.description,
              item.integrationId,
              item.enabled,
              JSON.stringify(item.scopes),
              JSON.stringify(item.tags),
              item.manifest,
              JSON.stringify(item.valves),
              JSON.stringify(item.valveSchema),
              JSON.stringify(item.examples),
              JSON.stringify(item.executionChain),
              JSON.stringify(item.accessGrants),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceToolsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async writeWorkspaceSkills(workspaceId: string, items: OpenPortWorkspaceSkill[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceSkill(item))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_skills
              WHERE workspace_id = $1
                AND NOT (skill_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_skills WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_skills (
                skill_id,
                workspace_id,
                name,
                description,
                content,
                tags,
                enabled,
                linked_model_ids,
                linked_tool_ids,
                access_grants,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)
              ON CONFLICT (skill_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                content = EXCLUDED.content,
                tags = EXCLUDED.tags,
                enabled = EXCLUDED.enabled,
                linked_model_ids = EXCLUDED.linked_model_ids,
                linked_tool_ids = EXCLUDED.linked_tool_ids,
                access_grants = EXCLUDED.access_grants,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.description,
              item.content,
              JSON.stringify(item.tags),
              item.enabled,
              JSON.stringify(item.linkedModelIds),
              JSON.stringify(item.linkedToolIds),
              JSON.stringify(item.accessGrants),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceSkillsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async listWorkspaceIdsWithConnectors(): Promise<string[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{ workspace_id: string }>(
        `
          SELECT DISTINCT workspace_id
          FROM openport_workspace_connectors
          ORDER BY workspace_id
        `
      )
      return result.rows.map((row) => row.workspace_id)
    }

    return Object.keys(this.state.workspaceConnectorsByWorkspace)
  }

  async listWorkspaceIdsWithConnectorTasks(): Promise<string[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{ workspace_id: string }>(
        `
          SELECT DISTINCT workspace_id
          FROM openport_workspace_connector_tasks
          ORDER BY workspace_id
        `
      )
      return result.rows.map((row) => row.workspace_id)
    }

    return Object.keys(this.state.workspaceConnectorTasksByWorkspace)
  }

  async listWorkspaceIdsWithToolRuns(): Promise<string[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{ workspace_id: string }>(
        `
          SELECT DISTINCT workspace_id
          FROM openport_workspace_tool_runs
          ORDER BY workspace_id
        `
      )
      return result.rows.map((row) => row.workspace_id)
    }

    return Object.keys(this.state.workspaceToolRunsByWorkspace)
  }

  async readWorkspaceConnectorCredentials(workspaceId: string): Promise<OpenPortWorkspaceConnectorCredential[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        credential_id: string
        workspace_id: string
        name: string
        provider: OpenPortWorkspaceConnectorCredential['provider']
        description: string
        fields: OpenPortWorkspaceConnectorCredential['fields']
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT credential_id, workspace_id, name, provider, description, fields, created_at, updated_at
          FROM openport_workspace_connector_credentials
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )
      return result.rows.map((row) =>
        normalizeWorkspaceConnectorCredential({
          id: row.credential_id,
          workspaceId: row.workspace_id,
          name: row.name,
          provider: row.provider,
          description: row.description,
          fields: row.fields,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }
    return structuredClone(this.state.workspaceConnectorCredentialsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceConnectorCredential(item)
    )
  }

  async writeWorkspaceConnectorCredentials(
    workspaceId: string,
    items: OpenPortWorkspaceConnectorCredential[]
  ): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceConnectorCredential(item))
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_connector_credentials
              WHERE workspace_id = $1
                AND NOT (credential_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_connector_credentials WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_connector_credentials (
                credential_id,
                workspace_id,
                name,
                provider,
                description,
                fields,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
              ON CONFLICT (credential_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                provider = EXCLUDED.provider,
                description = EXCLUDED.description,
                fields = EXCLUDED.fields,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.provider,
              item.description,
              JSON.stringify(item.fields),
              item.createdAt,
              item.updatedAt
            ]
          )
        }

        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceConnectorCredentialsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceConnectors(workspaceId: string): Promise<OpenPortWorkspaceConnector[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        connector_id: string
        workspace_id: string
        name: string
        adapter: OpenPortWorkspaceConnector['adapter']
        description: string
        enabled: boolean
        credential_id: string | null
        tags: string[]
        schedule: OpenPortWorkspaceConnector['schedule']
        sync_policy: OpenPortWorkspaceConnector['syncPolicy']
        source_config: OpenPortWorkspaceConnector['sourceConfig']
        status: OpenPortWorkspaceConnector['status']
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT connector_id, workspace_id, name, adapter, description, enabled, credential_id, tags, schedule, sync_policy, source_config, status, created_at, updated_at
          FROM openport_workspace_connectors
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
        `,
        [workspaceId]
      )
      return result.rows.map((row) =>
        normalizeWorkspaceConnector({
          id: row.connector_id,
          workspaceId: row.workspace_id,
          name: row.name,
          adapter: row.adapter,
          description: row.description,
          enabled: row.enabled,
          credentialId: row.credential_id,
          tags: row.tags,
          schedule: row.schedule,
          syncPolicy: row.sync_policy,
          sourceConfig: row.source_config,
          status: row.status,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceConnectorsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceConnector(item)
    )
  }

  async writeWorkspaceConnectors(workspaceId: string, items: OpenPortWorkspaceConnector[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceConnector(item))
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_connectors
              WHERE workspace_id = $1
                AND NOT (connector_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_connectors WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_connectors (
                connector_id,
                workspace_id,
                name,
                adapter,
                description,
                enabled,
                credential_id,
                tags,
                schedule,
                sync_policy,
                source_config,
                status,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)
              ON CONFLICT (connector_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                name = EXCLUDED.name,
                adapter = EXCLUDED.adapter,
                description = EXCLUDED.description,
                enabled = EXCLUDED.enabled,
                credential_id = EXCLUDED.credential_id,
                tags = EXCLUDED.tags,
                schedule = EXCLUDED.schedule,
                sync_policy = EXCLUDED.sync_policy,
                source_config = EXCLUDED.source_config,
                status = EXCLUDED.status,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.name,
              item.adapter,
              item.description,
              item.enabled,
              item.credentialId,
              JSON.stringify(item.tags),
              JSON.stringify(item.schedule),
              JSON.stringify(item.syncPolicy),
              JSON.stringify(item.sourceConfig),
              JSON.stringify(item.status),
              item.createdAt,
              item.updatedAt
            ]
          )
        }
        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceConnectorsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceConnectorTasks(workspaceId: string): Promise<OpenPortWorkspaceConnectorTask[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        task_id: string
        workspace_id: string
        connector_id: string
        trigger: OpenPortWorkspaceConnectorTask['trigger']
        mode: OpenPortWorkspaceConnectorTask['mode']
        status: OpenPortWorkspaceConnectorTask['status']
        attempt: number
        max_attempts: number
        scheduled_at: Date | string
        started_at: Date | string | null
        finished_at: Date | string | null
        retry_of_task_id: string | null
        next_retry_at: Date | string | null
        error_message: string | null
        summary: OpenPortWorkspaceConnectorTask['summary']
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT task_id, workspace_id, connector_id, trigger, mode, status, attempt, max_attempts, scheduled_at, started_at, finished_at, retry_of_task_id, next_retry_at, error_message, summary, created_at, updated_at
          FROM openport_workspace_connector_tasks
          WHERE workspace_id = $1
          ORDER BY created_at DESC
        `,
        [workspaceId]
      )
      return result.rows.map((row) =>
        normalizeWorkspaceConnectorTask({
          id: row.task_id,
          workspaceId: row.workspace_id,
          connectorId: row.connector_id,
          trigger: row.trigger,
          mode: row.mode,
          status: row.status,
          attempt: row.attempt,
          maxAttempts: row.max_attempts,
          scheduledAt: new Date(row.scheduled_at).toISOString(),
          startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
          finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
          retryOfTaskId: row.retry_of_task_id,
          nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at).toISOString() : null,
          errorMessage: row.error_message,
          summary: row.summary,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceConnectorTasksByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceConnectorTask(item)
    )
  }

  async writeWorkspaceConnectorTasks(workspaceId: string, items: OpenPortWorkspaceConnectorTask[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceConnectorTask(item))
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_connector_tasks
              WHERE workspace_id = $1
                AND NOT (task_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_connector_tasks WHERE workspace_id = $1', [workspaceId])
        }
        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_connector_tasks (
                task_id,
                workspace_id,
                connector_id,
                trigger,
                mode,
                status,
                attempt,
                max_attempts,
                scheduled_at,
                started_at,
                finished_at,
                retry_of_task_id,
                next_retry_at,
                error_message,
                summary,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
              ON CONFLICT (task_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                connector_id = EXCLUDED.connector_id,
                trigger = EXCLUDED.trigger,
                mode = EXCLUDED.mode,
                status = EXCLUDED.status,
                attempt = EXCLUDED.attempt,
                max_attempts = EXCLUDED.max_attempts,
                scheduled_at = EXCLUDED.scheduled_at,
                started_at = EXCLUDED.started_at,
                finished_at = EXCLUDED.finished_at,
                retry_of_task_id = EXCLUDED.retry_of_task_id,
                next_retry_at = EXCLUDED.next_retry_at,
                error_message = EXCLUDED.error_message,
                summary = EXCLUDED.summary,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.connectorId,
              item.trigger,
              item.mode,
              item.status,
              item.attempt,
              item.maxAttempts,
              item.scheduledAt,
              item.startedAt,
              item.finishedAt,
              item.retryOfTaskId,
              item.nextRetryAt,
              item.errorMessage,
              JSON.stringify(item.summary),
              item.createdAt,
              item.updatedAt
            ]
          )
        }
        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceConnectorTasksByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceConnectorAuditEvents(workspaceId: string): Promise<OpenPortWorkspaceConnectorAuditEvent[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        event_id: string
        workspace_id: string
        connector_id: string
        task_id: string | null
        level: OpenPortWorkspaceConnectorAuditEvent['level']
        action: string
        message: string
        detail: string
        created_at: Date | string
      }>(
        `
          SELECT event_id, workspace_id, connector_id, task_id, level, action, message, detail, created_at
          FROM openport_workspace_connector_audit_events
          WHERE workspace_id = $1
          ORDER BY created_at DESC
        `,
        [workspaceId]
      )
      return result.rows.map((row) =>
        normalizeWorkspaceConnectorAuditEvent({
          id: row.event_id,
          workspaceId: row.workspace_id,
          connectorId: row.connector_id,
          taskId: row.task_id,
          level: row.level,
          action: row.action,
          message: row.message,
          detail: row.detail,
          createdAt: new Date(row.created_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceConnectorAuditEventsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceConnectorAuditEvent(item)
    )
  }

  async writeWorkspaceConnectorAuditEvents(
    workspaceId: string,
    items: OpenPortWorkspaceConnectorAuditEvent[]
  ): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceConnectorAuditEvent(item))
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_connector_audit_events
              WHERE workspace_id = $1
                AND NOT (event_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_connector_audit_events WHERE workspace_id = $1', [workspaceId])
        }
        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_connector_audit_events (
                event_id,
                workspace_id,
                connector_id,
                task_id,
                level,
                action,
                message,
                detail,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (event_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                connector_id = EXCLUDED.connector_id,
                task_id = EXCLUDED.task_id,
                level = EXCLUDED.level,
                action = EXCLUDED.action,
                message = EXCLUDED.message,
                detail = EXCLUDED.detail,
                created_at = EXCLUDED.created_at
            `,
            [
              item.id,
              item.workspaceId,
              item.connectorId,
              item.taskId,
              item.level,
              item.action,
              item.message,
              item.detail,
              item.createdAt
            ]
          )
        }
        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceConnectorAuditEventsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readWorkspaceToolRuns(workspaceId: string): Promise<OpenPortWorkspaceToolRun[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        run_id: string
        workspace_id: string
        tool_id: string
        trigger: OpenPortWorkspaceToolRun['trigger']
        status: OpenPortWorkspaceToolRun['status']
        debug: boolean
        replay_of_run_id: string | null
        input_payload: string
        output_payload: string
        error_message: string | null
        steps: OpenPortWorkspaceToolRun['steps']
        started_at: Date | string | null
        finished_at: Date | string | null
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT run_id, workspace_id, tool_id, trigger, status, debug, replay_of_run_id, input_payload, output_payload, error_message, steps, started_at, finished_at, created_at, updated_at
          FROM openport_workspace_tool_runs
          WHERE workspace_id = $1
          ORDER BY created_at DESC
        `,
        [workspaceId]
      )
      return result.rows.map((row) =>
        normalizeWorkspaceToolRun({
          id: row.run_id,
          workspaceId: row.workspace_id,
          toolId: row.tool_id,
          trigger: row.trigger,
          status: row.status,
          debug: row.debug,
          replayOfRunId: row.replay_of_run_id,
          inputPayload: row.input_payload,
          outputPayload: row.output_payload,
          errorMessage: row.error_message,
          steps: row.steps,
          startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
          finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        })
      )
    }

    return structuredClone(this.state.workspaceToolRunsByWorkspace[workspaceId] || []).map((item) =>
      normalizeWorkspaceToolRun(item)
    )
  }

  async writeWorkspaceToolRuns(workspaceId: string, items: OpenPortWorkspaceToolRun[]): Promise<void> {
    const normalizedItems = structuredClone(items).map((item) => normalizeWorkspaceToolRun(item))
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ids = normalizedItems.map((item) => item.id)
        if (ids.length > 0) {
          await client.query(
            `
              DELETE FROM openport_workspace_tool_runs
              WHERE workspace_id = $1
                AND NOT (run_id = ANY($2::text[]))
            `,
            [workspaceId, ids]
          )
        } else {
          await client.query('DELETE FROM openport_workspace_tool_runs WHERE workspace_id = $1', [workspaceId])
        }

        for (const item of normalizedItems) {
          await client.query(
            `
              INSERT INTO openport_workspace_tool_runs (
                run_id,
                workspace_id,
                tool_id,
                trigger,
                status,
                debug,
                replay_of_run_id,
                input_payload,
                output_payload,
                error_message,
                steps,
                started_at,
                finished_at,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)
              ON CONFLICT (run_id) DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                tool_id = EXCLUDED.tool_id,
                trigger = EXCLUDED.trigger,
                status = EXCLUDED.status,
                debug = EXCLUDED.debug,
                replay_of_run_id = EXCLUDED.replay_of_run_id,
                input_payload = EXCLUDED.input_payload,
                output_payload = EXCLUDED.output_payload,
                error_message = EXCLUDED.error_message,
                steps = EXCLUDED.steps,
                started_at = EXCLUDED.started_at,
                finished_at = EXCLUDED.finished_at,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
              item.id,
              item.workspaceId,
              item.toolId,
              item.trigger,
              item.status,
              item.debug,
              item.replayOfRunId,
              item.inputPayload,
              item.outputPayload,
              item.errorMessage,
              JSON.stringify(item.steps),
              item.startedAt,
              item.finishedAt,
              item.createdAt,
              item.updatedAt
            ]
          )
        }
        await client.query('COMMIT')
        return
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    this.state.workspaceToolRunsByWorkspace[workspaceId] = normalizedItems
    this.flush()
  }

  async readSearchHistory(workspaceId: string, userId: string, limit = 12): Promise<OpenPortSearchHistoryItem[]> {
    const cappedLimit = Math.max(1, Math.min(limit, 50))

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const result = await pool.query<{
        entry_id: string
        query: string
        usage_count: number
        last_result_count: number | null
        top_result_type: string | null
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT entry_id, query, usage_count, last_result_count, top_result_type, created_at, updated_at
          FROM openport_search_history
          WHERE workspace_id = $1 AND user_id = $2
          ORDER BY updated_at DESC
          LIMIT $3
        `,
        [workspaceId, userId, cappedLimit]
      )

      return result.rows
        .map((row) =>
          normalizeSearchHistoryEntry({
            id: row.entry_id,
            query: row.query,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
            count: Number(row.usage_count),
            lastResultCount: row.last_result_count ?? undefined,
            topResultType: row.top_result_type as OpenPortSearchHistoryItem['topResultType']
          })
        )
        .filter((item): item is OpenPortSearchHistoryItem => item !== null)
    }

    const scopeKey = buildSearchHistoryScopeKey(workspaceId, userId)
    return (structuredClone(this.state.searchHistoryByScope[scopeKey] || [])
      .map((item) => normalizeSearchHistoryEntry(item))
      .filter((item): item is OpenPortSearchHistoryItem => item !== null)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, cappedLimit))
  }

  async trackSearchHistory(
    workspaceId: string,
    userId: string,
    input: {
      query: string
      lastResultCount?: number
      topResultType?: OpenPortSearchHistoryItem['topResultType']
    }
  ): Promise<OpenPortSearchHistoryItem[]> {
    const query = input.query.trim()
    if (!query || query.length < 2) {
      return this.readSearchHistory(workspaceId, userId)
    }

    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      const client = await pool.connect()
      const timestamp = new Date().toISOString()

      try {
        await client.query('BEGIN')
        const existing = await client.query<{ entry_id: string }>(
          `
            SELECT entry_id
            FROM openport_search_history
            WHERE workspace_id = $1
              AND user_id = $2
              AND LOWER(query) = LOWER($3)
            LIMIT 1
          `,
          [workspaceId, userId, query]
        )

        if (existing.rows[0]?.entry_id) {
          await client.query(
            `
              UPDATE openport_search_history
              SET usage_count = usage_count + 1,
                  last_result_count = $1,
                  top_result_type = $2,
                  updated_at = $3
              WHERE entry_id = $4
            `,
            [
              typeof input.lastResultCount === 'number' ? Math.max(0, Math.floor(input.lastResultCount)) : null,
              input.topResultType || null,
              timestamp,
              existing.rows[0].entry_id
            ]
          )
        } else {
          await client.query(
            `
              INSERT INTO openport_search_history (
                entry_id,
                workspace_id,
                user_id,
                query,
                usage_count,
                last_result_count,
                top_result_type,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
              `search_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              workspaceId,
              userId,
              query,
              1,
              typeof input.lastResultCount === 'number' ? Math.max(0, Math.floor(input.lastResultCount)) : null,
              input.topResultType || null,
              timestamp,
              timestamp
            ]
          )
        }

        await client.query(
          `
            DELETE FROM openport_search_history
            WHERE workspace_id = $1
              AND user_id = $2
              AND entry_id NOT IN (
                SELECT entry_id
                FROM openport_search_history
                WHERE workspace_id = $1
                  AND user_id = $2
                ORDER BY updated_at DESC
                LIMIT 20
              )
          `,
          [workspaceId, userId]
        )

        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      return this.readSearchHistory(workspaceId, userId)
    }

    const scopeKey = buildSearchHistoryScopeKey(workspaceId, userId)
    const current = await this.readSearchHistory(workspaceId, userId, 20)
    const existing = current.find((item) => item.query.toLowerCase() === query.toLowerCase())
    const now = new Date().toISOString()

    const nextItem: OpenPortSearchHistoryItem = {
      id: existing?.id || `search_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      query,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      count: (existing?.count ?? 0) + 1,
      lastResultCount:
        typeof input.lastResultCount === 'number'
          ? Math.max(0, Math.floor(input.lastResultCount))
          : existing?.lastResultCount,
      topResultType: input.topResultType ?? existing?.topResultType ?? null
    }

    this.state.searchHistoryByScope[scopeKey] = [
      nextItem,
      ...current.filter((item) => item.query.toLowerCase() !== query.toLowerCase())
    ].slice(0, 20)
    this.flush()
    return this.readSearchHistory(workspaceId, userId)
  }

  async removeSearchHistory(workspaceId: string, userId: string, entryId: string): Promise<OpenPortSearchHistoryItem[]> {
    if (this.backend === 'postgres') {
      const pool = this.requirePool()
      await pool.query(
        `
          DELETE FROM openport_search_history
          WHERE workspace_id = $1
            AND user_id = $2
            AND entry_id = $3
        `,
        [workspaceId, userId, entryId]
      )
      return this.readSearchHistory(workspaceId, userId)
    }

    const scopeKey = buildSearchHistoryScopeKey(workspaceId, userId)
    this.state.searchHistoryByScope[scopeKey] = (this.state.searchHistoryByScope[scopeKey] || []).filter(
      (item) => item.id !== entryId
    )
    this.flush()
    return this.readSearchHistory(workspaceId, userId)
  }

  private loadState(): ProductApiState {
    try {
      if (!existsSync(this.stateFilePath)) {
        this.ensureParentDirectory()
        return createEmptyState()
      }

      const raw = readFileSync(this.stateFilePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ProductApiState>

      return {
        version: 18,
        chatSessionsByUser:
          parsed.chatSessionsByUser && typeof parsed.chatSessionsByUser === 'object'
            ? parsed.chatSessionsByUser
            : {},
        projectsByWorkspace:
          parsed.projectsByWorkspace && typeof parsed.projectsByWorkspace === 'object'
            ? parsed.projectsByWorkspace
            : {},
        knowledgeItemsByWorkspace:
          parsed.knowledgeItemsByWorkspace && typeof parsed.knowledgeItemsByWorkspace === 'object'
            ? parsed.knowledgeItemsByWorkspace
            : {},
        knowledgeCollectionsByWorkspace:
          parsed.knowledgeCollectionsByWorkspace && typeof parsed.knowledgeCollectionsByWorkspace === 'object'
            ? parsed.knowledgeCollectionsByWorkspace
            : {},
        projectAssetsByWorkspace:
          parsed.projectAssetsByWorkspace && typeof parsed.projectAssetsByWorkspace === 'object'
            ? parsed.projectAssetsByWorkspace
            : {},
        knowledgeChunksByWorkspace:
          parsed.knowledgeChunksByWorkspace && typeof parsed.knowledgeChunksByWorkspace === 'object'
            ? parsed.knowledgeChunksByWorkspace
            : {},
        denseKnowledgeChunksByWorkspace:
          parsed.denseKnowledgeChunksByWorkspace && typeof parsed.denseKnowledgeChunksByWorkspace === 'object'
            ? parsed.denseKnowledgeChunksByWorkspace
            : {},
        knowledgeSourceGrantsByWorkspace:
          parsed.knowledgeSourceGrantsByWorkspace && typeof parsed.knowledgeSourceGrantsByWorkspace === 'object'
            ? parsed.knowledgeSourceGrantsByWorkspace
            : {},
        knowledgeChunkGrantsByWorkspace:
          parsed.knowledgeChunkGrantsByWorkspace && typeof parsed.knowledgeChunkGrantsByWorkspace === 'object'
            ? parsed.knowledgeChunkGrantsByWorkspace
            : {},
        workspaceGroupsByWorkspace:
          parsed.workspaceGroupsByWorkspace && typeof parsed.workspaceGroupsByWorkspace === 'object'
            ? parsed.workspaceGroupsByWorkspace
            : {},
        workspaceModelsByWorkspace:
          parsed.workspaceModelsByWorkspace && typeof parsed.workspaceModelsByWorkspace === 'object'
            ? parsed.workspaceModelsByWorkspace
            : {},
        workspacePromptsByWorkspace:
          parsed.workspacePromptsByWorkspace && typeof parsed.workspacePromptsByWorkspace === 'object'
            ? parsed.workspacePromptsByWorkspace
            : {},
        workspacePromptVersionsByWorkspace:
          parsed.workspacePromptVersionsByWorkspace && typeof parsed.workspacePromptVersionsByWorkspace === 'object'
            ? parsed.workspacePromptVersionsByWorkspace
            : {},
        workspaceSkillsByWorkspace:
          parsed.workspaceSkillsByWorkspace && typeof parsed.workspaceSkillsByWorkspace === 'object'
            ? parsed.workspaceSkillsByWorkspace
            : {},
        workspaceToolsByWorkspace:
          parsed.workspaceToolsByWorkspace && typeof parsed.workspaceToolsByWorkspace === 'object'
            ? parsed.workspaceToolsByWorkspace
            : {},
        workspaceConnectorCredentialsByWorkspace:
          parsed.workspaceConnectorCredentialsByWorkspace && typeof parsed.workspaceConnectorCredentialsByWorkspace === 'object'
            ? parsed.workspaceConnectorCredentialsByWorkspace
            : {},
        workspaceConnectorsByWorkspace:
          parsed.workspaceConnectorsByWorkspace && typeof parsed.workspaceConnectorsByWorkspace === 'object'
            ? parsed.workspaceConnectorsByWorkspace
            : {},
        workspaceConnectorTasksByWorkspace:
          parsed.workspaceConnectorTasksByWorkspace && typeof parsed.workspaceConnectorTasksByWorkspace === 'object'
            ? parsed.workspaceConnectorTasksByWorkspace
            : {},
        workspaceConnectorAuditEventsByWorkspace:
          parsed.workspaceConnectorAuditEventsByWorkspace && typeof parsed.workspaceConnectorAuditEventsByWorkspace === 'object'
            ? parsed.workspaceConnectorAuditEventsByWorkspace
            : {},
        workspaceToolRunsByWorkspace:
          parsed.workspaceToolRunsByWorkspace && typeof parsed.workspaceToolRunsByWorkspace === 'object'
            ? parsed.workspaceToolRunsByWorkspace
            : {},
        searchHistoryByScope:
          parsed.searchHistoryByScope && typeof parsed.searchHistoryByScope === 'object'
            ? parsed.searchHistoryByScope
            : {},
        ollamaConfigByWorkspace:
          parsed.ollamaConfigByWorkspace && typeof parsed.ollamaConfigByWorkspace === 'object'
            ? (parsed.ollamaConfigByWorkspace as Record<string, OllamaWorkspaceConfig>)
            : {}
      }
    } catch (error) {
      this.logger.warn(
        `Falling back to empty API state because persisted state could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return createEmptyState()
    }
  }

  private flush(): void {
    this.ensureParentDirectory()
    const tempPath = `${this.stateFilePath}.tmp`
    writeFileSync(tempPath, JSON.stringify(this.state, null, 2))
    renameSync(tempPath, this.stateFilePath)
  }

  private ensureParentDirectory(): void {
    mkdirSync(path.dirname(this.stateFilePath), { recursive: true })
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Postgres state pool is not initialized')
    }

    return this.pool
  }
}
