import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  OpenPortKnowledgeChunkingOptions,
  OpenPortChatSession,
  OpenPortDeleteProjectResponse,
  OpenPortKnowledgeCollection,
  OpenPortKnowledgeCollectionResponse,
  OpenPortKnowledgeCollectionsResponse,
  OpenPortListResponse,
  OpenPortProject,
  OpenPortProjectAsset,
  OpenPortProjectAssetKind,
  OpenPortProjectAssetResponse,
  OpenPortProjectCollaborationState,
  OpenPortProjectData,
  OpenPortProjectExportBundle,
  OpenPortProjectFile,
  OpenPortProjectGrant,
  OpenPortProjectGrantResponse,
  OpenPortProjectImportResponse,
  OpenPortProjectKnowledgeItem,
  OpenPortProjectKnowledgeBatchMaintenanceAction,
  OpenPortProjectKnowledgeBatchMaintenanceResponse,
  OpenPortProjectKnowledgeResponse,
  OpenPortProjectKnowledgeSearchResponse,
  OpenPortProjectKnowledgeSource,
  OpenPortProjectMeta,
  OpenPortProjectPermission,
  OpenPortProjectResponse,
  OpenPortWorkspaceResourceGrant,
  OpenPortWorkspaceResourceGrantResponse,
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { AuthService } from '../auth/auth.service.js'
import { GroupsService } from '../groups/groups.service.js'
import type { ProjectKnowledgeChunkRecord } from '../storage/api-state-store.service.js'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { ProjectAssetsService } from './project-assets.service.js'
import { ProjectEventsService } from './project-events.service.js'
import type { CreateKnowledgeCollectionDto } from './dto/create-knowledge-collection.dto.js'
import type { DeleteKnowledgeCollectionDto } from './dto/delete-knowledge-collection.dto.js'
import type { CreateProjectKnowledgeWebDto } from './dto/create-project-knowledge-web.dto.js'
import type { MaintainProjectKnowledgeBatchDto } from './dto/maintain-project-knowledge-batch.dto.js'
import type { MaintainProjectKnowledgeSourceDto } from './dto/maintain-project-knowledge-source.dto.js'
import type { RebuildProjectKnowledgeBatchDto } from './dto/rebuild-project-knowledge-batch.dto.js'
import type { RebuildProjectKnowledgeDto } from './dto/rebuild-project-knowledge.dto.js'
import type { UpdateKnowledgeCollectionDto } from './dto/update-knowledge-collection.dto.js'
import type { UpdateKnowledgeItemCollectionDto } from './dto/update-knowledge-item-collection.dto.js'
import {
  buildKnowledgeChunks,
  buildKnowledgePreview,
  decodeTextContent,
  rankKnowledgeChunks,
  type KnowledgeChunkingOptions
} from './project-knowledge-index.js'
import { ProjectRetrievalService } from './project-retrieval.service.js'

export type Actor = {
  userId: string
  workspaceId: string
}

type CollaborationActor = Actor & {
  name: string
  email: string
}

type ProjectInput = {
  name: string
  parentId?: string | null
  isExpanded?: boolean
  meta?: Partial<OpenPortProjectMeta>
  data?: Partial<OpenPortProjectData>
}

type ProjectImportPayload = {
  bundle: Record<string, unknown>
  parentId?: string | null
}

type ProjectKnowledgeUploadInput = {
  name: string
  type?: string
  size?: number
  collectionId?: string
  collectionName?: string
  contentBase64: string
}

type ProjectKnowledgeTextInput = {
  name: string
  collectionId?: string
  collectionName?: string
  contentText: string
}

type ProjectKnowledgeWebInput = {
  url: string
  name?: string
  collectionId?: string
  collectionName?: string
  maxChars?: number
}

type ProjectAssetUploadInput = {
  kind: OpenPortProjectAssetKind
  name: string
  type?: string
  size?: number
  contentBase64: string
}

type ShareProjectInput = {
  principalType: OpenPortProjectGrant['principalType']
  principalId?: string
  permission: OpenPortProjectPermission
}

type ShareKnowledgeResourceInput = {
  principalType: OpenPortWorkspaceResourcePrincipalType
  principalId?: string
  permission: OpenPortWorkspaceResourcePermission
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function resolveKnowledgeCollection(input?: { collectionId?: string | null; collectionName?: string | null }): {
  collectionId: string | null
  collectionName: string
} {
  const normalizedName = normalizeProjectName(input?.collectionName || '')
  const normalizedId = input?.collectionId?.trim() || (normalizedName ? `collection_${slugifySegment(normalizedName)}` : null)
  return {
    collectionId: normalizedId,
    collectionName: normalizedName || 'General'
  }
}

function buildKnowledgeCollectionId(name: string): string {
  return `collection_${slugifySegment(name)}`
}

function defaultKnowledgeSource(item: OpenPortProjectKnowledgeItem): OpenPortProjectKnowledgeSource {
  return {
    id: item.assetId || `${item.id}_source`,
    label: item.contentUrl ? item.name : `${item.name} source`,
    kind: item.assetId ? 'asset' : 'text',
    source: item.source,
    size: item.size
  }
}

function normalizeProjectMeta(meta?: Partial<OpenPortProjectMeta> | null): OpenPortProjectMeta {
  return {
    backgroundImageUrl: meta?.backgroundImageUrl ?? null,
    backgroundImageAssetId: meta?.backgroundImageAssetId ?? null,
    description: typeof meta?.description === 'string' ? meta.description.trim() : '',
    icon: typeof meta?.icon === 'string' && meta.icon.trim().length > 0 ? meta.icon.trim() : null,
    color: typeof meta?.color === 'string' && meta.color.trim().length > 0 ? meta.color.trim() : null,
    hiddenInSidebar: Boolean(meta?.hiddenInSidebar)
  }
}

function normalizeProjectGrant(projectId: string, grant: Partial<OpenPortProjectGrant>): OpenPortProjectGrant | null {
  if (!grant.principalType || !grant.permission) return null

  return {
    id: typeof grant.id === 'string' ? grant.id : `project_grant_${randomUUID()}`,
    projectId,
    principalType: grant.principalType,
    principalId: typeof grant.principalId === 'string' ? grant.principalId : '*',
    permission: grant.permission,
    createdAt: typeof grant.createdAt === 'string' ? grant.createdAt : new Date().toISOString()
  }
}

function normalizeProjectFile(file: Partial<OpenPortProjectFile>): OpenPortProjectFile | null {
  if (typeof file.name !== 'string' || !file.name.trim()) return null

  return {
    id: typeof file.id === 'string' ? file.id : `file_${randomUUID()}`,
    name: file.name.trim(),
    type: typeof file.type === 'string' ? file.type : 'application/octet-stream',
    size: typeof file.size === 'number' ? file.size : 0,
    addedAt: typeof file.addedAt === 'number' ? file.addedAt : Date.now(),
    selected: typeof file.selected === 'boolean' ? file.selected : true,
    knowledgeItemId: typeof file.knowledgeItemId === 'string' ? file.knowledgeItemId : null,
    assetId: typeof file.assetId === 'string' ? file.assetId : null
  }
}

function normalizeProjectData(data?: Partial<OpenPortProjectData> | null): OpenPortProjectData {
  return {
    systemPrompt: typeof data?.systemPrompt === 'string' ? data.systemPrompt : '',
    defaultModelRoute:
      typeof data?.defaultModelRoute === 'string' && data.defaultModelRoute.trim().length > 0
        ? data.defaultModelRoute.trim()
        : null,
    files: Array.isArray(data?.files)
      ? data.files
          .map((file) => normalizeProjectFile(file))
          .filter((file): file is OpenPortProjectFile => Boolean(file))
      : []
  }
}

function compareProjects(left: OpenPortProject, right: OpenPortProject): number {
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
}

function rankPermission(permission: OpenPortProjectPermission): number {
  if (permission === 'admin') return 3
  if (permission === 'write') return 2
  return 1
}

function rankWorkspaceResourcePermission(permission: OpenPortWorkspaceResourcePermission): number {
  if (permission === 'admin') return 3
  if (permission === 'write') return 2
  return 1
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const [first, second] = [Number(match[1]), Number(match[2])]
  if (first === 10) return true
  if (first === 127) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  if (first === 169 && second === 254) return true
  return false
}

function assertKnowledgeWebUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new BadRequestException('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Only HTTP(S) URLs are supported')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    isPrivateIpv4(hostname)
  ) {
    throw new BadRequestException('Local/private URLs are not allowed')
  }

  return parsed
}

function stripHtmlContent(content: string): string {
  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchWebpageSnapshot(
  rawUrl: string,
  options?: {
    maxChars?: number
  }
): Promise<{
  boundedContent: string
  contentType: string
  defaultName: string
  normalizedContent: string
  url: URL
}> {
  const url = assertKnowledgeWebUrl(rawUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'OpenPort/0.1 knowledge-web-ingest'
      },
      signal: controller.signal
    })
  } catch {
    clearTimeout(timeout)
    throw new BadRequestException('Unable to fetch webpage')
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new BadRequestException(`Webpage fetch failed (${response.status})`)
  }

  const contentType = (response.headers.get('content-type') || 'text/plain').toLowerCase()
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('text/plain') &&
    !contentType.includes('application/json') &&
    !contentType.includes('application/xml') &&
    !contentType.includes('text/markdown')
  ) {
    throw new BadRequestException('Unsupported webpage content type')
  }

  const rawContent = await response.text()
  const normalizedContent = contentType.includes('text/html') ? stripHtmlContent(rawContent) : rawContent.trim()
  if (!normalizedContent) {
    throw new BadRequestException('Webpage content is empty')
  }

  const maxChars = Math.max(2000, Math.min(500000, Number(options?.maxChars || 0) || 120000))
  const boundedContent = normalizedContent.slice(0, maxChars)
  const defaultName = normalizeProjectName(url.pathname.split('/').filter(Boolean).pop() || url.hostname || 'Web content')

  return {
    boundedContent,
    contentType,
    defaultName,
    normalizedContent,
    url
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly auth: AuthService,
    private readonly workspaces: WorkspacesService,
    private readonly groups: GroupsService,
    private readonly stateStore: ApiStateStoreService,
    private readonly assets: ProjectAssetsService,
    private readonly events: ProjectEventsService,
    private readonly retrieval: ProjectRetrievalService
  ) {}

  async list(actor: Actor): Promise<OpenPortListResponse<OpenPortProject>> {
    return {
      items: await this.readProjects(actor)
    }
  }

  async listAssets(
    actor: Actor,
    options: {
      kind?: 'background' | 'knowledge' | 'chat' | 'webpage'
      scope?: 'workspace' | 'user'
    } = {}
  ): Promise<OpenPortListResponse<OpenPortProjectAsset>> {
    return {
      items: await this.assets.listAssets(actor, options)
    }
  }

  async deleteAsset(actor: Actor, assetId: string): Promise<{ ok: true }> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    return this.assets.deleteAsset(actor, assetId)
  }

  async createWebAsset(
    actor: Actor,
    input: {
      url: string
      name?: string
      maxChars?: number
    }
  ): Promise<OpenPortProjectAssetResponse> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const snapshot = await fetchWebpageSnapshot(input.url, { maxChars: input.maxChars })
    const assetResponse = await this.assets.upload(actor, {
      kind: 'webpage',
      name: normalizeProjectName(input.name || snapshot.defaultName) || snapshot.defaultName,
      type: 'text/plain',
      size: snapshot.boundedContent.length,
      contentBase64: Buffer.from(snapshot.boundedContent, 'utf8').toString('base64')
    })
    const assets = await this.readAssets(actor)
    const nextAssets = assets.map((asset) =>
      asset.id === assetResponse.asset.id
        ? {
            ...asset,
            sourceUrl: snapshot.url.toString(),
            previewText: buildKnowledgePreview(snapshot.boundedContent)
          }
        : asset
    )
    await this.stateStore.writeProjectAssets(actor.workspaceId, nextAssets)
    return {
      asset: nextAssets.find((asset) => asset.id === assetResponse.asset.id) || assetResponse.asset
    }
  }

  async get(actor: Actor, projectId: string): Promise<OpenPortProjectResponse> {
    return {
      project: await this.requireProject(actor, projectId, 'read')
    }
  }

  async create(actor: Actor, input: ProjectInput): Promise<OpenPortProjectResponse> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)

    const name = normalizeProjectName(input.name)
    if (!name) {
      throw new BadRequestException('Project name cannot be empty')
    }

    const allProjects = await this.readAllProjects(actor)
    const parentId = input.parentId ?? null
    if (parentId) {
      this.requireProjectInCollection(allProjects, parentId)
    }

    const knowledge = await this.readKnowledge(actor)
    const assets = await this.readAssets(actor)
    const project: OpenPortProject = {
      id: `project_${randomUUID()}`,
      workspaceId: actor.workspaceId,
      ownerUserId: actor.userId,
      name: this.createUniqueProjectName(allProjects, name, parentId),
      chatIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId,
      isExpanded: typeof input.isExpanded === 'boolean' ? input.isExpanded : true,
      meta: this.normalizeProjectMetaAgainstAssets(normalizeProjectMeta(input.meta), assets),
      data: this.normalizeFilesAgainstKnowledge(knowledge, normalizeProjectData(input.data)),
      accessGrants: [
        this.buildGrant({
          projectId: `pending`,
          principalType: 'workspace',
          principalId: actor.workspaceId,
          permission: 'write'
        })
      ]
    }

    project.accessGrants = [
      this.buildGrant({
        projectId: project.id,
        principalType: 'workspace',
        principalId: actor.workspaceId,
        permission: 'write'
      })
    ]

    await this.writeProjects(actor.workspaceId, [...allProjects, project])
    this.events.emit(actor.workspaceId, 'project.created', project.id, actor.userId, { name: project.name })
    return { project }
  }

  async update(actor: Actor, projectId: string, input: Partial<ProjectInput>): Promise<OpenPortProjectResponse> {
    const allProjects = await this.readAllProjects(actor)
    const project = await this.requireProject(actor, projectId, 'write', allProjects)
    const nextParentId = input.parentId === undefined ? project.parentId : input.parentId ?? null

    if (nextParentId && !allProjects.some((entry) => entry.id === nextParentId)) {
      throw new NotFoundException('Parent project not found')
    }
    if (this.isProjectAncestor(allProjects, projectId, nextParentId)) {
      throw new BadRequestException('Project cannot be moved inside its own subtree')
    }

    const [knowledge, assets] = await Promise.all([this.readKnowledge(actor), this.readAssets(actor)])
    const nextProject: OpenPortProject = {
      ...project,
      name:
        typeof input.name === 'string' && normalizeProjectName(input.name)
          ? this.createUniqueProjectName(allProjects, normalizeProjectName(input.name), nextParentId, projectId)
          : project.name,
      parentId: nextParentId,
      isExpanded: typeof input.isExpanded === 'boolean' ? input.isExpanded : project.isExpanded,
      updatedAt: Date.now(),
      meta: this.normalizeProjectMetaAgainstAssets(
        normalizeProjectMeta({ ...project.meta, ...(input.meta || {}) }),
        assets
      ),
      data: this.normalizeFilesAgainstKnowledge(knowledge, {
        ...project.data,
        ...(input.data || {}),
        files: input.data?.files ?? project.data.files
      })
    }

    await this.writeProjects(
      actor.workspaceId,
      allProjects.map((entry) => (entry.id === projectId ? nextProject : entry))
    )
    this.events.emit(actor.workspaceId, 'project.updated', projectId, actor.userId, { name: nextProject.name })
    return { project: nextProject }
  }

  async move(actor: Actor, projectId: string, parentId: string | null): Promise<OpenPortProjectResponse> {
    return this.update(actor, projectId, { parentId })
  }

  async delete(actor: Actor, projectId: string, deleteContents: boolean): Promise<OpenPortDeleteProjectResponse> {
    const allProjects = await this.readAllProjects(actor)
    const target = await this.requireProject(actor, projectId, 'admin', allProjects)
    const deletedProjectIds = [target.id, ...this.getDescendantIds(allProjects, target.id)]
    const remainingProjects = allProjects.filter((project) => !deletedProjectIds.includes(project.id))

    const sessions = await this.stateStore.readChatSessions(actor.userId)
    const affectedSessions = sessions.filter((session) => session.settings.projectId && deletedProjectIds.includes(session.settings.projectId))
    const deletedChatIds = deleteContents ? affectedSessions.map((session) => session.id) : []

    const nextSessions = deleteContents
      ? sessions.filter((session) => !deletedChatIds.includes(session.id))
      : sessions.map((session) =>
          session.settings.projectId && deletedProjectIds.includes(session.settings.projectId)
            ? {
                ...session,
                settings: {
                  ...session.settings,
                  projectId: null
                },
                updatedAt: new Date().toISOString()
              }
            : session
        )

    await this.stateStore.writeChatSessions(actor.userId, nextSessions)
    await this.writeProjects(
      actor.workspaceId,
      remainingProjects.map((project) => ({
        ...project,
        chatIds: project.chatIds.filter((chatId) => !deletedChatIds.includes(chatId))
      }))
    )

    this.events.emit(actor.workspaceId, 'project.deleted', projectId, actor.userId, {
      deleteContents,
      deletedProjectIds: deletedProjectIds.length,
      deletedChatIds: deletedChatIds.length
    })

    return {
      ok: true,
      deletedProjectIds,
      deletedChatIds
    }
  }

  async export(actor: Actor, projectId: string): Promise<OpenPortProjectExportBundle> {
    const allProjects = await this.readAllProjects(actor)
    const project = await this.requireProject(actor, projectId, 'read', allProjects)
    const descendantIds = this.getDescendantIds(allProjects, project.id)
    const subtreeIds = new Set([project.id, ...descendantIds])
    const sessions = await this.stateStore.readChatSessions(actor.userId)

    return {
      exportedAt: new Date().toISOString(),
      project,
      descendants: allProjects.filter((entry) => descendantIds.includes(entry.id)),
      chats: sessions.filter((session) => session.settings.projectId && subtreeIds.has(session.settings.projectId))
    }
  }

  async import(actor: Actor, input: ProjectImportPayload): Promise<OpenPortProjectImportResponse> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)

    const bundle = input.bundle as Partial<OpenPortProjectExportBundle>
    if (!bundle?.project || typeof bundle.project !== 'object' || !('id' in bundle.project)) {
      throw new BadRequestException('Invalid project bundle')
    }

    const rootProject = bundle.project as OpenPortProject
    const descendantProjects = Array.isArray(bundle.descendants) ? (bundle.descendants as OpenPortProject[]) : []
    const bundledChats = Array.isArray(bundle.chats) ? (bundle.chats as OpenPortChatSession[]) : []

    const existingProjects = await this.readAllProjects(actor)
    const knowledge = await this.readKnowledge(actor)
    const sourceProjects = [rootProject, ...descendantProjects]
    const idMap = new Map<string, string>()

    sourceProjects.forEach((project) => {
      idMap.set(project.id, `project_${randomUUID()}`)
    })

    const importedProjects = sourceProjects.map((project) => {
      const isRoot = project.id === rootProject.id
      const mappedParentId = isRoot ? input.parentId ?? null : (project.parentId ? idMap.get(project.parentId) ?? null : null)
      const name = this.createUniqueProjectName(
        [
          ...existingProjects,
          ...sourceProjects
            .filter((entry) => entry.id !== project.id)
            .map((entry) => ({
              ...entry,
              id: idMap.get(entry.id) || entry.id,
              parentId: entry.parentId ? idMap.get(entry.parentId) || null : null,
              workspaceId: actor.workspaceId,
              ownerUserId: actor.userId
            }))
        ],
        project.name,
        mappedParentId
      )

      const files = normalizeProjectData(project.data).files.map((file) => {
        if (file.knowledgeItemId) return file
        const knowledgeItemId = `knowledge_${randomUUID()}`
        const knowledgeItem: OpenPortProjectKnowledgeItem = {
          id: knowledgeItemId,
          workspaceId: actor.workspaceId,
          assetId: file.assetId ?? null,
          collectionId: null,
          collectionName: 'General',
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          source: 'upload',
          contentUrl: null,
          contentText: '',
          previewText: '',
          retrievalState: 'binary',
          chunkCount: 0,
          accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_item', knowledgeItemId)
        }
        knowledge.push(knowledgeItem)
        return {
          ...file,
          knowledgeItemId: knowledgeItem.id
        }
      })

      const importedProjectId = idMap.get(project.id) || project.id

      return {
        ...project,
        id: importedProjectId,
        workspaceId: actor.workspaceId,
        ownerUserId: actor.userId,
        parentId: mappedParentId,
        name,
        chatIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: {
          ...normalizeProjectData(project.data),
          files
        },
        meta: normalizeProjectMeta(project.meta),
        accessGrants: this.normalizeImportedGrants(project.accessGrants, importedProjectId, actor)
      }
    })

    const sessions = await this.stateStore.readChatSessions(actor.userId)
    const importedSessions: OpenPortChatSession[] = bundledChats.map((session) => ({
      ...session,
      id: `chat_${randomUUID()}`,
      userId: actor.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        ...session.settings,
        projectId: session.settings.projectId ? idMap.get(session.settings.projectId) ?? null : null
      }
    }))

    await this.writeProjects(actor.workspaceId, [...existingProjects, ...importedProjects])
    await this.stateStore.writeKnowledgeItems(actor.workspaceId, knowledge)
    await this.stateStore.writeChatSessions(actor.userId, [...importedSessions, ...sessions])
    this.events.emit(actor.workspaceId, 'project.imported', importedProjects[0]?.id ?? null, actor.userId, {
      count: importedProjects.length
    })

    return {
      project: importedProjects.find((project) => project.parentId === (input.parentId ?? null)) || importedProjects[0],
      descendants: importedProjects.filter((project) => project.parentId !== (input.parentId ?? null))
    }
  }

  async listKnowledge(actor: Actor): Promise<OpenPortListResponse<OpenPortProjectKnowledgeItem>> {
    this.assertKnowledgeRead(actor)
    const groupIds = await this.resolveActorGroupIds(actor)
    return {
      items: (await this.readKnowledge(actor)).filter((item) =>
        this.hasWorkspaceResourcePermission(actor, groupIds, item.accessGrants, 'read')
      )
    }
  }

  async listKnowledgeCollections(actor: Actor): Promise<OpenPortKnowledgeCollectionsResponse> {
    this.assertKnowledgeRead(actor)
    const groupIds = await this.resolveActorGroupIds(actor)
    const items = (await this.readKnowledge(actor)).filter((item) =>
      this.hasWorkspaceResourcePermission(actor, groupIds, item.accessGrants, 'read')
    )
    const storedCollections = await this.readKnowledgeCollections(actor.workspaceId)
    const visibleCollections: Array<[string, OpenPortKnowledgeCollection]> = storedCollections
      .filter((collection) => this.hasWorkspaceResourcePermission(actor, groupIds, collection.accessGrants, 'read'))
      .map((collection) => [
        collection.id,
        {
          ...collection,
          itemCount: 0
        }
      ])
    const byCollection = new Map<string, OpenPortKnowledgeCollection>(visibleCollections)

    items.forEach((item) => {
      const collection = resolveKnowledgeCollection({
        collectionId: item.collectionId,
        collectionName: item.collectionName
      })
      const key = collection.collectionId || 'collection_general'
      const existing = byCollection.get(key)
      if (existing) {
        existing.itemCount += 1
        existing.updatedAt = existing.updatedAt > item.uploadedAt ? existing.updatedAt : item.uploadedAt
      } else {
        byCollection.set(key, {
          id: collection.collectionId || 'collection_general',
          workspaceId: actor.workspaceId,
          name: collection.collectionName,
          description: collection.collectionName === 'General' ? 'Default knowledge collection.' : '',
          itemCount: 1,
          updatedAt: item.uploadedAt,
          accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_collection', collection.collectionId || 'collection_general')
        })
      }
    })

    return {
      items: Array.from(byCollection.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
  }

  async createKnowledgeCollection(
    actor: Actor,
    input: CreateKnowledgeCollectionDto
  ): Promise<OpenPortKnowledgeCollectionResponse> {
    this.assertKnowledgeManage(actor)
    const name = normalizeProjectName(input.name || '')
    if (!name) {
      throw new BadRequestException('Collection name cannot be empty')
    }

    const collections = await this.readKnowledgeCollections(actor.workspaceId)
    const id = input.id?.trim() || buildKnowledgeCollectionId(name)
    if (collections.some((collection) => collection.id === id || collection.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException('Collection already exists')
    }

    const item: OpenPortKnowledgeCollection = {
      id,
      workspaceId: actor.workspaceId,
      name,
      description: input.description?.trim() || '',
      itemCount: 0,
      updatedAt: new Date().toISOString(),
      accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_collection', id)
    }

    await this.writeKnowledgeCollections(actor.workspaceId, [item, ...collections])
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      collectionId: item.id,
      action: 'collection_created'
    })
    return { item }
  }

  async updateKnowledgeCollection(
    actor: Actor,
    collectionId: string,
    input: UpdateKnowledgeCollectionDto
  ): Promise<OpenPortKnowledgeCollectionResponse> {
    this.assertKnowledgeManage(actor)
    const collections = await this.readKnowledgeCollections(actor.workspaceId)
    const current = collections.find((item) => item.id === collectionId)
    if (!current) {
      throw new NotFoundException('Knowledge collection not found')
    }
    await this.ensureKnowledgeCollectionPermission(actor, current, 'write')

    const nextName = input.name === undefined ? current.name : normalizeProjectName(input.name)
    if (!nextName) {
      throw new BadRequestException('Collection name cannot be empty')
    }
    if (
      collections.some(
        (item) => item.id !== collectionId && item.name.toLowerCase() === nextName.toLowerCase()
      )
    ) {
      throw new BadRequestException('Collection already exists')
    }

    const updated: OpenPortKnowledgeCollection = {
      ...current,
      name: nextName,
      description: input.description === undefined ? current.description : input.description.trim(),
      updatedAt: new Date().toISOString()
    }

    if (updated.name !== current.name) {
      const items = await this.readKnowledge(actor)
      await this.stateStore.writeKnowledgeItems(
        actor.workspaceId,
        items.map((item) =>
          item.collectionId === collectionId ? { ...item, collectionName: updated.name } : item
        )
      )
    }

    await this.writeKnowledgeCollections(
      actor.workspaceId,
      collections.map((item) => (item.id === collectionId ? updated : item))
    )
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      collectionId,
      action: 'collection_updated'
    })
    return { item: updated }
  }

  async deleteKnowledgeCollection(
    actor: Actor,
    collectionId: string,
    input: DeleteKnowledgeCollectionDto
  ): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    if (collectionId === 'collection_general') {
      throw new BadRequestException('General collection cannot be deleted')
    }

    const [collections, items] = await Promise.all([
      this.readKnowledgeCollections(actor.workspaceId),
      this.readKnowledge(actor)
    ])
    const current = collections.find((item) => item.id === collectionId)
    if (!current) {
      throw new NotFoundException('Knowledge collection not found')
    }

    const target = await this.resolveCollectionTarget(actor, {
      collectionId: input.moveToCollectionId ?? null,
      collectionName: input.moveToCollectionName ?? null
    })
    const reassignedItems = items.map((item) =>
      item.collectionId === collectionId
        ? {
            ...item,
            collectionId: target.collectionId,
            collectionName: target.collectionName,
            uploadedAt: new Date().toISOString()
          }
        : item
    )

    await this.stateStore.writeKnowledgeItems(actor.workspaceId, reassignedItems)
    await this.writeKnowledgeCollections(
      actor.workspaceId,
      collections.filter((item) => item.id !== collectionId)
    )
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      collectionId,
      action: 'collection_deleted'
    })
    return { ok: true }
  }

  async updateKnowledgeItemCollection(
    actor: Actor,
    itemId: string,
    input: UpdateKnowledgeItemCollectionDto
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const target = await this.resolveCollectionTarget(actor, {
      collectionId: input.collectionId ?? null,
      collectionName: input.collectionName ?? null
    })
    const collectionRecord = (await this.readKnowledgeCollections(actor.workspaceId)).find((entry) => entry.id === target.collectionId)
    if (collectionRecord) {
      await this.ensureKnowledgeCollectionPermission(actor, collectionRecord, 'write')
    }

    const updated: OpenPortProjectKnowledgeItem = {
      ...item,
      collectionId: target.collectionId,
      collectionName: target.collectionName,
      uploadedAt: new Date().toISOString()
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, updated)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      collectionId: target.collectionId,
      action: 'collection_moved'
    })
    return { item: persisted }
  }

  async getKnowledge(actor: Actor, itemId: string): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeRead(actor)
    const [knowledgeItems, chunks] = await Promise.all([
      this.readKnowledge(actor),
      this.stateStore.readKnowledgeChunks(actor.workspaceId)
    ])
    const item = knowledgeItems.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'read')

    const chunkPreview = chunks
      .filter((chunk) => chunk.itemId === item.id)
      .slice(0, 12)
      .map((chunk, index) => ({
        id: chunk.id,
        index: index + 1,
        text: chunk.text.slice(0, 240)
      }))

    return {
      item: {
        ...item,
        chunkPreview,
        sources: this.getKnowledgeSources(item)
      }
    }
  }

  async deleteKnowledge(actor: Actor, itemId: string): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    const [knowledgeItems, projects, chunks, denseChunks, sourceGrants, chunkGrants] = await Promise.all([
      this.readKnowledge(actor),
      this.readAllProjects(actor),
      this.stateStore.readKnowledgeChunks(actor.workspaceId),
      this.stateStore.readDenseKnowledgeChunks(actor.workspaceId),
      this.stateStore.readKnowledgeSourceGrants(actor.workspaceId),
      this.stateStore.readKnowledgeChunkGrants(actor.workspaceId)
    ])
    const item = knowledgeItems.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')
    const removedSourceIds = new Set(this.getKnowledgeSources(item).map((source) => source.id))
    const removedChunkIds = new Set(chunks.filter((chunk) => chunk.itemId === itemId).map((chunk) => chunk.id))

    await this.stateStore.writeKnowledgeItems(
      actor.workspaceId,
      knowledgeItems.filter((entry) => entry.id !== itemId)
    )
    await this.stateStore.writeKnowledgeChunks(
      actor.workspaceId,
      chunks.filter((chunk) => chunk.itemId !== itemId)
    )
    await this.stateStore.writeDenseKnowledgeChunks(
      actor.workspaceId,
      denseChunks.filter((chunk) => chunk.itemId !== itemId)
    )
    await this.stateStore.writeKnowledgeSourceGrants(
      actor.workspaceId,
      sourceGrants.filter((grant) => !removedSourceIds.has(grant.resourceId))
    )
    await this.stateStore.writeKnowledgeChunkGrants(
      actor.workspaceId,
      chunkGrants.filter((grant) => !removedChunkIds.has(grant.resourceId))
    )
    await this.writeProjects(
      actor.workspaceId,
      projects.map((project) => ({
        ...project,
        data: {
          ...project.data,
          files: project.data.files.filter((file) => file.knowledgeItemId !== itemId)
        },
        updatedAt: project.data.files.some((file) => file.knowledgeItemId === itemId) ? Date.now() : project.updatedAt
      }))
    )

    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, { itemId, action: 'deleted' })
    return { ok: true }
  }

  async uploadAsset(actor: Actor, input: ProjectAssetUploadInput): Promise<OpenPortProjectAssetResponse> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const { asset } = await this.assets.upload(actor, {
      kind: input.kind,
      name: normalizeProjectName(input.name),
      type: input.type?.trim() || 'application/octet-stream',
      size: typeof input.size === 'number' ? input.size : 0,
      contentBase64: input.contentBase64
    })

    this.events.emit(actor.workspaceId, 'project.updated', null, actor.userId, { assetId: asset.id, kind: asset.kind })
    return { asset }
  }

  streamEvents(actor: Actor) {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    return this.events.stream(actor.workspaceId)
  }

  readAssetContent(assetId: string) {
    return this.assets.readAssetContent(assetId)
  }

  async uploadKnowledge(actor: Actor, input: ProjectKnowledgeUploadInput): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const name = normalizeProjectName(input.name)
    if (!name) {
      throw new BadRequestException('Knowledge item name cannot be empty')
    }

    const { asset, buffer } = await this.assets.upload(actor, {
      kind: 'knowledge',
      name,
      type: input.type?.trim() || 'application/octet-stream',
      size: typeof input.size === 'number' ? input.size : 0,
      contentBase64: input.contentBase64
    })

    const contentText = decodeTextContent(name, asset.type, buffer.toString('base64')) ?? ''
    const { collectionId, collectionName } = await this.resolveCollectionTarget(actor, input)
    const itemId = `knowledge_${randomUUID()}`
    const item: OpenPortProjectKnowledgeItem = {
      id: itemId,
      workspaceId: actor.workspaceId,
      assetId: asset.id,
      collectionId,
      collectionName,
      name,
      type: asset.type,
      size: asset.size,
      uploadedAt: new Date().toISOString(),
      source: 'upload',
      contentUrl: asset.contentUrl,
      contentText,
      previewText: buildKnowledgePreview(contentText),
      retrievalState: contentText.trim() ? 'indexed' : 'binary',
      chunkCount: 0,
      accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_item', itemId)
    }
    const persisted = await this.persistKnowledgeItem(actor.workspaceId, item)

    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, { itemId: persisted.id })
    return { item: persisted }
  }

  async createKnowledgeText(actor: Actor, input: ProjectKnowledgeTextInput): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const name = normalizeProjectName(input.name)
    if (!name) {
      throw new BadRequestException('Knowledge item name cannot be empty')
    }

    const contentText = input.contentText.trim()
    if (!contentText) {
      throw new BadRequestException('Knowledge text cannot be empty')
    }

    const { collectionId, collectionName } = await this.resolveCollectionTarget(actor, input)
    const itemId = `knowledge_${randomUUID()}`
    const item: OpenPortProjectKnowledgeItem = {
      id: itemId,
      workspaceId: actor.workspaceId,
      assetId: null,
      collectionId,
      collectionName,
      name,
      type: 'text/plain',
      size: contentText.length,
      uploadedAt: new Date().toISOString(),
      source: 'text',
      contentUrl: null,
      contentText,
      previewText: buildKnowledgePreview(contentText),
      retrievalState: 'indexed',
      chunkCount: 0,
      accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_item', itemId)
    }
    const persisted = await this.persistKnowledgeItem(actor.workspaceId, item)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, { itemId: persisted.id, action: 'created_text' })
    return { item: persisted }
  }

  async createKnowledgeWeb(actor: Actor, input: CreateProjectKnowledgeWebDto | ProjectKnowledgeWebInput): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const snapshot = await fetchWebpageSnapshot(input.url, { maxChars: input.maxChars })
    const name = normalizeProjectName(input.name || snapshot.defaultName)
    const { collectionId, collectionName } = await this.resolveCollectionTarget(actor, input)

    const itemId = `knowledge_${randomUUID()}`
    const item: OpenPortProjectKnowledgeItem = {
      id: itemId,
      workspaceId: actor.workspaceId,
      assetId: null,
      collectionId,
      collectionName,
      name,
      type: snapshot.contentType,
      size: snapshot.boundedContent.length,
      uploadedAt: new Date().toISOString(),
      source: 'text',
      contentUrl: snapshot.url.toString(),
      contentText: snapshot.boundedContent,
      previewText: buildKnowledgePreview(snapshot.boundedContent),
      retrievalState: 'indexed',
      chunkCount: 0,
      accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_item', itemId)
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, item)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId: persisted.id,
      action: 'created_web'
    })
    return { item: persisted }
  }

  async appendKnowledgeContent(
    actor: Actor,
    itemId: string,
    contentText: string
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const nextContentPart = contentText.trim()
    if (!nextContentPart) {
      throw new BadRequestException('Knowledge text cannot be empty')
    }

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const mergedContent = [item.contentText, nextContentPart].filter(Boolean).join('\n\n')
    const updated: OpenPortProjectKnowledgeItem = {
      ...item,
      source: 'append',
      contentText: mergedContent,
      size: mergedContent.length,
      uploadedAt: new Date().toISOString(),
      previewText: buildKnowledgePreview(mergedContent),
      retrievalState: 'indexed'
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, updated)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, { itemId, action: 'append' })
    return { item: persisted }
  }

  async updateKnowledgeContent(
    actor: Actor,
    itemId: string,
    contentText: string
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)
    const nextContent = contentText.trim()
    if (!nextContent) {
      throw new BadRequestException('Knowledge text cannot be empty')
    }

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const updated: OpenPortProjectKnowledgeItem = {
      ...item,
      contentText: nextContent,
      size: nextContent.length,
      uploadedAt: new Date().toISOString(),
      previewText: buildKnowledgePreview(nextContent)
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, updated)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, { itemId, action: 'content_replaced' })
    return { item: persisted }
  }

  async reindexKnowledgeItem(actor: Actor, itemId: string): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, {
      ...item,
      uploadedAt: new Date().toISOString(),
      previewText: buildKnowledgePreview(item.contentText || item.previewText || '')
    })

    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      action: 'reindexed'
    })

    return { item: persisted }
  }

  async resetKnowledgeItem(actor: Actor, itemId: string): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const [existingChunks, existingDenseChunks] = await Promise.all([
      this.stateStore.readKnowledgeChunks(actor.workspaceId),
      this.stateStore.readDenseKnowledgeChunks(actor.workspaceId)
    ])

    const persisted: OpenPortProjectKnowledgeItem = {
      ...item,
      uploadedAt: new Date().toISOString(),
      retrievalState: 'binary',
      chunkCount: 0,
      previewText: buildKnowledgePreview(item.contentText || item.previewText || '')
    }

    await this.stateStore.writeKnowledgeItems(actor.workspaceId, [
      persisted,
      ...items.filter((entry) => entry.id !== itemId)
    ])
    await this.stateStore.writeKnowledgeChunks(
      actor.workspaceId,
      existingChunks.filter((chunk) => chunk.itemId !== itemId)
    )
    await this.stateStore.writeDenseKnowledgeChunks(
      actor.workspaceId,
      existingDenseChunks.filter((chunk) => chunk.itemId !== itemId)
    )

    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      action: 'reset'
    })

    return { item: persisted }
  }

  async rebuildKnowledgeItem(
    actor: Actor,
    itemId: string,
    input: RebuildProjectKnowledgeDto
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')

    const chunking = this.normalizeChunkingOptions(input)
    const persisted = await this.persistKnowledgeItem(
      actor.workspaceId,
      {
        ...item,
        uploadedAt: new Date().toISOString(),
        previewText: buildKnowledgePreview(item.contentText || item.previewText || '')
      },
      chunking
    )

    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      action: 'rebuild',
      chunking
    })

    return { item: persisted }
  }

  async rebuildKnowledgeBatch(
    actor: Actor,
    input: RebuildProjectKnowledgeBatchDto
  ): Promise<{ itemIds: string[]; affectedCount: number; items: OpenPortProjectKnowledgeItem[] }> {
    this.assertKnowledgeManage(actor)
    const items = await this.readKnowledge(actor)
    const selectedIds = new Set((input.itemIds || []).map((entry) => entry.trim()).filter(Boolean))
    const targets = selectedIds.size > 0 ? items.filter((item) => selectedIds.has(item.id)) : items
    const chunking = this.normalizeChunkingOptions(input)
    const rebuilt: OpenPortProjectKnowledgeItem[] = []
    for (const item of targets) {
      const response = await this.rebuildKnowledgeItem(actor, item.id, chunking)
      rebuilt.push(response.item)
    }
    return {
      itemIds: rebuilt.map((item) => item.id),
      affectedCount: rebuilt.length,
      items: rebuilt
    }
  }

  async maintainKnowledgeBatch(
    actor: Actor,
    input: MaintainProjectKnowledgeBatchDto
  ): Promise<OpenPortProjectKnowledgeBatchMaintenanceResponse> {
    this.assertKnowledgeManage(actor)

    const action = input.action as OpenPortProjectKnowledgeBatchMaintenanceAction
    const allItems = await this.readKnowledge(actor)
    const selectedIds = new Set((input.itemIds || []).map((entry) => entry.trim()).filter(Boolean))
    const targets = selectedIds.size > 0 ? allItems.filter((item) => selectedIds.has(item.id)) : allItems

    if (action === 'move_collection' && !((input.collectionId || '').trim() || (input.collectionName || '').trim())) {
      throw new BadRequestException('collectionId or collectionName is required for move_collection')
    }

    const updatedItems: OpenPortProjectKnowledgeItem[] = []
    const affectedIds: string[] = []
    for (const item of targets) {
      if (action === 'delete') {
        await this.deleteKnowledge(actor, item.id)
        affectedIds.push(item.id)
        continue
      }

      if (action === 'reindex') {
        const response = await this.reindexKnowledgeItem(actor, item.id)
        updatedItems.push(response.item)
        affectedIds.push(response.item.id)
        continue
      }

      if (action === 'reset') {
        const response = await this.resetKnowledgeItem(actor, item.id)
        updatedItems.push(response.item)
        affectedIds.push(response.item.id)
        continue
      }

      if (action === 'rebuild') {
        const response = await this.rebuildKnowledgeItem(actor, item.id, this.normalizeChunkingOptions(input))
        updatedItems.push(response.item)
        affectedIds.push(response.item.id)
        continue
      }

      const response = await this.updateKnowledgeItemCollection(actor, item.id, {
        collectionId: (input.collectionId || '').trim() || undefined,
        collectionName: (input.collectionName || '').trim() || undefined
      })
      updatedItems.push(response.item)
      affectedIds.push(response.item.id)
    }

    return {
      action,
      itemIds: affectedIds,
      affectedCount: affectedIds.length,
      items: updatedItems
    }
  }

  async removeKnowledgeSource(
    actor: Actor,
    itemId: string,
    sourceId: string
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')
    const sourceEntry = await this.readKnowledgeSourceGrantEntry(actor, sourceId)
    await this.ensureKnowledgeResourcePermission(actor, sourceEntry.grants, 'write', 'knowledge source')

    const sources = this.getKnowledgeSources(item)
    const target = sources.find((entry) => entry.id === sourceId)
    if (!target) {
      throw new NotFoundException('Knowledge source not found')
    }

    const remainingSources = sources.filter((entry) => entry.id !== sourceId)
    const nextPrimarySource = remainingSources[0] ?? null
    const updated: OpenPortProjectKnowledgeItem = {
      ...item,
      assetId: item.assetId === sourceId ? null : item.assetId,
      contentUrl: item.assetId === sourceId ? null : item.contentUrl,
      source: nextPrimarySource?.source ?? 'text',
      uploadedAt: new Date().toISOString(),
      sources: remainingSources
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, updated)
    await this.writeKnowledgeSourceGrantEntry(
      actor,
      sourceId,
      sourceEntry.allGrants,
      []
    )
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      sourceId,
      action: 'source_removed'
    })

    return { item: persisted }
  }

  async replaceKnowledgeSource(
    actor: Actor,
    itemId: string,
    sourceId: string,
    contentText: string,
    label?: string
  ): Promise<OpenPortProjectKnowledgeResponse> {
    this.assertKnowledgeManage(actor)

    const nextContent = contentText.trim()
    if (!nextContent) {
      throw new BadRequestException('Knowledge source content cannot be empty')
    }

    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'write')
    const sourceEntry = await this.readKnowledgeSourceGrantEntry(actor, sourceId)
    await this.ensureKnowledgeResourcePermission(actor, sourceEntry.grants, 'write', 'knowledge source')

    const sources = this.getKnowledgeSources(item)
    const target = sources.find((entry) => entry.id === sourceId)
    if (!target) {
      throw new NotFoundException('Knowledge source not found')
    }

    const normalizedLabel = typeof label === 'string' && label.trim().length > 0 ? label.trim() : target.label
    const updatedSources: OpenPortProjectKnowledgeSource[] = sources.map((entry) =>
      entry.id === sourceId
        ? {
            ...entry,
            label: normalizedLabel,
            kind: 'text' as const,
            source: 'text' as const,
            size: nextContent.length
          }
        : entry
    )

    const updated: OpenPortProjectKnowledgeItem = {
      ...item,
      assetId: item.assetId === sourceId ? null : item.assetId,
      contentUrl: item.assetId === sourceId ? null : item.contentUrl,
      contentText: nextContent,
      size: nextContent.length,
      source: 'text',
      uploadedAt: new Date().toISOString(),
      previewText: buildKnowledgePreview(nextContent),
      retrievalState: 'indexed',
      sources: updatedSources
    }

    const persisted = await this.persistKnowledgeItem(actor.workspaceId, updated)
    this.events.emit(actor.workspaceId, 'knowledge.updated', null, actor.userId, {
      itemId,
      sourceId,
      action: 'source_replaced'
    })

    return { item: persisted }
  }

  async maintainKnowledgeSourceBatch(
    actor: Actor,
    sourceId: string,
    input: MaintainProjectKnowledgeSourceDto
  ): Promise<{
    sourceId: string
    action: 'reindex' | 'reset' | 'remove' | 'replace' | 'rebuild'
    affectedCount: number
    items: OpenPortProjectKnowledgeItem[]
  }> {
    this.assertKnowledgeManage(actor)

    const action = input.action
    if (action === 'replace' && !(input.contentText || '').trim()) {
      throw new BadRequestException('Source replacement content cannot be empty')
    }

    const items = await this.readKnowledge(actor)
    const linkedItemIds = items
      .filter((item) => this.getKnowledgeSources(item).some((source) => source.id === sourceId))
      .map((item) => item.id)

    const updatedItems: OpenPortProjectKnowledgeItem[] = []
    for (const itemId of linkedItemIds) {
      if (action === 'reindex') {
        const response = await this.reindexKnowledgeItem(actor, itemId)
        updatedItems.push(response.item)
        continue
      }

      if (action === 'reset') {
        const response = await this.resetKnowledgeItem(actor, itemId)
        updatedItems.push(response.item)
        continue
      }

      if (action === 'remove') {
        const response = await this.removeKnowledgeSource(actor, itemId, sourceId)
        updatedItems.push(response.item)
        continue
      }

      if (action === 'rebuild') {
        const response = await this.rebuildKnowledgeItem(actor, itemId, this.normalizeChunkingOptions(input))
        updatedItems.push(response.item)
        continue
      }

      const response = await this.replaceKnowledgeSource(
        actor,
        itemId,
        sourceId,
        (input.contentText || '').trim(),
        input.label
      )
      updatedItems.push(response.item)
    }

    return {
      sourceId,
      action,
      affectedCount: updatedItems.length,
      items: updatedItems
    }
  }

  async searchKnowledgeChunks(
    actor: Actor,
    itemId: string,
    query: string,
    limit = 12
  ): Promise<{
    items: Array<{
      itemId: string
      itemName: string
      chunkId: string
      chunkIndex: number
      snippet: string
      score: number
    }>
    summary: {
      totalMatches: number
      maxScore: number
      averageScore: number
    }
  }> {
    this.assertKnowledgeRead(actor)
    const trimmedQuery = query.trim()

    const [items, chunks] = await Promise.all([
      this.readKnowledge(actor),
      this.stateStore.readKnowledgeChunks(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }

    const itemChunks = chunks.filter((chunk) => chunk.itemId === itemId)
    if (itemChunks.length === 0) {
      return {
        items: [],
        summary: {
          totalMatches: 0,
          maxScore: 0,
          averageScore: 0
        }
      }
    }

    const chunkIndexById = new Map(itemChunks.map((chunk, index) => [chunk.id, index + 1]))
    if (!trimmedQuery) {
      return {
        items: itemChunks.slice(0, limit).map((chunk) => ({
          itemId,
          itemName: item.name,
          chunkId: chunk.id,
          chunkIndex: chunkIndexById.get(chunk.id) || 0,
          snippet: chunk.text.slice(0, 280),
          score: 0
        })),
        summary: {
          totalMatches: itemChunks.length,
          maxScore: 0,
          averageScore: 0
        }
      }
    }

    const sparseMatches = rankKnowledgeChunks(itemChunks, trimmedQuery).slice(0, limit)
    const scores = sparseMatches.map((entry) => entry.score)
    const averageScore = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0
    return {
      items: sparseMatches.map((match) => ({
        itemId,
        itemName: item.name,
        chunkId: match.id,
        chunkIndex: chunkIndexById.get(match.id) || 0,
        snippet: match.text.slice(0, 280),
        score: Number(match.score.toFixed(4))
      })),
      summary: {
        totalMatches: sparseMatches.length,
        maxScore: Number(maxScore.toFixed(4)),
        averageScore: Number(averageScore.toFixed(4))
      }
    }
  }

  async getKnowledgeChunkStats(actor: Actor): Promise<{
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
  }> {
    this.assertKnowledgeRead(actor)
    const groupIds = await this.resolveActorGroupIds(actor)
    const [items, chunks] = await Promise.all([
      this.readKnowledge(actor),
      this.stateStore.readKnowledgeChunks(actor.workspaceId)
    ])
    const visibleItems = items.filter((item) =>
      this.hasWorkspaceResourcePermission(actor, groupIds, item.accessGrants, 'read')
    )
    const visibleItemIds = new Set(visibleItems.map((item) => item.id))
    const visibleChunks = chunks.filter((chunk) => visibleItemIds.has(chunk.itemId))
    const lengths = visibleChunks.map((chunk) => chunk.text.length).sort((a, b) => a - b)
    const averageChunkLength = lengths.length > 0 ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0
    const medianChunkLength =
      lengths.length === 0
        ? 0
        : lengths.length % 2 === 0
          ? (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2
          : lengths[Math.floor(lengths.length / 2)]
    const thinChunkCount = lengths.filter((value) => value < 180).length
    const oversizedChunkCount = lengths.filter((value) => value > 900).length
    const balancedChunkCount = Math.max(0, lengths.length - thinChunkCount - oversizedChunkCount)

    return {
      summary: {
        totalItems: visibleItems.length,
        totalChunks: visibleChunks.length,
        indexedItems: visibleItems.filter((item) => item.retrievalState === 'indexed').length,
        averageChunkLength: Number(averageChunkLength.toFixed(1)),
        medianChunkLength: Number(medianChunkLength.toFixed(1)),
        thinChunkCount,
        balancedChunkCount,
        oversizedChunkCount
      },
      topItems: [...visibleItems]
        .sort((left, right) => right.chunkCount - left.chunkCount)
        .slice(0, 8)
        .map((item) => ({
          itemId: item.id,
          itemName: item.name,
          chunkCount: item.chunkCount,
          retrievalState: item.retrievalState
        }))
    }
  }

  async searchKnowledge(
    actor: Actor,
    projectId: string,
    query: string,
    limit = 5
  ): Promise<OpenPortProjectKnowledgeSearchResponse> {
    const project = await this.requireProject(actor, projectId, 'read')
    const selectedKnowledgeIds = new Set(
      project.data.files.filter((file) => file.selected && file.knowledgeItemId).map((file) => file.knowledgeItemId as string)
    )
    if (selectedKnowledgeIds.size === 0 || !query.trim()) {
      return { items: [] }
    }

    const [knowledgeItems, chunks, denseChunks] = await Promise.all([
      this.readKnowledge(actor),
      this.stateStore.readKnowledgeChunks(actor.workspaceId),
      this.stateStore.readDenseKnowledgeChunks(actor.workspaceId)
    ])
    const groupIds = await this.resolveActorGroupIds(actor)
    const readableItems = knowledgeItems.filter((item) =>
      this.hasWorkspaceResourcePermission(actor, groupIds, item.accessGrants, 'read')
    )
    const readableItemIds = new Set(readableItems.map((item) => item.id))
    const selectedAndReadableIds = new Set(
      [...selectedKnowledgeIds].filter((itemId) => readableItemIds.has(itemId))
    )
    const knowledgeById = new Map(readableItems.map((item) => [item.id, item]))
    const sparseMatches = rankKnowledgeChunks(
      chunks.filter((chunk) => selectedAndReadableIds.has(chunk.itemId)),
      query.trim()
    )
    const matches = this.retrieval.rankHybrid(
      sparseMatches,
      denseChunks.filter((chunk) => selectedAndReadableIds.has(chunk.itemId)),
      query.trim()
    )

    return {
      items: matches.slice(0, limit).map((match) => ({
        itemId: match.itemId,
        itemName: knowledgeById.get(match.itemId)?.name || 'Knowledge item',
        chunkId: match.chunkId,
        snippet: match.text.slice(0, 240),
        score: Number(match.score.toFixed(4))
      }))
    }
  }

  async listKnowledgeItemAccessGrants(
    actor: Actor,
    itemId: string
  ): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertKnowledgeManage(actor)
    const item = (await this.readKnowledge(actor)).find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'admin')
    return { items: item.accessGrants }
  }

  async shareKnowledgeItem(
    actor: Actor,
    itemId: string,
    input: ShareKnowledgeResourceInput
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertKnowledgeManage(actor)
    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'admin')

    const principalId = await this.resolveWorkspaceResourcePrincipalId(actor, input)
    const existing = item.accessGrants.find(
      (grant) => grant.principalType === input.principalType && grant.principalId === principalId
    )
    if (existing) {
      existing.permission = input.permission
      item.accessGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_item', item.id, item.accessGrants)
      await this.stateStore.writeKnowledgeItems(actor.workspaceId, items)
      this.events.emit(actor.workspaceId, 'permissions.updated', item.id, actor.userId, {
        grantId: existing.id,
        resourceType: 'knowledge_item'
      })
      return { grant: existing }
    }

    const grant = this.buildKnowledgeGrant(
      actor.workspaceId,
      'knowledge_item',
      item.id,
      input.principalType,
      principalId,
      input.permission
    )
    item.accessGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_item', item.id, [...item.accessGrants, grant])
    await this.stateStore.writeKnowledgeItems(actor.workspaceId, items)
    this.events.emit(actor.workspaceId, 'permissions.updated', item.id, actor.userId, {
      grantId: grant.id,
      resourceType: 'knowledge_item'
    })
    return { grant }
  }

  async revokeKnowledgeItemShare(actor: Actor, itemId: string, grantId: string): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    const items = await this.readKnowledge(actor)
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      throw new NotFoundException('Knowledge item not found')
    }
    await this.ensureKnowledgeItemPermission(actor, item, 'admin')
    item.accessGrants = this.removeKnowledgeGrant(actor, 'knowledge_item', item.id, item.accessGrants, grantId)
    await this.stateStore.writeKnowledgeItems(actor.workspaceId, items)
    this.events.emit(actor.workspaceId, 'permissions.updated', item.id, actor.userId, {
      grantId,
      removed: true,
      resourceType: 'knowledge_item'
    })
    return { ok: true }
  }

  async listKnowledgeSourceAccessGrants(
    actor: Actor,
    sourceId: string
  ): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertKnowledgeManage(actor)
    const sourceEntry = await this.readKnowledgeSourceGrantEntry(actor, sourceId)
    await this.ensureKnowledgeResourcePermission(actor, sourceEntry.grants, 'admin', 'knowledge source')
    return { items: sourceEntry.grants }
  }

  async shareKnowledgeSource(
    actor: Actor,
    sourceId: string,
    input: ShareKnowledgeResourceInput
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertKnowledgeManage(actor)
    const sourceEntry = await this.readKnowledgeSourceGrantEntry(actor, sourceId)
    await this.ensureKnowledgeResourcePermission(actor, sourceEntry.grants, 'admin', 'knowledge source')

    const principalId = await this.resolveWorkspaceResourcePrincipalId(actor, input)
    const existing = sourceEntry.grants.find(
      (grant) => grant.principalType === input.principalType && grant.principalId === principalId
    )
    if (existing) {
      existing.permission = input.permission
      const nextGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_source', sourceId, sourceEntry.grants)
      await this.writeKnowledgeSourceGrantEntry(actor, sourceId, sourceEntry.allGrants, nextGrants)
      this.events.emit(actor.workspaceId, 'permissions.updated', sourceId, actor.userId, {
        grantId: existing.id,
        resourceType: 'knowledge_source'
      })
      return { grant: existing }
    }

    const grant = this.buildKnowledgeGrant(
      actor.workspaceId,
      'knowledge_source',
      sourceId,
      input.principalType,
      principalId,
      input.permission
    )
    const nextGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_source', sourceId, [...sourceEntry.grants, grant])
    await this.writeKnowledgeSourceGrantEntry(actor, sourceId, sourceEntry.allGrants, nextGrants)
    this.events.emit(actor.workspaceId, 'permissions.updated', sourceId, actor.userId, {
      grantId: grant.id,
      resourceType: 'knowledge_source'
    })
    return { grant }
  }

  async revokeKnowledgeSourceShare(
    actor: Actor,
    sourceId: string,
    grantId: string
  ): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    const sourceEntry = await this.readKnowledgeSourceGrantEntry(actor, sourceId)
    await this.ensureKnowledgeResourcePermission(actor, sourceEntry.grants, 'admin', 'knowledge source')
    const nextGrants = this.removeKnowledgeGrant(actor, 'knowledge_source', sourceId, sourceEntry.grants, grantId)
    await this.writeKnowledgeSourceGrantEntry(actor, sourceId, sourceEntry.allGrants, nextGrants)
    this.events.emit(actor.workspaceId, 'permissions.updated', sourceId, actor.userId, {
      grantId,
      removed: true,
      resourceType: 'knowledge_source'
    })
    return { ok: true }
  }

  async listKnowledgeChunkAccessGrants(
    actor: Actor,
    chunkId: string
  ): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertKnowledgeManage(actor)
    const chunkEntry = await this.readKnowledgeChunkGrantEntry(actor, chunkId)
    await this.ensureKnowledgeResourcePermission(actor, chunkEntry.grants, 'admin', 'knowledge chunk')
    return { items: chunkEntry.grants }
  }

  async shareKnowledgeChunk(
    actor: Actor,
    chunkId: string,
    input: ShareKnowledgeResourceInput
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertKnowledgeManage(actor)
    const chunkEntry = await this.readKnowledgeChunkGrantEntry(actor, chunkId)
    await this.ensureKnowledgeResourcePermission(actor, chunkEntry.grants, 'admin', 'knowledge chunk')

    const principalId = await this.resolveWorkspaceResourcePrincipalId(actor, input)
    const existing = chunkEntry.grants.find(
      (grant) => grant.principalType === input.principalType && grant.principalId === principalId
    )
    if (existing) {
      existing.permission = input.permission
      const nextGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_chunk', chunkId, chunkEntry.grants)
      await this.writeKnowledgeChunkGrantEntry(actor, chunkId, chunkEntry.allGrants, nextGrants)
      this.events.emit(actor.workspaceId, 'permissions.updated', chunkId, actor.userId, {
        grantId: existing.id,
        resourceType: 'knowledge_chunk'
      })
      return { grant: existing }
    }

    const grant = this.buildKnowledgeGrant(
      actor.workspaceId,
      'knowledge_chunk',
      chunkId,
      input.principalType,
      principalId,
      input.permission
    )
    const nextGrants = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_chunk', chunkId, [...chunkEntry.grants, grant])
    await this.writeKnowledgeChunkGrantEntry(actor, chunkId, chunkEntry.allGrants, nextGrants)
    this.events.emit(actor.workspaceId, 'permissions.updated', chunkId, actor.userId, {
      grantId: grant.id,
      resourceType: 'knowledge_chunk'
    })
    return { grant }
  }

  async revokeKnowledgeChunkShare(
    actor: Actor,
    chunkId: string,
    grantId: string
  ): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    const chunkEntry = await this.readKnowledgeChunkGrantEntry(actor, chunkId)
    await this.ensureKnowledgeResourcePermission(actor, chunkEntry.grants, 'admin', 'knowledge chunk')
    const nextGrants = this.removeKnowledgeGrant(actor, 'knowledge_chunk', chunkId, chunkEntry.grants, grantId)
    await this.writeKnowledgeChunkGrantEntry(actor, chunkId, chunkEntry.allGrants, nextGrants)
    this.events.emit(actor.workspaceId, 'permissions.updated', chunkId, actor.userId, {
      grantId,
      removed: true,
      resourceType: 'knowledge_chunk'
    })
    return { ok: true }
  }

  async listKnowledgeCollectionAccessGrants(
    actor: Actor,
    collectionId: string
  ): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertKnowledgeManage(actor)
    const collection = (await this.readKnowledgeCollections(actor.workspaceId)).find((entry) => entry.id === collectionId)
    if (!collection) {
      throw new NotFoundException('Knowledge collection not found')
    }
    await this.ensureKnowledgeCollectionPermission(actor, collection, 'admin')
    return { items: collection.accessGrants }
  }

  async shareKnowledgeCollection(
    actor: Actor,
    collectionId: string,
    input: ShareKnowledgeResourceInput
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertKnowledgeManage(actor)
    const collections = await this.readKnowledgeCollections(actor.workspaceId)
    const collection = collections.find((entry) => entry.id === collectionId)
    if (!collection) {
      throw new NotFoundException('Knowledge collection not found')
    }
    await this.ensureKnowledgeCollectionPermission(actor, collection, 'admin')

    const principalId = await this.resolveWorkspaceResourcePrincipalId(actor, input)
    const existing = collection.accessGrants.find(
      (grant) => grant.principalType === input.principalType && grant.principalId === principalId
    )
    if (existing) {
      existing.permission = input.permission
      collection.accessGrants = this.ensureKnowledgeGrantSafeguards(
        actor,
        'knowledge_collection',
        collection.id,
        collection.accessGrants
      )
      await this.writeKnowledgeCollections(actor.workspaceId, collections)
      this.events.emit(actor.workspaceId, 'permissions.updated', collection.id, actor.userId, {
        grantId: existing.id,
        resourceType: 'knowledge_collection'
      })
      return { grant: existing }
    }

    const grant = this.buildKnowledgeGrant(
      actor.workspaceId,
      'knowledge_collection',
      collection.id,
      input.principalType,
      principalId,
      input.permission
    )
    collection.accessGrants = this.ensureKnowledgeGrantSafeguards(
      actor,
      'knowledge_collection',
      collection.id,
      [...collection.accessGrants, grant]
    )
    await this.writeKnowledgeCollections(actor.workspaceId, collections)
    this.events.emit(actor.workspaceId, 'permissions.updated', collection.id, actor.userId, {
      grantId: grant.id,
      resourceType: 'knowledge_collection'
    })
    return { grant }
  }

  async revokeKnowledgeCollectionShare(
    actor: Actor,
    collectionId: string,
    grantId: string
  ): Promise<{ ok: true }> {
    this.assertKnowledgeManage(actor)
    const collections = await this.readKnowledgeCollections(actor.workspaceId)
    const collection = collections.find((entry) => entry.id === collectionId)
    if (!collection) {
      throw new NotFoundException('Knowledge collection not found')
    }
    await this.ensureKnowledgeCollectionPermission(actor, collection, 'admin')
    collection.accessGrants = this.removeKnowledgeGrant(
      actor,
      'knowledge_collection',
      collection.id,
      collection.accessGrants,
      grantId
    )
    await this.writeKnowledgeCollections(actor.workspaceId, collections)
    this.events.emit(actor.workspaceId, 'permissions.updated', collection.id, actor.userId, {
      grantId,
      removed: true,
      resourceType: 'knowledge_collection'
    })
    return { ok: true }
  }

  async listAccessGrants(actor: Actor, projectId: string): Promise<OpenPortListResponse<OpenPortProjectGrant>> {
    const project = await this.requireProject(actor, projectId, 'admin')
    return { items: project.accessGrants }
  }

  async share(actor: Actor, projectId: string, input: ShareProjectInput): Promise<OpenPortProjectGrantResponse> {
    const allProjects = await this.readAllProjects(actor)
    const project = await this.requireProject(actor, projectId, 'admin', allProjects)

    const principalId =
      input.principalType === 'workspace'
        ? input.principalId?.trim() || actor.workspaceId
        : input.principalType === 'group'
          ? input.principalId?.trim() || ''
        : input.principalType === 'public'
          ? '*'
          : input.principalId?.trim() || ''

    if (!principalId) {
      throw new BadRequestException('principalId is required')
    }

    if (input.principalType === 'group') {
      await this.groups.requireGroup(actor, principalId)
    }

    const existing = project.accessGrants.find(
      (grant) => grant.principalType === input.principalType && grant.principalId === principalId
    )
    if (existing) {
      existing.permission = input.permission
      await this.writeProjects(actor.workspaceId, allProjects)
      this.events.emit(actor.workspaceId, 'permissions.updated', projectId, actor.userId, { grantId: existing.id })
      return { grant: existing }
    }

    const grant = this.buildGrant({
      projectId,
      principalType: input.principalType,
      principalId,
      permission: input.permission
    })
    project.accessGrants.push(grant)
    await this.writeProjects(actor.workspaceId, allProjects)
    this.events.emit(actor.workspaceId, 'permissions.updated', projectId, actor.userId, { grantId: grant.id })
    return { grant }
  }

  async revokeShare(actor: Actor, projectId: string, grantId: string): Promise<{ ok: true }> {
    const allProjects = await this.readAllProjects(actor)
    const project = await this.requireProject(actor, projectId, 'admin', allProjects)
    project.accessGrants = project.accessGrants.filter((grant) => grant.id !== grantId)
    await this.writeProjects(actor.workspaceId, allProjects)
    this.events.emit(actor.workspaceId, 'permissions.updated', projectId, actor.userId, { grantId, removed: true })
    return { ok: true }
  }

  getCollaborationState(actor: Actor, projectId: string): OpenPortProjectCollaborationState {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    return this.events.getCollaborationState(actor.workspaceId, projectId)
  }

  heartbeatCollaboration(
    actor: CollaborationActor,
    projectId: string,
    state: 'viewing' | 'editing'
  ): OpenPortProjectCollaborationState {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    return this.events.heartbeat(actor, projectId, state)
  }

  async getKnowledgeContextForProject(
    actor: Actor,
    projectId: string,
    query: string,
    limit = 3
  ): Promise<string> {
    const response = await this.searchKnowledge(actor, projectId, query, limit)
    if (response.items.length === 0) return ''

    return response.items
      .map((item, index) => `Context ${index + 1} (${item.itemName}): ${item.snippet}`)
      .join('\n\n')
  }

  getCollaborationActor(actor: Actor): CollaborationActor {
    const user = this.auth.getOrCreateUser(actor.userId)
    return {
      ...actor,
      name: user.name,
      email: user.email
    }
  }

  private assertKnowledgeRead(actor: Actor): void {
    this.workspaces.assertWorkspaceModuleAccess(actor.userId, actor.workspaceId, 'knowledge', 'read')
  }

  private assertKnowledgeManage(actor: Actor): void {
    this.workspaces.assertWorkspaceModuleAccess(actor.userId, actor.workspaceId, 'knowledge', 'manage')
  }

  private async readProjects(actor: Actor): Promise<OpenPortProject[]> {
    const allProjects = await this.readAllProjects(actor)
    const sessions = await this.stateStore.readChatSessions(actor.userId)
    const chatIdsByProject = new Map<string, string[]>()

    sessions.forEach((session) => {
      const projectId = session.settings.projectId
      if (!projectId) return
      const current = chatIdsByProject.get(projectId) || []
      current.push(session.id)
      chatIdsByProject.set(projectId, current)
    })

    const readableProjects = await Promise.all(
      allProjects.map(async (project) => ({
        project,
        canRead: await this.canReadProject(actor, project)
      }))
    )

    return readableProjects
      .filter((entry) => entry.canRead)
      .map(({ project }) => ({
        ...project,
        chatIds: chatIdsByProject.get(project.id) || []
      }))
      .sort(compareProjects)
  }

  private async readAllProjects(actor: Actor): Promise<OpenPortProject[]> {
    const [projects, assets] = await Promise.all([
      this.stateStore.readProjects(actor.workspaceId),
      this.readAssets(actor)
    ])

    return projects
      .map((project) => ({
        ...project,
        meta: this.normalizeProjectMetaAgainstAssets(project.meta, assets)
      }))
      .sort(compareProjects)
  }

  private async readAssets(actor: Actor) {
    return this.stateStore.readProjectAssets(actor.workspaceId)
  }

  private async readKnowledge(actor: Actor): Promise<OpenPortProjectKnowledgeItem[]> {
    return this.stateStore.readKnowledgeItems(actor.workspaceId)
  }

  private async readKnowledgeCollections(workspaceId: string): Promise<OpenPortKnowledgeCollection[]> {
    const stored = (await this.stateStore.readKnowledgeCollections(workspaceId)).map((item) => ({
      ...item,
      accessGrants: this.ensureKnowledgeGrantSafeguardsForWorkspace(
        workspaceId,
        'knowledge_collection',
        item.id,
        item.accessGrants || []
      )
    }))
    const general = stored.find((item) => item.id === 'collection_general')
    if (!general) {
      return [
        {
          id: 'collection_general',
          workspaceId,
          name: 'General',
          description: 'Default knowledge collection.',
          itemCount: 0,
          updatedAt: new Date().toISOString(),
          accessGrants: this.defaultKnowledgeAccessGrantsForWorkspace(workspaceId, 'knowledge_collection', 'collection_general')
        },
        ...stored
      ]
    }
    return stored
  }

  private async writeKnowledgeCollections(
    workspaceId: string,
    collections: OpenPortKnowledgeCollection[]
  ): Promise<void> {
    const deduped = new Map<string, OpenPortKnowledgeCollection>()
    collections.forEach((item) => {
      deduped.set(item.id, {
        ...item,
        accessGrants: this.ensureKnowledgeGrantSafeguardsForWorkspace(
          workspaceId,
          'knowledge_collection',
          item.id,
          item.accessGrants || []
        )
      })
    })
    if (!deduped.has('collection_general')) {
      deduped.set('collection_general', {
        id: 'collection_general',
        workspaceId,
        name: 'General',
        description: 'Default knowledge collection.',
        itemCount: 0,
        updatedAt: new Date().toISOString(),
        accessGrants: this.defaultKnowledgeAccessGrantsForWorkspace(workspaceId, 'knowledge_collection', 'collection_general')
      })
    }
    await this.stateStore.writeKnowledgeCollections(
      workspaceId,
      Array.from(deduped.values()).sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      )
    )
  }

  private async writeProjects(workspaceId: string, projects: OpenPortProject[]): Promise<void> {
    const validIds = new Set(projects.map((project) => project.id))
    const sanitized = projects
      .map((project) => ({
        ...project,
        parentId: project.parentId && validIds.has(project.parentId) ? project.parentId : null
      }))
      .sort(compareProjects)

    await this.stateStore.writeProjects(workspaceId, sanitized)
  }

  private requireProjectInCollection(projects: OpenPortProject[], projectId: string): OpenPortProject {
    const project = projects.find((entry) => entry.id === projectId)
    if (!project) {
      throw new NotFoundException('Project not found')
    }
    return project
  }

  private async requireProject(
    actor: Actor,
    projectId: string,
    permission: OpenPortProjectPermission = 'read',
    projects?: OpenPortProject[]
  ): Promise<OpenPortProject> {
    const project = this.requireProjectInCollection(projects || (await this.readAllProjects(actor)), projectId)
    await this.ensureProjectAccess(actor, project, permission)
    return project
  }

  private getDescendantIds(projects: OpenPortProject[], projectId: string): string[] {
    const descendants: string[] = []
    const stack = [projectId]

    while (stack.length > 0) {
      const current = stack.pop() as string
      projects
        .filter((project) => project.parentId === current)
        .forEach((project) => {
          descendants.push(project.id)
          stack.push(project.id)
        })
    }

    return descendants
  }

  private isProjectAncestor(projects: OpenPortProject[], projectId: string, candidateParentId: string | null): boolean {
    if (!candidateParentId) return false
    if (projectId === candidateParentId) return true

    let currentParentId: string | null = candidateParentId
    while (currentParentId) {
      if (currentParentId === projectId) return true
      currentParentId = projects.find((entry) => entry.id === currentParentId)?.parentId || null
    }

    return false
  }

  private createUniqueProjectName(
    projects: OpenPortProject[],
    value: string,
    parentId: string | null,
    excludeId?: string
  ): string {
    const baseName = normalizeProjectName(value)
    const siblingNames = new Set(
      projects
        .filter((project) => project.parentId === parentId && project.id !== excludeId)
        .map((project) => project.name.toLowerCase())
    )

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

  private normalizeFilesAgainstKnowledge(
    knowledgeItems: OpenPortProjectKnowledgeItem[],
    data: OpenPortProjectData
  ): OpenPortProjectData {
    const knowledgeById = new Map(knowledgeItems.map((item) => [item.id, item]))
    return {
      ...data,
      files: data.files
        .filter((file) => !file.knowledgeItemId || knowledgeById.has(file.knowledgeItemId))
        .map((file) => {
          const knowledge = file.knowledgeItemId ? knowledgeById.get(file.knowledgeItemId) || null : null
          return {
            ...file,
            assetId: file.assetId ?? knowledge?.assetId ?? null
          }
        })
    }
  }

  private normalizeProjectMetaAgainstAssets(
    meta: OpenPortProjectMeta,
    assets: Array<{ id: string; contentUrl: string }>
  ): OpenPortProjectMeta {
    if (!meta.backgroundImageAssetId) {
      return {
        ...meta,
        backgroundImageUrl: meta.backgroundImageUrl ?? null
      }
    }

    const matched = assets.find((asset) => asset.id === meta.backgroundImageAssetId)
    return {
      ...meta,
      backgroundImageUrl: matched?.contentUrl ?? meta.backgroundImageUrl ?? null
    }
  }

  private normalizeChunkingOptions(
    input?: Partial<OpenPortKnowledgeChunkingOptions> | null
  ): KnowledgeChunkingOptions {
    const strategy =
      input?.strategy === 'dense' || input?.strategy === 'sparse' || input?.strategy === 'semantic' || input?.strategy === 'balanced'
        ? input.strategy
        : 'balanced'
    const chunkSize = Math.max(120, Math.min(2400, Number(input?.chunkSize ?? 0) || (strategy === 'dense' ? 360 : strategy === 'sparse' ? 900 : strategy === 'semantic' ? 720 : 600)))
    const overlap = Math.max(0, Math.min(chunkSize - 1, Number(input?.overlap ?? 0) || (strategy === 'dense' ? 90 : 120)))
    const maxChunks = Math.max(1, Math.min(300, Number(input?.maxChunks ?? 0) || (strategy === 'dense' ? 120 : strategy === 'sparse' ? 40 : strategy === 'semantic' ? 80 : 50)))
    return { strategy, chunkSize, overlap, maxChunks }
  }

  private async persistKnowledgeItem(
    workspaceId: string,
    item: OpenPortProjectKnowledgeItem,
    chunking?: KnowledgeChunkingOptions
  ): Promise<OpenPortProjectKnowledgeItem> {
    const resolvedChunking = chunking || this.normalizeChunkingOptions()
    const contentText = item.contentText ?? ''
    const nextItem: OpenPortProjectKnowledgeItem = {
      ...item,
      contentText,
      previewText: item.previewText || buildKnowledgePreview(contentText),
      accessGrants: this.ensureKnowledgeGrantSafeguardsForWorkspace(
        workspaceId,
        'knowledge_item',
        item.id,
        item.accessGrants || []
      )
    }
    const chunks = contentText.trim()
      ? buildKnowledgeChunks(workspaceId, nextItem.id, contentText, resolvedChunking)
      : ([] as ProjectKnowledgeChunkRecord[])
    const denseChunks = this.retrieval.buildDenseChunks(chunks)

    nextItem.retrievalState = chunks.length > 0 ? 'indexed' : 'binary'
    nextItem.chunkCount = chunks.length

    const [items, existingChunks, existingDenseChunks] = await Promise.all([
      this.stateStore.readKnowledgeItems(workspaceId),
      this.stateStore.readKnowledgeChunks(workspaceId),
      this.stateStore.readDenseKnowledgeChunks(workspaceId)
    ])

    await this.stateStore.writeKnowledgeItems(workspaceId, [
      nextItem,
      ...items.filter((entry) => entry.id !== nextItem.id)
    ])
    await this.stateStore.writeKnowledgeChunks(workspaceId, [
      ...existingChunks.filter((chunk) => chunk.itemId !== nextItem.id),
      ...chunks
    ])
    await this.stateStore.writeDenseKnowledgeChunks(workspaceId, [
      ...existingDenseChunks.filter((chunk) => chunk.itemId !== nextItem.id),
      ...denseChunks
    ])

    return nextItem
  }

  private getKnowledgeSources(item: OpenPortProjectKnowledgeItem): OpenPortProjectKnowledgeSource[] {
    return Array.isArray(item.sources) ? item.sources : [defaultKnowledgeSource(item)]
  }

  private async resolveCollectionTarget(
    actor: Actor,
    input?: { collectionId?: string | null; collectionName?: string | null }
  ): Promise<{ collectionId: string | null; collectionName: string }> {
    const normalized = resolveKnowledgeCollection(input)
    const collections = await this.readKnowledgeCollections(actor.workspaceId)

    if (!normalized.collectionId) {
      return {
        collectionId: 'collection_general',
        collectionName: 'General'
      }
    }

    const matched =
      collections.find((item) => item.id === normalized.collectionId) ||
      collections.find((item) => item.name.toLowerCase() === normalized.collectionName.toLowerCase())

    if (matched) {
      return {
        collectionId: matched.id,
        collectionName: matched.name
      }
    }

    const created: OpenPortKnowledgeCollection = {
      id: normalized.collectionId,
      workspaceId: actor.workspaceId,
      name: normalized.collectionName,
      description: '',
      itemCount: 0,
      updatedAt: new Date().toISOString(),
      accessGrants: this.defaultKnowledgeAccessGrants(actor, 'knowledge_collection', normalized.collectionId)
    }
    await this.writeKnowledgeCollections(actor.workspaceId, [created, ...collections])
    return {
      collectionId: created.id,
      collectionName: created.name
    }
  }

  private buildGrant(input: {
    projectId: string
    principalType: OpenPortProjectGrant['principalType']
    principalId: string
    permission: OpenPortProjectPermission
  }): OpenPortProjectGrant {
    return {
      id: `project_grant_${randomUUID()}`,
      projectId: input.projectId,
      principalType: input.principalType,
      principalId: input.principalId,
      permission: input.permission,
      createdAt: new Date().toISOString()
    }
  }

  private normalizeImportedGrants(
    grants: OpenPortProjectGrant[] | undefined,
    projectId: string,
    actor: Actor
  ): OpenPortProjectGrant[] {
    if (!Array.isArray(grants) || grants.length === 0) {
      return [
        this.buildGrant({
          projectId,
          principalType: 'workspace',
          principalId: actor.workspaceId,
          permission: 'write'
        })
      ]
    }

    const normalized = grants
      .map((grant) =>
        normalizeProjectGrant(projectId, {
          ...grant,
          projectId,
          principalId:
            grant.principalType === 'workspace'
              ? actor.workspaceId
              : grant.principalType === 'group'
                ? grant.principalId
              : grant.principalType === 'public'
                ? '*'
                : grant.principalId
        })
      )
      .filter((grant): grant is OpenPortProjectGrant => Boolean(grant))

    return normalized.length > 0
      ? normalized
      : [
          this.buildGrant({
            projectId,
            principalType: 'workspace',
            principalId: actor.workspaceId,
            permission: 'write'
          })
        ]
  }

  private async resolveActorGroupIds(actor: Actor): Promise<Set<string>> {
    const groups = await this.groups.listGroupsForUser(actor.workspaceId, actor.userId)
    return new Set(groups.map((group) => group.id))
  }

  private hasWorkspaceResourcePermission(
    actor: Actor,
    groupIds: Set<string>,
    grants: OpenPortWorkspaceResourceGrant[] | undefined,
    requiredPermission: OpenPortWorkspaceResourcePermission
  ): boolean {
    const matched: OpenPortWorkspaceResourcePermission[] = []

    ;(grants || []).forEach((grant) => {
      if (grant.principalType === 'public' && grant.principalId === '*') {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'workspace' && grant.principalId === actor.workspaceId) {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'user' && grant.principalId === actor.userId) {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'group' && groupIds.has(grant.principalId)) {
        matched.push(grant.permission)
      }
    })

    if (matched.length === 0) return false
    const resolved = matched.sort(
      (left, right) => rankWorkspaceResourcePermission(right) - rankWorkspaceResourcePermission(left)
    )[0]
    return rankWorkspaceResourcePermission(resolved) >= rankWorkspaceResourcePermission(requiredPermission)
  }

  private async ensureKnowledgeItemPermission(
    actor: Actor,
    item: OpenPortProjectKnowledgeItem,
    requiredPermission: OpenPortWorkspaceResourcePermission
  ): Promise<void> {
    if (item.workspaceId !== actor.workspaceId) {
      throw new ForbiddenException('Knowledge item does not belong to the active workspace')
    }
    const groupIds = await this.resolveActorGroupIds(actor)
    if (!this.hasWorkspaceResourcePermission(actor, groupIds, item.accessGrants, requiredPermission)) {
      throw new ForbiddenException(`${requiredPermission} access required for knowledge item`)
    }
  }

  private async ensureKnowledgeCollectionPermission(
    actor: Actor,
    collection: OpenPortKnowledgeCollection,
    requiredPermission: OpenPortWorkspaceResourcePermission
  ): Promise<void> {
    if (collection.workspaceId !== actor.workspaceId) {
      throw new ForbiddenException('Knowledge collection does not belong to the active workspace')
    }
    const groupIds = await this.resolveActorGroupIds(actor)
    if (!this.hasWorkspaceResourcePermission(actor, groupIds, collection.accessGrants, requiredPermission)) {
      throw new ForbiddenException(`${requiredPermission} access required for knowledge collection`)
    }
  }

  private async findKnowledgeItemBySourceId(
    actor: Actor,
    sourceId: string
  ): Promise<OpenPortProjectKnowledgeItem> {
    const item = (await this.readKnowledge(actor)).find((entry) =>
      this.getKnowledgeSources(entry).some((source) => source.id === sourceId)
    )
    if (!item) {
      throw new NotFoundException('Knowledge source not found')
    }
    return item
  }

  private async findKnowledgeItemByChunkId(
    actor: Actor,
    chunkId: string
  ): Promise<OpenPortProjectKnowledgeItem> {
    const items = await this.readKnowledge(actor)
    const previewMatch = items.find((item) => (item.chunkPreview || []).some((chunk) => chunk.id === chunkId))
    if (previewMatch) {
      return previewMatch
    }

    const chunks = await this.stateStore.readKnowledgeChunks(actor.workspaceId)
    const chunk = chunks.find((entry) => entry.id === chunkId)
    if (!chunk) {
      throw new NotFoundException('Knowledge chunk not found')
    }
    const item = items.find((entry) => entry.id === chunk.itemId)
    if (!item) {
      throw new NotFoundException('Knowledge chunk not found')
    }
    return item
  }

  private async ensureKnowledgeSourceExists(actor: Actor, sourceId: string): Promise<void> {
    const items = await this.stateStore.readKnowledgeItems(actor.workspaceId)
    const exists = items.some((item) => this.getKnowledgeSources(item).some((source) => source.id === sourceId))
    if (!exists) {
      throw new NotFoundException('Knowledge source not found')
    }
  }

  private async ensureKnowledgeChunkExists(actor: Actor, chunkId: string): Promise<void> {
    const chunks = await this.stateStore.readKnowledgeChunks(actor.workspaceId)
    const exists = chunks.some((entry) => entry.id === chunkId)
    if (!exists) {
      throw new NotFoundException('Knowledge chunk not found')
    }
  }

  private async ensureKnowledgeResourcePermission(
    actor: Actor,
    grants: OpenPortWorkspaceResourceGrant[],
    requiredPermission: OpenPortWorkspaceResourcePermission,
    resourceLabel: string
  ): Promise<void> {
    const groupIds = await this.resolveActorGroupIds(actor)
    if (!this.hasWorkspaceResourcePermission(actor, groupIds, grants, requiredPermission)) {
      throw new ForbiddenException(`${requiredPermission} access required for ${resourceLabel}`)
    }
  }

  private async readKnowledgeSourceGrantEntry(
    actor: Actor,
    sourceId: string
  ): Promise<{ allGrants: OpenPortWorkspaceResourceGrant[]; grants: OpenPortWorkspaceResourceGrant[] }> {
    await this.ensureKnowledgeSourceExists(actor, sourceId)
    const allGrants = await this.stateStore.readKnowledgeSourceGrants(actor.workspaceId)
    const current = allGrants.filter((grant) => grant.resourceType === 'knowledge_source' && grant.resourceId === sourceId)
    const ensured = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_source', sourceId, current)
    if (this.haveKnowledgeGrantsChanged(current, ensured)) {
      const merged = this.replaceKnowledgeResourceGrants(allGrants, 'knowledge_source', sourceId, ensured)
      await this.stateStore.writeKnowledgeSourceGrants(actor.workspaceId, merged)
      return { allGrants: merged, grants: ensured }
    }
    return { allGrants, grants: ensured }
  }

  private async writeKnowledgeSourceGrantEntry(
    actor: Actor,
    sourceId: string,
    allGrants: OpenPortWorkspaceResourceGrant[],
    grants: OpenPortWorkspaceResourceGrant[]
  ): Promise<void> {
    const merged = this.replaceKnowledgeResourceGrants(allGrants, 'knowledge_source', sourceId, grants)
    await this.stateStore.writeKnowledgeSourceGrants(actor.workspaceId, merged)
  }

  private async readKnowledgeChunkGrantEntry(
    actor: Actor,
    chunkId: string
  ): Promise<{ allGrants: OpenPortWorkspaceResourceGrant[]; grants: OpenPortWorkspaceResourceGrant[] }> {
    await this.ensureKnowledgeChunkExists(actor, chunkId)
    const allGrants = await this.stateStore.readKnowledgeChunkGrants(actor.workspaceId)
    const current = allGrants.filter((grant) => grant.resourceType === 'knowledge_chunk' && grant.resourceId === chunkId)
    const ensured = this.ensureKnowledgeGrantSafeguards(actor, 'knowledge_chunk', chunkId, current)
    if (this.haveKnowledgeGrantsChanged(current, ensured)) {
      const merged = this.replaceKnowledgeResourceGrants(allGrants, 'knowledge_chunk', chunkId, ensured)
      await this.stateStore.writeKnowledgeChunkGrants(actor.workspaceId, merged)
      return { allGrants: merged, grants: ensured }
    }
    return { allGrants, grants: ensured }
  }

  private async writeKnowledgeChunkGrantEntry(
    actor: Actor,
    chunkId: string,
    allGrants: OpenPortWorkspaceResourceGrant[],
    grants: OpenPortWorkspaceResourceGrant[]
  ): Promise<void> {
    const merged = this.replaceKnowledgeResourceGrants(allGrants, 'knowledge_chunk', chunkId, grants)
    await this.stateStore.writeKnowledgeChunkGrants(actor.workspaceId, merged)
  }

  private replaceKnowledgeResourceGrants(
    allGrants: OpenPortWorkspaceResourceGrant[],
    resourceType: 'knowledge_source' | 'knowledge_chunk',
    resourceId: string,
    resourceGrants: OpenPortWorkspaceResourceGrant[]
  ): OpenPortWorkspaceResourceGrant[] {
    return [
      ...allGrants.filter((grant) => !(grant.resourceType === resourceType && grant.resourceId === resourceId)),
      ...resourceGrants
    ]
  }

  private haveKnowledgeGrantsChanged(
    left: OpenPortWorkspaceResourceGrant[],
    right: OpenPortWorkspaceResourceGrant[]
  ): boolean {
    if (left.length !== right.length) {
      return true
    }
    const serialize = (grant: OpenPortWorkspaceResourceGrant) =>
      [
        grant.id,
        grant.resourceType,
        grant.resourceId,
        grant.principalType,
        grant.principalId,
        grant.permission,
        grant.createdAt
      ].join('::')
    const leftKeys = [...left].map(serialize).sort()
    const rightKeys = [...right].map(serialize).sort()
    return leftKeys.some((key, index) => key !== rightKeys[index])
  }

  private defaultKnowledgeAccessGrants(
    actor: Actor,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string
  ): OpenPortWorkspaceResourceGrant[] {
    return this.defaultKnowledgeAccessGrantsForWorkspace(actor.workspaceId, resourceType, resourceId)
  }

  private buildKnowledgeGrant(
    workspaceId: string,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string,
    principalType: OpenPortWorkspaceResourcePrincipalType,
    principalId: string,
    permission: OpenPortWorkspaceResourcePermission
  ): OpenPortWorkspaceResourceGrant {
    return {
      id: `workspace_resource_grant_${resourceType}_${resourceId}_${randomUUID()}`,
      workspaceId,
      resourceType,
      resourceId,
      principalType,
      principalId,
      permission,
      createdAt: new Date().toISOString()
    }
  }

  private ensureKnowledgeGrantSafeguards(
    actor: Actor,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[]
  ): OpenPortWorkspaceResourceGrant[] {
    return this.ensureKnowledgeGrantSafeguardsForWorkspace(actor.workspaceId, resourceType, resourceId, grants)
  }

  private defaultKnowledgeAccessGrantsForWorkspace(
    workspaceId: string,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string
  ): OpenPortWorkspaceResourceGrant[] {
    return [this.buildKnowledgeGrant(workspaceId, resourceType, resourceId, 'workspace', workspaceId, 'admin')]
  }

  private ensureKnowledgeGrantSafeguardsForWorkspace(
    workspaceId: string,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[]
  ): OpenPortWorkspaceResourceGrant[] {
    const normalized = grants.map((grant) => ({
      ...grant,
      workspaceId,
      resourceType,
      resourceId
    }))
    const hasWorkspaceAdmin = normalized.some(
      (grant) =>
        grant.principalType === 'workspace' &&
        grant.principalId === workspaceId &&
        grant.permission === 'admin'
    )
    if (hasWorkspaceAdmin) {
      return normalized
    }
    return [this.buildKnowledgeGrant(workspaceId, resourceType, resourceId, 'workspace', workspaceId, 'admin'), ...normalized]
  }

  private removeKnowledgeGrant(
    actor: Actor,
    resourceType: 'knowledge_item' | 'knowledge_collection' | 'knowledge_source' | 'knowledge_chunk',
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[],
    grantId: string
  ): OpenPortWorkspaceResourceGrant[] {
    const filtered = grants.filter((grant) => grant.id !== grantId)
    return this.ensureKnowledgeGrantSafeguards(actor, resourceType, resourceId, filtered)
  }

  private async resolveWorkspaceResourcePrincipalId(
    actor: Actor,
    input: ShareKnowledgeResourceInput
  ): Promise<string> {
    const principalId =
      input.principalType === 'workspace'
        ? input.principalId?.trim() || actor.workspaceId
        : input.principalType === 'group'
          ? input.principalId?.trim() || ''
          : input.principalType === 'public'
            ? '*'
            : input.principalId?.trim() || ''
    if (!principalId) {
      throw new BadRequestException('principalId is required')
    }
    if (input.principalType === 'group') {
      await this.groups.requireGroup(actor, principalId)
    }
    return principalId
  }

  private async canReadProject(actor: Actor, project: OpenPortProject): Promise<boolean> {
    return (await this.resolvePermission(actor, project)) !== null
  }

  private async ensureProjectAccess(
    actor: Actor,
    project: OpenPortProject,
    requiredPermission: OpenPortProjectPermission
  ): Promise<void> {
    if (project.workspaceId !== actor.workspaceId) {
      throw new ForbiddenException('Project does not belong to the active workspace')
    }

    const resolved = await this.resolvePermission(actor, project)
    if (!resolved || rankPermission(resolved) < rankPermission(requiredPermission)) {
      throw new ForbiddenException(`${requiredPermission} access required`)
    }
  }

  private async resolvePermission(actor: Actor, project: OpenPortProject): Promise<OpenPortProjectPermission | null> {
    if (project.ownerUserId === actor.userId) return 'admin'

    const grants = project.accessGrants || []
    const matched: OpenPortProjectPermission[] = []
    const groups = await this.groups.listGroupsForUser(actor.workspaceId, actor.userId)
    const groupIds = new Set(groups.map((group) => group.id))

    grants.forEach((grant) => {
      if (grant.principalType === 'public' && grant.principalId === '*') {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'workspace' && grant.principalId === actor.workspaceId) {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'user' && grant.principalId === actor.userId) {
        matched.push(grant.permission)
      }
      if (grant.principalType === 'group' && groupIds.has(grant.principalId)) {
        matched.push(grant.permission)
      }
    })

    if (matched.length === 0) return null
    return matched.sort((left, right) => rankPermission(right) - rankPermission(left))[0] || null
  }
}
