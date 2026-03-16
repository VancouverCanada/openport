import type {
  OpenPortChatSession,
  OpenPortChatSettings,
  OpenPortWorkspaceModel,
  OpenPortProjectGrant,
  OpenPortProjectKnowledgeItem
} from '@openport/product-contracts'
import type { OpenPortChatUiPreferences } from './chat-ui-preferences'
import { getInheritedChatSettings } from './chat-defaults'

export type { OpenPortChatSettings }

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
  files: OpenPortProjectFile[]
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

export type OpenPortProjectOption = {
  id: string
  label: string
  depth: number
}

export type OpenPortProjectInput = {
  name: string
  parentId?: string | null
  isExpanded?: boolean
  meta?: Partial<OpenPortProjectMeta>
  data?: Partial<OpenPortProjectData>
}

export type OpenPortProjectExportBundle = {
  exportedAt: string
  project: OpenPortProject
  descendants: OpenPortProject[]
  chats: OpenPortChatSession[]
}

const PROJECTS_KEY = 'openport.web.chat.projects'
const KNOWLEDGE_KEY = 'openport.web.chat.project-knowledge'
const SETTINGS_KEY = 'openport.web.chat.settings'
const HISTORY_GROUPS_KEY = 'openport.web.chat.history-groups'
const WORKSPACE_EVENT = 'openport-chat-workspace:update'

function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

function emitWorkspaceUpdate(): void {
  if (!canUseStorage()) return
  window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT))
}

function compareProjects(left: OpenPortProject, right: OpenPortProject): number {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function getDefaultProjectMeta(): OpenPortProjectMeta {
  return {
    backgroundImageUrl: null,
    backgroundImageAssetId: null,
    description: '',
    icon: null,
    color: null,
    hiddenInSidebar: false
  }
}

function getDefaultProjectData(): OpenPortProjectData {
  return {
    systemPrompt: '',
    defaultModelRoute: null,
    files: []
  }
}

function normalizeProjectFile(item: unknown): OpenPortProjectFile | null {
  if (!item || typeof item !== 'object') return null

  const candidate = item as Partial<OpenPortProjectFile>
  if (typeof candidate.name !== 'string') return null

  return {
    id:
      typeof candidate.id === 'string'
        ? candidate.id
        : `file_${Math.random().toString(36).slice(2, 10)}`,
    name: candidate.name,
    type: typeof candidate.type === 'string' ? candidate.type : 'application/octet-stream',
    size: typeof candidate.size === 'number' ? candidate.size : 0,
    addedAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : Date.now(),
    selected: typeof candidate.selected === 'boolean' ? candidate.selected : true,
    knowledgeItemId: typeof candidate.knowledgeItemId === 'string' ? candidate.knowledgeItemId : null,
    assetId: typeof candidate.assetId === 'string' ? candidate.assetId : null
  }
}

function normalizeStoredProject(item: unknown): OpenPortProject | null {
  if (!item || typeof item !== 'object') return null

  const candidate = item as Partial<OpenPortProject> & {
    parent_id?: string | null
    is_expanded?: boolean
    updated_at?: number
    meta?: {
      background_image_url?: string | null
      backgroundImageUrl?: string | null
      backgroundImageAssetId?: string | null
      background_image_asset_id?: string | null
      description?: string
      icon?: string | null
      color?: string | null
      hiddenInSidebar?: boolean
      hidden_in_sidebar?: boolean
    }
    data?: {
      system_prompt?: string
      systemPrompt?: string
      default_model_route?: string | null
      defaultModelRoute?: string | null
      files?: unknown[]
    }
  }

  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
    return null
  }

  const createdAt =
    typeof candidate.createdAt === 'number'
      ? candidate.createdAt
      : typeof candidate.updated_at === 'number'
        ? candidate.updated_at
        : Date.now()

  const updatedAt =
    typeof candidate.updatedAt === 'number'
      ? candidate.updatedAt
      : typeof candidate.updated_at === 'number'
        ? candidate.updated_at
        : createdAt

  const meta = {
    ...getDefaultProjectMeta(),
    backgroundImageUrl:
      candidate.meta?.backgroundImageUrl ??
      candidate.meta?.background_image_url ??
      candidate.meta?.backgroundImageUrl ??
      null,
    backgroundImageAssetId:
      candidate.meta?.backgroundImageAssetId ??
      candidate.meta?.background_image_asset_id ??
      null,
    description: typeof candidate.meta?.description === 'string' ? candidate.meta.description : '',
    icon: typeof candidate.meta?.icon === 'string' ? candidate.meta.icon : null,
    color: typeof candidate.meta?.color === 'string' ? candidate.meta.color : null,
    hiddenInSidebar:
      typeof candidate.meta?.hiddenInSidebar === 'boolean'
        ? candidate.meta.hiddenInSidebar
        : typeof candidate.meta?.hidden_in_sidebar === 'boolean'
          ? candidate.meta.hidden_in_sidebar
          : false
  }

  const data = {
    ...getDefaultProjectData(),
    systemPrompt: candidate.data?.systemPrompt ?? candidate.data?.system_prompt ?? '',
    defaultModelRoute:
      candidate.data?.defaultModelRoute ??
      candidate.data?.default_model_route ??
      null,
    files: Array.isArray(candidate.data?.files)
      ? candidate.data.files
          .map((entry) => normalizeProjectFile(entry))
          .filter((entry): entry is OpenPortProjectFile => Boolean(entry))
      : []
  }

  return {
    id: candidate.id,
    workspaceId: typeof candidate.workspaceId === 'string' ? candidate.workspaceId : 'ws_user_demo',
    ownerUserId: typeof candidate.ownerUserId === 'string' ? candidate.ownerUserId : 'user_demo',
    name: candidate.name.trim() || 'Untitled project',
    chatIds: Array.isArray(candidate.chatIds)
      ? candidate.chatIds.filter((value): value is string => typeof value === 'string')
      : [],
    createdAt,
    updatedAt,
    parentId:
      typeof candidate.parentId === 'string'
        ? candidate.parentId
        : typeof candidate.parent_id === 'string'
          ? candidate.parent_id
          : null,
    isExpanded:
      typeof candidate.isExpanded === 'boolean'
        ? candidate.isExpanded
        : typeof candidate.is_expanded === 'boolean'
          ? candidate.is_expanded
          : true,
    meta,
    data,
    accessGrants: Array.isArray(candidate.accessGrants) ? candidate.accessGrants : []
  }
}

function saveProjects(projects: OpenPortProject[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  emitWorkspaceUpdate()
}

export function saveProjectsToCache(projects: OpenPortProject[]): void {
  saveProjects(projects)
}

export function loadProjectKnowledge(): OpenPortProjectKnowledgeItem[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OpenPortProjectKnowledgeItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveProjectKnowledgeToCache(items: OpenPortProjectKnowledgeItem[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(items))
  emitWorkspaceUpdate()
}

function mapProjects(
  updater: (projects: OpenPortProject[]) => OpenPortProject[]
): OpenPortProject[] {
  const nextProjects = updater(loadProjects())
  saveProjects(nextProjects)
  return nextProjects
}

function mergeProjectMeta(
  currentValue: OpenPortProjectMeta,
  nextValue?: Partial<OpenPortProjectMeta>
): OpenPortProjectMeta {
  return {
    ...currentValue,
    ...(nextValue || {})
  }
}

function mergeProjectData(
  currentValue: OpenPortProjectData,
  nextValue?: Partial<OpenPortProjectData>
): OpenPortProjectData {
  return {
    ...currentValue,
    ...(nextValue || {}),
    files: Array.isArray(nextValue?.files)
      ? nextValue.files
          .map((entry) => normalizeProjectFile(entry))
          .filter((entry): entry is OpenPortProjectFile => Boolean(entry))
      : currentValue.files
  }
}

function getSiblingNames(
  projects: OpenPortProject[],
  parentId: string | null,
  excludeId?: string
): string[] {
  return projects
    .filter((project) => project.parentId === parentId && project.id !== excludeId)
    .map((project) => project.name.toLowerCase())
}

function createUniqueProjectName(
  projects: OpenPortProject[],
  name: string,
  parentId: string | null,
  excludeId?: string
): string {
  const baseName = normalizeProjectName(name)
  const siblingNames = new Set(getSiblingNames(projects, parentId, excludeId))

  if (!siblingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  let candidate = `${baseName} ${suffix}`
  while (siblingNames.has(candidate.toLowerCase())) {
    suffix += 1
    candidate = `${baseName} ${suffix}`
  }

  return candidate
}

function normalizeProjectInput(
  input: string | OpenPortProjectInput,
  parentIdOverride?: string | null
): OpenPortProjectInput {
  if (typeof input === 'string') {
    return {
      name: input,
      parentId: parentIdOverride ?? null
    }
  }

  return {
    ...input,
    parentId: input.parentId ?? parentIdOverride ?? null
  }
}

export function getWorkspaceEventName(): string {
  return WORKSPACE_EVENT
}

export function loadProjects(): OpenPortProject[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    const normalized = parsed
      .map((item) => normalizeStoredProject(item))
      .filter((item): item is OpenPortProject => Boolean(item))

    const validIds = new Set(normalized.map((project) => project.id))
    const sanitized = normalized
      .map((project) => ({
        ...project,
        parentId: project.parentId && validIds.has(project.parentId) ? project.parentId : null
      }))
      .sort(compareProjects)

    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(sanitized))
    }

    return sanitized
  } catch {
    return []
  }
}

export function getProjectById(projects: OpenPortProject[], projectId: string | null): OpenPortProject | null {
  if (!projectId) return null
  return projects.find((project) => project.id === projectId) || null
}

export function getProjectChildren(projects: OpenPortProject[], parentId: string | null): OpenPortProject[] {
  return projects.filter((project) => project.parentId === parentId).sort(compareProjects)
}

export function getProjectDescendantIds(projects: OpenPortProject[], projectId: string): string[] {
  const descendants: string[] = []
  const stack = [projectId]

  while (stack.length > 0) {
    const current = stack.pop() as string
    const children = projects.filter((project) => project.parentId === current)
    children.forEach((child) => {
      descendants.push(child.id)
      stack.push(child.id)
    })
  }

  return descendants
}

export function getProjectScopeChatIds(projects: OpenPortProject[], projectId: string): string[] {
  const ids = new Set([projectId, ...getProjectDescendantIds(projects, projectId)])
  return projects
    .filter((project) => ids.has(project.id))
    .flatMap((project) => project.chatIds)
}

export function getProjectSubtree(projects: OpenPortProject[], projectId: string): OpenPortProject[] {
  const ids = new Set([projectId, ...getProjectDescendantIds(projects, projectId)])
  return projects.filter((project) => ids.has(project.id)).sort(compareProjects)
}

export function isProjectAncestor(
  projects: OpenPortProject[],
  projectId: string,
  candidateParentId: string | null
): boolean {
  if (!candidateParentId) return false
  if (projectId === candidateParentId) return true

  let currentParentId: string | null = candidateParentId
  while (currentParentId) {
    if (currentParentId === projectId) return true
    currentParentId = getProjectById(projects, currentParentId)?.parentId || null
  }

  return false
}

export function createProject(
  input: string | OpenPortProjectInput,
  parentIdOverride?: string | null
): OpenPortProject | null {
  const normalizedInput = normalizeProjectInput(input, parentIdOverride)
  const trimmed = normalizeProjectName(normalizedInput.name)
  if (!trimmed) return null

  const projects = loadProjects()
  const project: OpenPortProject = {
    id: `project_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId: 'ws_user_demo',
    ownerUserId: 'user_demo',
    name: createUniqueProjectName(projects, trimmed, normalizedInput.parentId ?? null),
    chatIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parentId: normalizedInput.parentId ?? null,
    isExpanded: true,
    meta: mergeProjectMeta(getDefaultProjectMeta(), normalizedInput.meta),
    data: mergeProjectData(getDefaultProjectData(), normalizedInput.data),
    accessGrants: []
  }

  saveProjects([...projects, project].sort(compareProjects))
  return project
}

export function updateProject(
  projectId: string,
  input: Partial<OpenPortProjectInput>
): OpenPortProject | null {
  const projects = loadProjects()
  const project = projects.find((entry) => entry.id === projectId)
  if (!project) return null

  const nextParentId = input.parentId === undefined ? project.parentId : input.parentId
  if (isProjectAncestor(projects, projectId, nextParentId ?? null)) {
    return null
  }

  const nextProject: OpenPortProject = {
    ...project,
    name:
      typeof input.name === 'string' && normalizeProjectName(input.name)
        ? createUniqueProjectName(projects, normalizeProjectName(input.name), nextParentId ?? null, projectId)
        : project.name,
    parentId: nextParentId ?? null,
    meta: mergeProjectMeta(project.meta, input.meta),
    data: mergeProjectData(project.data, input.data),
    updatedAt: Date.now()
  }

  saveProjects(
    projects
      .map((entry) => (entry.id === projectId ? nextProject : entry))
      .sort(compareProjects)
  )

  return nextProject
}

export function renameProject(projectId: string, name: string): OpenPortProject | null {
  return updateProject(projectId, { name })
}

export function toggleProjectExpanded(projectId: string, nextValue?: boolean): OpenPortProject[] {
  return mapProjects((projects) =>
    projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            isExpanded: typeof nextValue === 'boolean' ? nextValue : !project.isExpanded,
            updatedAt: Date.now()
          }
        : project
    )
  )
}

export function moveProject(projectId: string, parentId: string | null): OpenPortProject[] {
  return mapProjects((projects) => {
    const project = projects.find((entry) => entry.id === projectId)
    if (!project) return projects
    if (project.parentId === parentId) return projects
    if (isProjectAncestor(projects, projectId, parentId)) return projects

    const nextName = createUniqueProjectName(projects, project.name, parentId, projectId)

    return projects
      .map((entry) =>
        entry.id === projectId
          ? {
              ...entry,
              parentId,
              name: nextName,
              updatedAt: Date.now()
            }
          : entry
      )
      .sort(compareProjects)
  })
}

export function deleteProject(projectId: string): OpenPortProject[] {
  return mapProjects((projects) => {
    const idsToDelete = new Set([projectId, ...getProjectDescendantIds(projects, projectId)])
    return projects.filter((project) => !idsToDelete.has(project.id))
  })
}

export function assignThreadToProject(threadId: string, projectId: string | null): void {
  if (!threadId) return

  const nextProjects = loadProjects().map((project) => ({
    ...project,
    chatIds:
      project.id === projectId
        ? Array.from(new Set([threadId, ...project.chatIds]))
        : project.chatIds.filter((id) => id !== threadId),
    updatedAt: project.id === projectId || project.chatIds.includes(threadId) ? Date.now() : project.updatedAt
  }))

  saveProjects(nextProjects.sort(compareProjects))
}

export function findProjectForThread(threadId: string): OpenPortProject | null {
  return loadProjects().find((project) => project.chatIds.includes(threadId)) || null
}

export function getProjectOptions(projects: OpenPortProject[]): OpenPortProjectOption[] {
  const options: OpenPortProjectOption[] = []

  function append(parentId: string | null, depth: number): void {
    getProjectChildren(projects, parentId).forEach((project) => {
      options.push({
        id: project.id,
        label: `${depth > 0 ? `${'  '.repeat(depth)}- ` : ''}${project.name}`,
        depth
      })
      append(project.id, depth + 1)
    })
  }

  append(null, 0)
  return options
}

export function getProjectChatSettings(
  projects: OpenPortProject[],
  projectId: string | null,
  options?: {
    models?: OpenPortWorkspaceModel[]
    preferences?: OpenPortChatUiPreferences
  }
): OpenPortChatSettings {
  const project = getProjectById(projects, projectId)
  const baseSettings = getDefaultChatSettings(projectId)
  if (!options?.preferences || !options?.models) {
    return {
      ...baseSettings,
      systemPrompt: project?.data.systemPrompt || '',
      valves: {
        ...baseSettings.valves,
        modelRoute: project?.data.defaultModelRoute || baseSettings.valves.modelRoute
      }
    }
  }
  return getInheritedChatSettings(baseSettings, project, options.preferences, options.models)
}

export function buildProjectExportBundle(
  projectId: string,
  projects: OpenPortProject[],
  chats: OpenPortChatSession[]
): OpenPortProjectExportBundle | null {
  const project = getProjectById(projects, projectId)
  if (!project) return null

  const descendants = getProjectSubtree(projects, projectId).filter((entry) => entry.id !== projectId)
  const scopedIds = new Set([projectId, ...descendants.map((entry) => entry.id)])
  const matchedChats = chats.filter((chat) => chat.settings.projectId && scopedIds.has(chat.settings.projectId))

  return {
    exportedAt: new Date().toISOString(),
    project,
    descendants,
    chats: matchedChats
  }
}

export function loadSettingsMap(): Record<string, OpenPortChatSettings> {
  if (!canUseStorage()) return {}

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, OpenPortChatSettings>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getDefaultChatSettings(projectId: string | null = null): OpenPortChatSettings {
  return {
    projectId,
    systemPrompt: '',
    valves: {
      modelRoute: 'openport/local',
      operatorMode: 'default',
      functionCalling: true
    },
    params: {
      streamResponse: true,
      reasoningEffort: 'medium',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9
    }
  }
}

export function loadThreadSettings(threadId: string, projectId: string | null = null): OpenPortChatSettings {
  if (!threadId) return getDefaultChatSettings(projectId)

  const map = loadSettingsMap()
  return {
    ...getDefaultChatSettings(projectId),
    ...(map[threadId] || {}),
    projectId: map[threadId]?.projectId ?? projectId ?? null
  }
}

export function saveThreadSettings(threadId: string, settings: OpenPortChatSettings): void {
  if (!canUseStorage() || !threadId) return

  const map = loadSettingsMap()
  map[threadId] = settings
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(map))
  emitWorkspaceUpdate()
}

export type OpenPortChatHistoryGroupLabel =
  | 'Today'
  | 'Yesterday'
  | 'Previous 7 days'
  | 'Previous 30 days'
  | 'Earlier'

export type OpenPortChatHistoryGroup = {
  label: OpenPortChatHistoryGroupLabel
  items: OpenPortChatSession[]
}

function toHistoryGroupLabel(value: string): OpenPortChatHistoryGroupLabel {
  if (
    value === 'Today' ||
    value === 'Yesterday' ||
    value === 'Previous 7 days' ||
    value === 'Previous 30 days'
  ) {
    return value
  }

  return 'Earlier'
}

export function groupChatSessionsByTimeRange(
  sessions: OpenPortChatSession[],
  getTimeLabel: (value: string) => string
): OpenPortChatHistoryGroup[] {
  const ordered = [...sessions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )
  const groups = new Map<OpenPortChatHistoryGroupLabel, OpenPortChatSession[]>()

  ordered.forEach((session) => {
    const label = toHistoryGroupLabel(getTimeLabel(session.updatedAt))
    groups.set(label, [...(groups.get(label) || []), session])
  })

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export function loadCollapsedHistoryGroups(): Record<string, boolean> {
  if (!canUseStorage()) return {}

  try {
    const raw = window.localStorage.getItem(HISTORY_GROUPS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCollapsedHistoryGroups(nextValue: Record<string, boolean>): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(HISTORY_GROUPS_KEY, JSON.stringify(nextValue))
  emitWorkspaceUpdate()
}
