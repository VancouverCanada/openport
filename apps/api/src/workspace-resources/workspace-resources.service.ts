import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type {
  OpenPortListResponse,
  OpenPortWorkspaceConnector,
  OpenPortWorkspaceConnectorAdapter,
  OpenPortWorkspaceConnectorAuditEvent,
  OpenPortWorkspaceConnectorCredential,
  OpenPortWorkspaceConnectorResponse,
  OpenPortWorkspaceConnectorCredentialResponse,
  OpenPortWorkspaceConnectorTask,
  OpenPortWorkspaceConnectorTaskResponse,
  OpenPortWorkspaceConnectorSyncMode,
  OpenPortWorkspaceModel,
  OpenPortWorkspacePromptSuggestion,
  OpenPortWorkspaceModelResponse,
  OpenPortWorkspacePrompt,
  OpenPortWorkspacePromptCommunityStatus,
  OpenPortWorkspacePromptResponse,
  OpenPortWorkspacePromptVersion,
  OpenPortWorkspacePromptVersionsResponse,
  OpenPortWorkspaceResourceGrant,
  OpenPortWorkspaceResourceGrantResponse,
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType,
  OpenPortWorkspaceResourceType,
  OpenPortWorkspaceSkill,
  OpenPortWorkspaceSkillResponse,
  OpenPortWorkspaceTool,
  OpenPortWorkspaceToolRun,
  OpenPortWorkspaceToolRunResponse,
  OpenPortWorkspaceToolExecutionChain,
  OpenPortWorkspaceToolPackage,
  OpenPortWorkspaceToolPackageImportResponse,
  OpenPortWorkspaceToolPackageResponse,
  OpenPortWorkspaceToolResponse,
  OpenPortWorkspaceToolValveSchemaField,
  OpenPortWorkspaceToolValidationResponse
} from '@openport/product-contracts'
import { createHash, randomUUID } from 'node:crypto'
import { GroupsService } from '../groups/groups.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { OllamaService } from '../ollama/ollama.service.js'
import type { Actor } from '../projects/projects.service.js'
import type { CreateWorkspaceModelDto } from './dto/create-workspace-model.dto.js'
import type { UpdateWorkspaceModelDto } from './dto/update-workspace-model.dto.js'
import type { CreateWorkspacePromptDto } from './dto/create-workspace-prompt.dto.js'
import type { UpdateWorkspacePromptDto } from './dto/update-workspace-prompt.dto.js'
import type { SubmitWorkspacePromptCommunityDto } from './dto/submit-workspace-prompt-community.dto.js'
import type { CreateWorkspaceToolDto } from './dto/create-workspace-tool.dto.js'
import type { UpdateWorkspaceToolDto } from './dto/update-workspace-tool.dto.js'
import type { ValidateWorkspaceToolDto } from './dto/validate-workspace-tool.dto.js'
import type { ImportWorkspaceToolPackageDto } from './dto/import-workspace-tool-package.dto.js'
import type { RunWorkspaceToolOrchestrationDto } from './dto/run-workspace-tool-orchestration.dto.js'
import type { ReplayWorkspaceToolOrchestrationRunDto } from './dto/replay-workspace-tool-orchestration-run.dto.js'
import type { CreateWorkspaceSkillDto } from './dto/create-workspace-skill.dto.js'
import type { UpdateWorkspaceSkillDto } from './dto/update-workspace-skill.dto.js'
import type { ShareWorkspaceResourceDto } from './dto/share-workspace-resource.dto.js'
import type { CreateWorkspaceConnectorDto } from './dto/create-workspace-connector.dto.js'
import type { UpdateWorkspaceConnectorDto } from './dto/update-workspace-connector.dto.js'
import type { CreateWorkspaceConnectorCredentialDto } from './dto/create-workspace-connector-credential.dto.js'
import type { UpdateWorkspaceConnectorCredentialDto } from './dto/update-workspace-connector-credential.dto.js'
import type { TriggerWorkspaceConnectorSyncDto } from './dto/trigger-workspace-connector-sync.dto.js'

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizePromptSuggestions(
  suggestions: Array<{ id?: string; title?: string; prompt?: string }> | undefined,
  existing: OpenPortWorkspacePromptSuggestion[] = []
): OpenPortWorkspacePromptSuggestion[] {
  if (!Array.isArray(suggestions)) {
    return existing
  }

  return suggestions
    .map((suggestion, index) => ({
      id: suggestion.id?.trim() || `suggestion_${randomUUID()}`,
      title: suggestion.title?.trim() || `Suggestion ${index + 1}`,
      prompt: suggestion.prompt?.trim() || ''
    }))
    .filter((suggestion) => suggestion.prompt.length > 0)
}

type WorkspaceResourceModule = 'models' | 'prompts' | 'tools' | 'skills'

function rankResourcePermission(permission: OpenPortWorkspaceResourcePermission): number {
  if (permission === 'admin') return 3
  if (permission === 'write') return 2
  return 1
}

@Injectable()
export class WorkspaceResourcesService implements OnModuleInit, OnModuleDestroy {
  private connectorScheduler: ReturnType<typeof setInterval> | null = null
  private connectorRunner: Promise<void> | null = null
  private toolRunner: Promise<void> | null = null

  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly groups: GroupsService,
    private readonly stateStore: ApiStateStoreService,
    private readonly ollama: OllamaService
  ) {}

  onModuleInit(): void {
    this.connectorScheduler = setInterval(() => {
      void this.runConnectorSchedulerTick()
      void this.runConnectorQueueTick()
      void this.runToolQueueTick()
    }, 15_000)
  }

  onModuleDestroy(): void {
    if (this.connectorScheduler) {
      clearInterval(this.connectorScheduler)
      this.connectorScheduler = null
    }
  }

  async listModels(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceModel>> {
    this.assertModuleRead(actor, 'models')
    await this.ollama.ensureWorkspaceModels(actor).catch(() => undefined)
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const resolvedItems = items.length > 0 ? items : [await this.ensureDefaultModel(actor)]
    const groupIds = await this.resolveActorGroupIds(actor)
    return {
      items: resolvedItems.filter((item) => this.hasResourcePermission(actor, groupIds, item.accessGrants, 'read'))
    }
  }

  async getModel(actor: Actor, id: string): Promise<OpenPortWorkspaceModelResponse> {
    this.assertModuleRead(actor, 'models')
    const item = (await this.stateStore.readWorkspaceModels(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'read')
    return { item }
  }

  async createModel(actor: Actor, dto: CreateWorkspaceModelDto): Promise<OpenPortWorkspaceModelResponse> {
    this.assertModuleManage(actor, 'models')
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const now = new Date().toISOString()
    const id = dto.id?.trim() || `model_${randomUUID()}`
    if (items.some((entry) => entry.id === id || entry.route === dto.route.trim())) {
      throw new BadRequestException('Model id or route already exists')
    }

    const item: OpenPortWorkspaceModel = {
      id,
      workspaceId: actor.workspaceId,
      name: dto.name.trim(),
      route: dto.route.trim(),
      provider: dto.provider?.trim() || 'openport',
      description: dto.description?.trim() || '',
      tags: dto.tags?.filter(Boolean) || [],
      status: dto.status === 'disabled' ? 'disabled' : 'active',
      isDefault: items.length === 0 ? true : Boolean(dto.isDefault),
      filterIds: dto.filterIds?.filter(Boolean) || [],
      defaultFilterIds: dto.defaultFilterIds?.filter(Boolean) || [],
      actionIds: dto.actionIds?.filter(Boolean) || [],
      defaultFeatureIds: dto.defaultFeatureIds?.filter(Boolean) || [],
      capabilities: {
        vision: Boolean(dto.capabilities?.vision),
        webSearch: Boolean(dto.capabilities?.webSearch),
        imageGeneration: Boolean(dto.capabilities?.imageGeneration),
        codeInterpreter: Boolean(dto.capabilities?.codeInterpreter)
      },
      knowledgeItemIds: dto.knowledgeItemIds?.filter(Boolean) || [],
      toolIds: dto.toolIds?.filter(Boolean) || [],
      builtinToolIds: dto.builtinToolIds?.filter(Boolean) || [],
      skillIds: dto.skillIds?.filter(Boolean) || [],
      promptSuggestions: normalizePromptSuggestions(dto.promptSuggestions),
      accessGrants: this.defaultResourceAccessGrants(actor, 'model', id),
      createdAt: now,
      updatedAt: now
    }

    const nextItems = item.isDefault ? items.map((entry) => ({ ...entry, isDefault: false })) : items
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, [item, ...nextItems])
    return { item }
  }

  async updateModel(actor: Actor, id: string, dto: UpdateWorkspaceModelDto): Promise<OpenPortWorkspaceModelResponse> {
    this.assertModuleManage(actor, 'models')
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const updated: OpenPortWorkspaceModel = {
      ...item,
      name: dto.name?.trim() || item.name,
      route: dto.route?.trim() || item.route,
      provider: dto.provider?.trim() || item.provider,
      description: dto.description?.trim() ?? item.description,
      tags: dto.tags ? dto.tags.filter(Boolean) : item.tags,
      status: dto.status === 'disabled' ? 'disabled' : dto.status === 'active' ? 'active' : item.status,
      isDefault: dto.isDefault ?? item.isDefault,
      filterIds: dto.filterIds ? dto.filterIds.filter(Boolean) : item.filterIds,
      defaultFilterIds: dto.defaultFilterIds ? dto.defaultFilterIds.filter(Boolean) : item.defaultFilterIds,
      actionIds: dto.actionIds ? dto.actionIds.filter(Boolean) : item.actionIds,
      defaultFeatureIds: dto.defaultFeatureIds ? dto.defaultFeatureIds.filter(Boolean) : item.defaultFeatureIds,
      capabilities: {
        vision: dto.capabilities?.vision ?? item.capabilities.vision,
        webSearch: dto.capabilities?.webSearch ?? item.capabilities.webSearch,
        imageGeneration: dto.capabilities?.imageGeneration ?? item.capabilities.imageGeneration,
        codeInterpreter: dto.capabilities?.codeInterpreter ?? item.capabilities.codeInterpreter
      },
      knowledgeItemIds: dto.knowledgeItemIds ? dto.knowledgeItemIds.filter(Boolean) : item.knowledgeItemIds,
      toolIds: dto.toolIds ? dto.toolIds.filter(Boolean) : item.toolIds,
      builtinToolIds: dto.builtinToolIds ? dto.builtinToolIds.filter(Boolean) : item.builtinToolIds,
      skillIds: dto.skillIds ? dto.skillIds.filter(Boolean) : item.skillIds,
      promptSuggestions: normalizePromptSuggestions(dto.promptSuggestions, item.promptSuggestions),
      updatedAt: new Date().toISOString()
    }

    const nextItems = items.map((entry) =>
      entry.id === id ? updated : updated.isDefault ? { ...entry, isDefault: false } : entry
    )
    if (!nextItems.some((entry) => entry.isDefault) && nextItems.length > 0) {
      nextItems[0] = { ...nextItems[0], isDefault: true }
    }
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, nextItems)
    return { item: nextItems.find((entry) => entry.id === id) || updated }
  }

  async deleteModel(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'models')
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')
    const deleted = items.find((entry) => entry.id === id) || null
    const nextItems = items.filter((entry) => entry.id !== id)
    if (deleted?.isDefault && nextItems.length > 0 && !nextItems.some((entry) => entry.isDefault)) {
      nextItems[0] = { ...nextItems[0], isDefault: true }
    }
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, nextItems)
    const skills = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    if (skills.some((skill) => skill.linkedModelIds.includes(id))) {
      await this.stateStore.writeWorkspaceSkills(
        actor.workspaceId,
        skills.map((skill) =>
          skill.linkedModelIds.includes(id)
            ? { ...skill, linkedModelIds: skill.linkedModelIds.filter((entry) => entry !== id), updatedAt: new Date().toISOString() }
            : skill
        )
      )
    }
    return { ok: true }
  }

  async listModelAccessGrants(actor: Actor, id: string): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertModuleManage(actor, 'models')
    const item = (await this.stateStore.readWorkspaceModels(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    return { items: item.accessGrants }
  }

  async shareModel(
    actor: Actor,
    id: string,
    dto: ShareWorkspaceResourceDto
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertModuleManage(actor, 'models')
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    const grant = await this.shareResource(actor, 'model', id, item.accessGrants, dto)
    item.accessGrants = this.ensureGrantSafeguards(actor.workspaceId, 'model', id, [...item.accessGrants, grant])
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, items)
    return { grant }
  }

  async revokeModelShare(actor: Actor, id: string, grantId: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'models')
    const items = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Model not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    item.accessGrants = this.removeResourceGrant(actor.workspaceId, 'model', id, item.accessGrants, grantId)
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, items)
    return { ok: true }
  }

  async listPrompts(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspacePrompt>> {
    this.assertModuleRead(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const groupIds = await this.resolveActorGroupIds(actor)
    return {
      items: items.filter((item) => this.hasResourcePermission(actor, groupIds, item.accessGrants, 'read'))
    }
  }

  async getPrompt(actor: Actor, id: string): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleRead(actor, 'prompts')
    const item = (await this.stateStore.readWorkspacePrompts(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'read')
    return { item }
  }

  async createPrompt(actor: Actor, dto: CreateWorkspacePromptDto): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const now = new Date().toISOString()
    const id = dto.id?.trim() || `prompt_${randomUUID()}`
    const command = dto.command.trim().startsWith('/') ? dto.command.trim() : `/${slugifySegment(dto.command || dto.title)}`
    if (items.some((entry) => entry.id === id || entry.command === command)) {
      throw new BadRequestException('Prompt id or command already exists')
    }

    const item: OpenPortWorkspacePrompt = {
      id,
      workspaceId: actor.workspaceId,
      title: dto.title.trim(),
      command,
      description: dto.description?.trim() || '',
      content: dto.content ?? '',
      tags: dto.tags?.filter(Boolean) || [],
      visibility: dto.visibility === 'private' ? 'private' : 'workspace',
      productionVersionId: null,
      publishedVersionId: null,
      publishedAt: null,
      communityStatus: 'none',
      communitySubmittedVersionId: null,
      communitySubmittedAt: null,
      communitySubmissionUrl: null,
      communitySubmissionNote: '',
      accessGrants: this.defaultResourceAccessGrants(actor, 'prompt', id),
      createdAt: now,
      updatedAt: now
    }

    const createdItems = [item, ...items]
    await this.stateStore.writeWorkspacePrompts(actor.workspaceId, createdItems)
    const version = await this.appendPromptVersion(actor.workspaceId, item, 'Initial version', dto.commitMessage?.trim() || '')
    const shouldSetProduction = dto.setAsProduction ?? true
    const persisted = shouldSetProduction ? { ...item, productionVersionId: version.id } : item
    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      createdItems.map((entry) => (entry.id === item.id ? persisted : entry))
    )
    return { item: persisted }
  }

  async updatePrompt(actor: Actor, id: string, dto: UpdateWorkspacePromptDto): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')
    const commandSource = dto.command?.trim() || item.command
    const command = commandSource.startsWith('/') ? commandSource : `/${slugifySegment(commandSource)}`

    const updated: OpenPortWorkspacePrompt = {
      ...item,
      title: dto.title?.trim() || item.title,
      command,
      description: dto.description?.trim() ?? item.description,
      content: dto.content ?? item.content,
      tags: dto.tags ? dto.tags.filter(Boolean) : item.tags,
      visibility: dto.visibility === 'private' ? 'private' : dto.visibility === 'workspace' ? 'workspace' : item.visibility,
      updatedAt: new Date().toISOString()
    }

    const version = await this.appendPromptVersion(actor.workspaceId, updated, undefined, dto.commitMessage?.trim() || '')
    const persisted: OpenPortWorkspacePrompt = {
      ...updated,
      productionVersionId: (dto.setAsProduction ?? true) ? version.id : updated.productionVersionId
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? persisted : entry))
    )
    return { item: persisted }
  }

  async deletePrompt(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')
    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.filter((entry) => entry.id !== id)
    )
    const versions = await this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    await this.stateStore.writeWorkspacePromptVersions(
      actor.workspaceId,
      versions.filter((entry) => entry.promptId !== id)
    )
    return { ok: true }
  }

  async listPromptAccessGrants(actor: Actor, id: string): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertModuleManage(actor, 'prompts')
    const item = (await this.stateStore.readWorkspacePrompts(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    return { items: item.accessGrants }
  }

  async sharePrompt(
    actor: Actor,
    id: string,
    dto: ShareWorkspaceResourceDto
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    const grant = await this.shareResource(actor, 'prompt', id, item.accessGrants, dto)
    item.accessGrants = this.ensureGrantSafeguards(actor.workspaceId, 'prompt', id, [...item.accessGrants, grant])
    await this.stateStore.writeWorkspacePrompts(actor.workspaceId, items)
    return { grant }
  }

  async revokePromptShare(actor: Actor, id: string, grantId: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    item.accessGrants = this.removeResourceGrant(actor.workspaceId, 'prompt', id, item.accessGrants, grantId)
    await this.stateStore.writeWorkspacePrompts(actor.workspaceId, items)
    return { ok: true }
  }

  async listPromptVersions(actor: Actor, id: string): Promise<OpenPortWorkspacePromptVersionsResponse> {
    this.assertModuleRead(actor, 'prompts')
    const prompt = (await this.stateStore.readWorkspacePrompts(actor.workspaceId)).find((entry) => entry.id === id)
    if (!prompt) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, prompt.accessGrants, 'read')
    const versions = await this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    return {
      items: versions.filter((entry) => entry.promptId === id).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    }
  }

  async restorePromptVersion(
    actor: Actor,
    id: string,
    versionId: string
  ): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const versions = await this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    const version = versions.find((entry) => entry.id === versionId && entry.promptId === id)
    if (!version) throw new NotFoundException('Prompt version not found')

    const restored: OpenPortWorkspacePrompt = {
      ...item,
      title: version.title,
      command: version.command,
      description: version.description,
      content: version.content,
      tags: version.tags,
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? restored : entry))
    )
    await this.appendPromptVersion(
      actor.workspaceId,
      restored,
      `Restored ${version.versionLabel}`,
      version.commitMessage?.trim() || ''
    )
    return { item: restored }
  }

  async setPromptProductionVersion(
    actor: Actor,
    id: string,
    versionId: string
  ): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const versions = await this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    const version = versions.find((entry) => entry.id === versionId && entry.promptId === id)
    if (!version) throw new NotFoundException('Prompt version not found')

    const updated: OpenPortWorkspacePrompt = {
      ...item,
      productionVersionId: versionId,
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async publishPrompt(
    actor: Actor,
    id: string,
    explicitVersionId?: string
  ): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const [items, versions] = await Promise.all([
      this.stateStore.readWorkspacePrompts(actor.workspaceId),
      this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const targetVersionId =
      explicitVersionId?.trim() ||
      item.productionVersionId ||
      versions
        .filter((entry) => entry.promptId === id)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]?.id

    if (!targetVersionId) {
      throw new BadRequestException('No prompt version available to publish')
    }

    const version = versions.find((entry) => entry.id === targetVersionId && entry.promptId === id)
    if (!version) throw new NotFoundException('Prompt version not found')

    const updated: OpenPortWorkspacePrompt = {
      ...item,
      publishedVersionId: version.id,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async unpublishPrompt(actor: Actor, id: string): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const updated: OpenPortWorkspacePrompt = {
      ...item,
      publishedVersionId: null,
      publishedAt: null,
      communityStatus: 'none',
      communitySubmittedVersionId: null,
      communitySubmittedAt: null,
      communitySubmissionUrl: null,
      communitySubmissionNote: '',
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async submitPromptToCommunity(
    actor: Actor,
    id: string,
    dto: SubmitWorkspacePromptCommunityDto
  ): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const [items, versions] = await Promise.all([
      this.stateStore.readWorkspacePrompts(actor.workspaceId),
      this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const selectedVersionId = this.resolvePromptPublicationVersion(item, versions, dto.versionId)
    if (!selectedVersionId) {
      throw new BadRequestException('No prompt version available for community submission')
    }
    const selectedVersion = versions.find((entry) => entry.id === selectedVersionId && entry.promptId === id)
    if (!selectedVersion) throw new NotFoundException('Prompt version not found')

    const now = new Date().toISOString()
    const status: OpenPortWorkspacePromptCommunityStatus = 'submitted'
    const updated: OpenPortWorkspacePrompt = {
      ...item,
      publishedVersionId: selectedVersion.id,
      publishedAt: item.publishedVersionId === selectedVersion.id ? item.publishedAt : now,
      communityStatus: status,
      communitySubmittedVersionId: selectedVersion.id,
      communitySubmittedAt: now,
      communitySubmissionUrl: dto.submissionUrl?.trim() || null,
      communitySubmissionNote: dto.note?.trim() || '',
      updatedAt: now
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async retractPromptFromCommunity(actor: Actor, id: string): Promise<OpenPortWorkspacePromptResponse> {
    this.assertModuleManage(actor, 'prompts')
    const items = await this.stateStore.readWorkspacePrompts(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const updated: OpenPortWorkspacePrompt = {
      ...item,
      communityStatus: 'none',
      communitySubmittedVersionId: null,
      communitySubmittedAt: null,
      communitySubmissionUrl: null,
      communitySubmissionNote: '',
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePrompts(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async deletePromptVersion(
    actor: Actor,
    id: string,
    versionId: string
  ): Promise<OpenPortWorkspacePromptVersionsResponse> {
    this.assertModuleManage(actor, 'prompts')
    const [items, versions] = await Promise.all([
      this.stateStore.readWorkspacePrompts(actor.workspaceId),
      this.stateStore.readWorkspacePromptVersions(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Prompt not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const version = versions.find((entry) => entry.id === versionId && entry.promptId === id)
    if (!version) throw new NotFoundException('Prompt version not found')
    if (item.productionVersionId === versionId) {
      throw new BadRequestException('Cannot delete the production version')
    }
    if (item.communitySubmittedVersionId === versionId) {
      throw new BadRequestException('Cannot delete the community-submitted version. Retract submission first.')
    }

    const nextVersions = versions.filter((entry) => entry.id !== versionId)
    await this.stateStore.writeWorkspacePromptVersions(actor.workspaceId, nextVersions)
    return {
      items: nextVersions.filter((entry) => entry.promptId === id).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    }
  }

  async listTools(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceTool>> {
    this.assertModuleRead(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const groupIds = await this.resolveActorGroupIds(actor)
    return {
      items: items.filter((item) => this.hasResourcePermission(actor, groupIds, item.accessGrants, 'read'))
    }
  }

  async getTool(actor: Actor, id: string): Promise<OpenPortWorkspaceToolResponse> {
    this.assertModuleRead(actor, 'tools')
    const item = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'read')
    return { item }
  }

  async validateTool(actor: Actor, dto: ValidateWorkspaceToolDto): Promise<OpenPortWorkspaceToolValidationResponse> {
    this.assertModuleManage(actor, 'tools')
    const availableToolIds = new Set((await this.stateStore.readWorkspaceTools(actor.workspaceId)).map((item) => item.id))
    return this.buildToolValidationReport({
      name: dto.name?.trim() || '',
      manifest: dto.manifest ?? '',
      valves: this.normalizeValves(dto.valves),
      valveSchema: this.normalizeValveSchema(dto.valveSchema),
      examples: this.normalizeToolExamples(dto.examples),
      executionChain: this.normalizeToolExecutionChain(dto.executionChain),
      availableToolIds
    })
  }

  async exportToolPackage(actor: Actor, id: string): Promise<OpenPortWorkspaceToolPackageResponse> {
    this.assertModuleRead(actor, 'tools')
    const item = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'read')

    const exportedAt = new Date().toISOString()
    const toolPayload = this.buildToolPackageToolPayload(item)
    const availableToolIds = new Set((await this.stateStore.readWorkspaceTools(actor.workspaceId)).map((entry) => entry.id))
    const validation = this.buildToolValidationReport({
      name: toolPayload.name,
      manifest: toolPayload.manifest,
      valves: toolPayload.valves,
      valveSchema: toolPayload.valveSchema,
      examples: toolPayload.examples,
      executionChain: toolPayload.executionChain,
      availableToolIds
    })

    const pkgWithoutChecksum = {
      metadata: {
        schemaVersion: 1 as const,
        source: 'openport-workspace-tool' as const,
        sourceToolId: item.id,
        sourceWorkspaceId: actor.workspaceId,
        exportedAt
      },
      tool: toolPayload
    }

    const checksum = createHash('sha256').update(JSON.stringify(pkgWithoutChecksum)).digest('hex')
    const toolPackage: OpenPortWorkspaceToolPackage = {
      ...pkgWithoutChecksum,
      metadata: {
        ...pkgWithoutChecksum.metadata,
        checksum
      },
      validation
    }

    return { package: toolPackage }
  }

  async importToolPackage(actor: Actor, dto: ImportWorkspaceToolPackageDto): Promise<OpenPortWorkspaceToolPackageImportResponse> {
    this.assertModuleManage(actor, 'tools')
    const normalized = this.normalizeImportedToolPackage(dto.package)
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const now = new Date().toISOString()
    const availableToolIds = new Set(items.map((entry) => entry.id))

    if (dto.targetToolId?.trim()) {
      const targetId = dto.targetToolId.trim()
      const existing = items.find((entry) => entry.id === targetId)
      if (!existing) throw new NotFoundException('Target tool not found')
      await this.ensureResourcePermission(actor, existing.accessGrants, 'write')

      const updated: OpenPortWorkspaceTool = {
        ...existing,
        ...normalized.tool,
        enabled: dto.forceEnable ? true : normalized.tool.enabled,
        updatedAt: now
      }

      const validation = this.buildToolValidationReport({
        name: updated.name,
        manifest: updated.manifest,
        valves: updated.valves,
        valveSchema: updated.valveSchema,
        examples: updated.examples,
        executionChain: updated.executionChain,
        availableToolIds
      })
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join('; '))
      }

      await this.stateStore.writeWorkspaceTools(
        actor.workspaceId,
        items.map((entry) => (entry.id === targetId ? updated : entry))
      )
      return { item: updated, validation }
    }

    const existingIds = new Set(items.map((entry) => entry.id))
    const preferredId =
      normalized.sourceToolId && !existingIds.has(normalized.sourceToolId)
        ? normalized.sourceToolId
        : `tool_${randomUUID()}`

    const created: OpenPortWorkspaceTool = {
      id: preferredId,
      workspaceId: actor.workspaceId,
      ...normalized.tool,
      enabled: dto.forceEnable ? true : normalized.tool.enabled,
      accessGrants: this.defaultResourceAccessGrants(actor, 'tool', preferredId),
      createdAt: now,
      updatedAt: now
    }

    const validation = this.buildToolValidationReport({
      name: created.name,
      manifest: created.manifest,
      valves: created.valves,
      valveSchema: created.valveSchema,
      examples: created.examples,
      executionChain: created.executionChain,
      availableToolIds
    })
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '))
    }

    await this.stateStore.writeWorkspaceTools(actor.workspaceId, [created, ...items])
    return { item: created, validation }
  }

  async createTool(actor: Actor, dto: CreateWorkspaceToolDto): Promise<OpenPortWorkspaceToolResponse> {
    this.assertModuleManage(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const now = new Date().toISOString()
    const id = dto.id?.trim() || `tool_${randomUUID()}`
    if (items.some((entry) => entry.id === id)) {
      throw new BadRequestException('Tool id already exists')
    }

    const item: OpenPortWorkspaceTool = {
      id,
      workspaceId: actor.workspaceId,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      integrationId: dto.integrationId?.trim() || null,
      enabled: dto.enabled ?? true,
      scopes: dto.scopes?.filter(Boolean) || [],
      tags: dto.tags?.filter(Boolean) || [],
      manifest: dto.manifest ?? '',
      valves: this.normalizeValves(dto.valves),
      valveSchema: this.normalizeValveSchema(dto.valveSchema),
      examples: this.normalizeToolExamples(dto.examples),
      executionChain: this.normalizeToolExecutionChain(dto.executionChain),
      accessGrants: this.defaultResourceAccessGrants(actor, 'tool', id),
      createdAt: now,
      updatedAt: now
    }

    const validation = this.buildToolValidationReport({
      name: item.name,
      manifest: item.manifest,
      valves: item.valves,
      valveSchema: item.valveSchema,
      examples: item.examples,
      executionChain: item.executionChain,
      availableToolIds: new Set(items.map((entry) => entry.id))
    })
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '))
    }

    await this.stateStore.writeWorkspaceTools(actor.workspaceId, [item, ...items])
    return { item }
  }

  async updateTool(actor: Actor, id: string, dto: UpdateWorkspaceToolDto): Promise<OpenPortWorkspaceToolResponse> {
    this.assertModuleManage(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const updated: OpenPortWorkspaceTool = {
      ...item,
      name: dto.name?.trim() || item.name,
      description: dto.description?.trim() ?? item.description,
      integrationId: dto.integrationId === undefined ? item.integrationId : dto.integrationId?.trim() || null,
      enabled: dto.enabled ?? item.enabled,
      scopes: dto.scopes ? dto.scopes.filter(Boolean) : item.scopes,
      tags: dto.tags ? dto.tags.filter(Boolean) : item.tags,
      manifest: dto.manifest ?? item.manifest,
      valves: dto.valves ? this.normalizeValves(dto.valves) : item.valves,
      valveSchema: dto.valveSchema ? this.normalizeValveSchema(dto.valveSchema) : item.valveSchema,
      examples: dto.examples ? this.normalizeToolExamples(dto.examples) : item.examples,
      executionChain: dto.executionChain ? this.normalizeToolExecutionChain(dto.executionChain, item.executionChain) : item.executionChain,
      updatedAt: new Date().toISOString()
    }

    const validation = this.buildToolValidationReport({
      name: updated.name,
      manifest: updated.manifest,
      valves: updated.valves,
      valveSchema: updated.valveSchema,
      examples: updated.examples,
      executionChain: updated.executionChain,
      availableToolIds: new Set(items.map((entry) => entry.id))
    })
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '))
    }

    await this.stateStore.writeWorkspaceTools(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async deleteTool(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')
    await this.stateStore.writeWorkspaceTools(
      actor.workspaceId,
      items.filter((entry) => entry.id !== id)
    )
    const skills = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    if (skills.some((skill) => skill.linkedToolIds.includes(id))) {
      await this.stateStore.writeWorkspaceSkills(
        actor.workspaceId,
        skills.map((skill) =>
          skill.linkedToolIds.includes(id)
            ? { ...skill, linkedToolIds: skill.linkedToolIds.filter((entry) => entry !== id), updatedAt: new Date().toISOString() }
            : skill
        )
      )
    }
    return { ok: true }
  }

  async listToolAccessGrants(actor: Actor, id: string): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertModuleManage(actor, 'tools')
    const item = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    return { items: item.accessGrants }
  }

  async shareTool(
    actor: Actor,
    id: string,
    dto: ShareWorkspaceResourceDto
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertModuleManage(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    const grant = await this.shareResource(actor, 'tool', id, item.accessGrants, dto)
    item.accessGrants = this.ensureGrantSafeguards(actor.workspaceId, 'tool', id, [...item.accessGrants, grant])
    await this.stateStore.writeWorkspaceTools(actor.workspaceId, items)
    return { grant }
  }

  async revokeToolShare(actor: Actor, id: string, grantId: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'tools')
    const items = await this.stateStore.readWorkspaceTools(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    item.accessGrants = this.removeResourceGrant(actor.workspaceId, 'tool', id, item.accessGrants, grantId)
    await this.stateStore.writeWorkspaceTools(actor.workspaceId, items)
    return { ok: true }
  }

  async listSkills(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceSkill>> {
    this.assertModuleRead(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const groupIds = await this.resolveActorGroupIds(actor)
    return {
      items: items.filter((item) => this.hasResourcePermission(actor, groupIds, item.accessGrants, 'read'))
    }
  }

  async getSkill(actor: Actor, id: string): Promise<OpenPortWorkspaceSkillResponse> {
    this.assertModuleRead(actor, 'skills')
    const item = (await this.stateStore.readWorkspaceSkills(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'read')
    return { item }
  }

  async createSkill(actor: Actor, dto: CreateWorkspaceSkillDto): Promise<OpenPortWorkspaceSkillResponse> {
    this.assertModuleManage(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const now = new Date().toISOString()
    const id = dto.id?.trim() || `skill_${randomUUID()}`
    if (items.some((entry) => entry.id === id)) {
      throw new BadRequestException('Skill id already exists')
    }

    const item: OpenPortWorkspaceSkill = {
      id,
      workspaceId: actor.workspaceId,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      content: dto.content ?? '',
      tags: dto.tags?.filter(Boolean) || [],
      enabled: dto.enabled ?? true,
      linkedModelIds: dto.linkedModelIds?.filter(Boolean) || [],
      linkedToolIds: dto.linkedToolIds?.filter(Boolean) || [],
      accessGrants: this.defaultResourceAccessGrants(actor, 'skill', id),
      createdAt: now,
      updatedAt: now
    }

    await this.stateStore.writeWorkspaceSkills(actor.workspaceId, [item, ...items])
    return { item }
  }

  async updateSkill(actor: Actor, id: string, dto: UpdateWorkspaceSkillDto): Promise<OpenPortWorkspaceSkillResponse> {
    this.assertModuleManage(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')

    const updated: OpenPortWorkspaceSkill = {
      ...item,
      name: dto.name?.trim() || item.name,
      description: dto.description?.trim() ?? item.description,
      content: dto.content ?? item.content,
      tags: dto.tags ? dto.tags.filter(Boolean) : item.tags,
      enabled: dto.enabled ?? item.enabled,
      linkedModelIds: dto.linkedModelIds ? dto.linkedModelIds.filter(Boolean) : item.linkedModelIds,
      linkedToolIds: dto.linkedToolIds ? dto.linkedToolIds.filter(Boolean) : item.linkedToolIds,
      updatedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspaceSkills(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async deleteSkill(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'write')
    await this.stateStore.writeWorkspaceSkills(
      actor.workspaceId,
      items.filter((entry) => entry.id !== id)
    )
    return { ok: true }
  }

  async listSkillAccessGrants(actor: Actor, id: string): Promise<OpenPortListResponse<OpenPortWorkspaceResourceGrant>> {
    this.assertModuleManage(actor, 'skills')
    const item = (await this.stateStore.readWorkspaceSkills(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    return { items: item.accessGrants }
  }

  async shareSkill(
    actor: Actor,
    id: string,
    dto: ShareWorkspaceResourceDto
  ): Promise<OpenPortWorkspaceResourceGrantResponse> {
    this.assertModuleManage(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    const grant = await this.shareResource(actor, 'skill', id, item.accessGrants, dto)
    item.accessGrants = this.ensureGrantSafeguards(actor.workspaceId, 'skill', id, [...item.accessGrants, grant])
    await this.stateStore.writeWorkspaceSkills(actor.workspaceId, items)
    return { grant }
  }

  async revokeSkillShare(actor: Actor, id: string, grantId: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'skills')
    const items = await this.stateStore.readWorkspaceSkills(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Skill not found')
    await this.ensureResourcePermission(actor, item.accessGrants, 'admin')
    item.accessGrants = this.removeResourceGrant(actor.workspaceId, 'skill', id, item.accessGrants, grantId)
    await this.stateStore.writeWorkspaceSkills(actor.workspaceId, items)
    return { ok: true }
  }

  async listConnectorCredentials(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorCredential>> {
    this.assertModuleRead(actor, 'knowledge')
    const items = await this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId)
    return { items }
  }

  async createConnectorCredential(
    actor: Actor,
    dto: CreateWorkspaceConnectorCredentialDto
  ): Promise<OpenPortWorkspaceConnectorCredentialResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const items = await this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId)
    const id = dto.id?.trim() || `connector_credential_${randomUUID()}`
    if (items.some((entry) => entry.id === id)) {
      throw new BadRequestException('Connector credential id already exists')
    }
    const now = new Date().toISOString()
    const item: OpenPortWorkspaceConnectorCredential = {
      id,
      workspaceId: actor.workspaceId,
      name: dto.name.trim(),
      provider: this.normalizeConnectorAdapter(dto.provider),
      description: dto.description?.trim() || '',
      fields: this.normalizeCredentialFields(dto.provider, dto.fields, []),
      createdAt: now,
      updatedAt: now
    }
    await this.stateStore.writeWorkspaceConnectorCredentials(actor.workspaceId, [item, ...items])
    return { item }
  }

  async updateConnectorCredential(
    actor: Actor,
    id: string,
    dto: UpdateWorkspaceConnectorCredentialDto
  ): Promise<OpenPortWorkspaceConnectorCredentialResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const items = await this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId)
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Connector credential not found')

    const provider = this.normalizeConnectorAdapter(dto.provider || item.provider)
    const updated: OpenPortWorkspaceConnectorCredential = {
      ...item,
      name: dto.name?.trim() || item.name,
      provider,
      description: dto.description?.trim() ?? item.description,
      fields: dto.fields ? this.normalizeCredentialFields(provider, dto.fields, item.fields) : item.fields,
      updatedAt: new Date().toISOString()
    }
    await this.stateStore.writeWorkspaceConnectorCredentials(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    return { item: updated }
  }

  async deleteConnectorCredential(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'knowledge')
    const [credentials, connectors] = await Promise.all([
      this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId),
      this.stateStore.readWorkspaceConnectors(actor.workspaceId)
    ])
    if (!credentials.some((entry) => entry.id === id)) {
      throw new NotFoundException('Connector credential not found')
    }
    if (connectors.some((connector) => connector.credentialId === id)) {
      throw new BadRequestException('Credential is used by one or more connectors')
    }
    await this.stateStore.writeWorkspaceConnectorCredentials(
      actor.workspaceId,
      credentials.filter((entry) => entry.id !== id)
    )
    return { ok: true }
  }

  async listConnectors(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceConnector>> {
    this.assertModuleRead(actor, 'knowledge')
    const items = await this.stateStore.readWorkspaceConnectors(actor.workspaceId)
    return { items }
  }

  async getConnector(actor: Actor, id: string): Promise<OpenPortWorkspaceConnectorResponse> {
    this.assertModuleRead(actor, 'knowledge')
    const item = (await this.stateStore.readWorkspaceConnectors(actor.workspaceId)).find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Connector not found')
    return { item }
  }

  async createConnector(actor: Actor, dto: CreateWorkspaceConnectorDto): Promise<OpenPortWorkspaceConnectorResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const [items, credentials] = await Promise.all([
      this.stateStore.readWorkspaceConnectors(actor.workspaceId),
      this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId)
    ])
    const id = dto.id?.trim() || `connector_${randomUUID()}`
    if (items.some((entry) => entry.id === id)) {
      throw new BadRequestException('Connector id already exists')
    }
    const adapter = this.normalizeConnectorAdapter(dto.adapter)
    const credentialId = dto.credentialId?.trim() || null
    if (credentialId && !credentials.some((entry) => entry.id === credentialId)) {
      throw new BadRequestException('Connector credential not found')
    }
    const now = new Date().toISOString()
    const schedule = this.normalizeConnectorSchedule(dto.schedule)
    const item: OpenPortWorkspaceConnector = {
      id,
      workspaceId: actor.workspaceId,
      name: dto.name.trim(),
      adapter,
      description: dto.description?.trim() || '',
      enabled: dto.enabled ?? true,
      credentialId,
      tags: this.normalizeStringList(dto.tags),
      schedule,
      syncPolicy: this.normalizeConnectorSyncPolicy(dto.syncPolicy),
      sourceConfig: this.normalizeConnectorSourceConfig(dto.sourceConfig),
      status: {
        health: 'idle',
        lastRunAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastTaskId: null,
        lastErrorMessage: null
      },
      createdAt: now,
      updatedAt: now
    }
    await this.stateStore.writeWorkspaceConnectors(actor.workspaceId, [item, ...items])
    await this.appendConnectorAuditEvent(actor.workspaceId, {
      connectorId: item.id,
      taskId: null,
      level: 'info',
      action: 'connector.created',
      message: `Connector "${item.name}" created.`,
      detail: JSON.stringify({ adapter: item.adapter })
    })
    return { item }
  }

  async updateConnector(
    actor: Actor,
    id: string,
    dto: UpdateWorkspaceConnectorDto
  ): Promise<OpenPortWorkspaceConnectorResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const [items, credentials] = await Promise.all([
      this.stateStore.readWorkspaceConnectors(actor.workspaceId),
      this.stateStore.readWorkspaceConnectorCredentials(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Connector not found')

    const credentialId = dto.credentialId === undefined ? item.credentialId : dto.credentialId?.trim() || null
    if (credentialId && !credentials.some((entry) => entry.id === credentialId)) {
      throw new BadRequestException('Connector credential not found')
    }

    const updated: OpenPortWorkspaceConnector = {
      ...item,
      name: dto.name?.trim() || item.name,
      adapter: this.normalizeConnectorAdapter(dto.adapter || item.adapter),
      description: dto.description?.trim() ?? item.description,
      enabled: dto.enabled ?? item.enabled,
      credentialId,
      tags: dto.tags ? this.normalizeStringList(dto.tags) : item.tags,
      schedule: dto.schedule ? this.normalizeConnectorSchedule(dto.schedule, item.schedule) : item.schedule,
      syncPolicy: dto.syncPolicy ? this.normalizeConnectorSyncPolicy(dto.syncPolicy, item.syncPolicy) : item.syncPolicy,
      sourceConfig: dto.sourceConfig ? this.normalizeConnectorSourceConfig(dto.sourceConfig, item.sourceConfig) : item.sourceConfig,
      updatedAt: new Date().toISOString()
    }
    await this.stateStore.writeWorkspaceConnectors(
      actor.workspaceId,
      items.map((entry) => (entry.id === id ? updated : entry))
    )
    await this.appendConnectorAuditEvent(actor.workspaceId, {
      connectorId: id,
      taskId: null,
      level: 'info',
      action: 'connector.updated',
      message: `Connector "${updated.name}" updated.`,
      detail: JSON.stringify({ adapter: updated.adapter })
    })
    return { item: updated }
  }

  async deleteConnector(actor: Actor, id: string): Promise<{ ok: true }> {
    this.assertModuleManage(actor, 'knowledge')
    const [items, tasks, audits] = await Promise.all([
      this.stateStore.readWorkspaceConnectors(actor.workspaceId),
      this.stateStore.readWorkspaceConnectorTasks(actor.workspaceId),
      this.stateStore.readWorkspaceConnectorAuditEvents(actor.workspaceId)
    ])
    const item = items.find((entry) => entry.id === id)
    if (!item) throw new NotFoundException('Connector not found')
    await this.stateStore.writeWorkspaceConnectors(
      actor.workspaceId,
      items.filter((entry) => entry.id !== id)
    )
    await this.stateStore.writeWorkspaceConnectorTasks(
      actor.workspaceId,
      tasks.filter((entry) => entry.connectorId !== id)
    )
    await this.stateStore.writeWorkspaceConnectorAuditEvents(
      actor.workspaceId,
      audits.filter((entry) => entry.connectorId !== id)
    )
    return { ok: true }
  }

  async triggerConnectorSync(
    actor: Actor,
    id: string,
    dto: TriggerWorkspaceConnectorSyncDto
  ): Promise<OpenPortWorkspaceConnectorTaskResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const connector = (await this.stateStore.readWorkspaceConnectors(actor.workspaceId)).find((entry) => entry.id === id)
    if (!connector) throw new NotFoundException('Connector not found')
    const mode: OpenPortWorkspaceConnectorSyncMode = dto.mode === 'full' ? 'full' : dto.mode === 'incremental' ? 'incremental' : connector.schedule.incremental ? 'incremental' : 'full'
    const task = await this.enqueueConnectorTask(actor.workspaceId, connector, {
      trigger: 'manual',
      mode,
      attempt: 1,
      maxAttempts: Math.max(1, connector.syncPolicy.maxRetries + 1),
      scheduledAt: new Date().toISOString(),
      retryOfTaskId: null
    })
    void this.runConnectorQueueTick()
    return { item: task }
  }

  async listConnectorTasks(actor: Actor, connectorId: string): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorTask>> {
    this.assertModuleRead(actor, 'knowledge')
    const connector = (await this.stateStore.readWorkspaceConnectors(actor.workspaceId)).find((entry) => entry.id === connectorId)
    if (!connector) throw new NotFoundException('Connector not found')
    const items = await this.stateStore.readWorkspaceConnectorTasks(actor.workspaceId)
    return {
      items: items
        .filter((entry) => entry.connectorId === connectorId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
  }

  async getConnectorTask(actor: Actor, taskId: string): Promise<OpenPortWorkspaceConnectorTaskResponse> {
    this.assertModuleRead(actor, 'knowledge')
    const task = (await this.stateStore.readWorkspaceConnectorTasks(actor.workspaceId)).find((entry) => entry.id === taskId)
    if (!task) throw new NotFoundException('Connector task not found')
    return { item: task }
  }

  async retryConnectorTask(actor: Actor, taskId: string): Promise<OpenPortWorkspaceConnectorTaskResponse> {
    this.assertModuleManage(actor, 'knowledge')
    const [tasks, connectors] = await Promise.all([
      this.stateStore.readWorkspaceConnectorTasks(actor.workspaceId),
      this.stateStore.readWorkspaceConnectors(actor.workspaceId)
    ])
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) throw new NotFoundException('Connector task not found')
    const connector = connectors.find((entry) => entry.id === task.connectorId)
    if (!connector) throw new NotFoundException('Connector not found')
    const nextAttempt = Math.min(task.maxAttempts, task.attempt + 1)
    const queued = await this.enqueueConnectorTask(actor.workspaceId, connector, {
      trigger: 'retry',
      mode: task.mode,
      attempt: nextAttempt,
      maxAttempts: task.maxAttempts,
      scheduledAt: new Date().toISOString(),
      retryOfTaskId: task.id
    })
    void this.runConnectorQueueTick()
    return { item: queued }
  }

  async listConnectorAudit(actor: Actor, connectorId: string): Promise<OpenPortListResponse<OpenPortWorkspaceConnectorAuditEvent>> {
    this.assertModuleRead(actor, 'knowledge')
    const connector = (await this.stateStore.readWorkspaceConnectors(actor.workspaceId)).find((entry) => entry.id === connectorId)
    if (!connector) throw new NotFoundException('Connector not found')
    const items = await this.stateStore.readWorkspaceConnectorAuditEvents(actor.workspaceId)
    return {
      items: items
        .filter((entry) => entry.connectorId === connectorId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
  }

  async runToolOrchestration(
    actor: Actor,
    id: string,
    dto: RunWorkspaceToolOrchestrationDto
  ): Promise<OpenPortWorkspaceToolRunResponse> {
    this.assertModuleManage(actor, 'tools')
    const tool = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!tool) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, tool.accessGrants, 'read')

    const run = await this.enqueueToolRun(actor.workspaceId, tool, {
      trigger: 'manual',
      replayOfRunId: null,
      debug: Boolean(dto.debug),
      inputPayload: dto.inputPayload ?? '',
      stepLimit: dto.stepLimit
    })
    void this.runToolQueueTick()
    return { item: run }
  }

  async listToolOrchestrationRuns(actor: Actor, id: string): Promise<OpenPortListResponse<OpenPortWorkspaceToolRun>> {
    this.assertModuleRead(actor, 'tools')
    const tool = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!tool) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, tool.accessGrants, 'read')
    const items = await this.stateStore.readWorkspaceToolRuns(actor.workspaceId)
    return {
      items: items
        .filter((entry) => entry.toolId === id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
  }

  async getToolOrchestrationRun(actor: Actor, id: string, runId: string): Promise<OpenPortWorkspaceToolRunResponse> {
    this.assertModuleRead(actor, 'tools')
    const tool = (await this.stateStore.readWorkspaceTools(actor.workspaceId)).find((entry) => entry.id === id)
    if (!tool) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, tool.accessGrants, 'read')
    const run = (await this.stateStore.readWorkspaceToolRuns(actor.workspaceId)).find(
      (entry) => entry.id === runId && entry.toolId === id
    )
    if (!run) throw new NotFoundException('Tool orchestration run not found')
    return { item: run }
  }

  async replayToolOrchestrationRun(
    actor: Actor,
    id: string,
    runId: string,
    dto: ReplayWorkspaceToolOrchestrationRunDto
  ): Promise<OpenPortWorkspaceToolRunResponse> {
    this.assertModuleManage(actor, 'tools')
    const [tools, runs] = await Promise.all([
      this.stateStore.readWorkspaceTools(actor.workspaceId),
      this.stateStore.readWorkspaceToolRuns(actor.workspaceId)
    ])
    const tool = tools.find((entry) => entry.id === id)
    if (!tool) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, tool.accessGrants, 'read')
    const sourceRun = runs.find((entry) => entry.id === runId && entry.toolId === id)
    if (!sourceRun) throw new NotFoundException('Tool orchestration run not found')

    const run = await this.enqueueToolRun(actor.workspaceId, tool, {
      trigger: 'replay',
      replayOfRunId: sourceRun.id,
      debug: dto.debug ?? sourceRun.debug,
      inputPayload: dto.inputPayload ?? sourceRun.inputPayload,
      stepLimit: undefined
    })
    void this.runToolQueueTick()
    return { item: run }
  }

  async cancelToolOrchestrationRun(actor: Actor, id: string, runId: string): Promise<OpenPortWorkspaceToolRunResponse> {
    this.assertModuleManage(actor, 'tools')
    const [tools, runs] = await Promise.all([
      this.stateStore.readWorkspaceTools(actor.workspaceId),
      this.stateStore.readWorkspaceToolRuns(actor.workspaceId)
    ])
    const tool = tools.find((entry) => entry.id === id)
    if (!tool) throw new NotFoundException('Tool not found')
    await this.ensureResourcePermission(actor, tool.accessGrants, 'read')
    const run = runs.find((entry) => entry.id === runId && entry.toolId === id)
    if (!run) throw new NotFoundException('Tool orchestration run not found')
    if (run.status !== 'queued' && run.status !== 'running') {
      return { item: run }
    }
    const updated: OpenPortWorkspaceToolRun = {
      ...run,
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await this.stateStore.writeWorkspaceToolRuns(
      actor.workspaceId,
      runs.map((entry) => (entry.id === runId ? updated : entry))
    )
    return { item: updated }
  }

  private normalizeConnectorAdapter(input: string): OpenPortWorkspaceConnectorAdapter {
    if (input === 'web' || input === 's3' || input === 'github' || input === 'notion' || input === 'rss') {
      return input
    }
    return 'directory'
  }

  private maskCredentialValue(value: string, secret: boolean): string {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (secret) {
      if (trimmed.length <= 4) return '****'
      return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
    }
    if (trimmed.length <= 8) return trimmed
    return `${trimmed.slice(0, 8)}…`
  }

  private connectorCredentialTemplate(
    provider: OpenPortWorkspaceConnectorAdapter
  ): Array<{ key: string; label: string; secret: boolean }> {
    if (provider === 's3') {
      return [
        { key: 'accessKeyId', label: 'Access key id', secret: false },
        { key: 'secretAccessKey', label: 'Secret access key', secret: true },
        { key: 'region', label: 'Region', secret: false }
      ]
    }
    if (provider === 'github') {
      return [{ key: 'token', label: 'GitHub token', secret: true }]
    }
    if (provider === 'notion') {
      return [{ key: 'token', label: 'Notion token', secret: true }]
    }
    if (provider === 'rss') {
      return [{ key: 'apiKey', label: 'Feed auth token', secret: true }]
    }
    if (provider === 'web') {
      return [{ key: 'bearerToken', label: 'Bearer token', secret: true }]
    }
    return [{ key: 'localAccess', label: 'Local access confirmation', secret: false }]
  }

  private normalizeCredentialFields(
    providerInput: string,
    input: Array<{ key?: string; label?: string; secret?: boolean; value?: string }>,
    existing: OpenPortWorkspaceConnectorCredential['fields']
  ): OpenPortWorkspaceConnectorCredential['fields'] {
    const provider = this.normalizeConnectorAdapter(providerInput)
    const template = this.connectorCredentialTemplate(provider)
    const existingByKey = new Map(existing.map((field) => [field.key, field] as const))
    const inputByKey = new Map(
      (Array.isArray(input) ? input : [])
        .map((field) => ({
          key: field.key?.trim() || '',
          label: field.label?.trim() || '',
          secret: Boolean(field.secret),
          value: field.value?.trim() || ''
        }))
        .filter((field) => field.key.length > 0)
        .map((field) => [field.key, field] as const)
    )

    const allKeys = new Set<string>([
      ...template.map((field) => field.key),
      ...existing.map((field) => field.key),
      ...Array.from(inputByKey.keys())
    ])

    return Array.from(allKeys).map((key) => {
      const templateField = template.find((field) => field.key === key)
      const existingField = existingByKey.get(key)
      const inputField = inputByKey.get(key)
      const secret = inputField?.secret ?? templateField?.secret ?? existingField?.secret ?? true
      const rawValue = inputField?.value || ''
      const configured = rawValue.length > 0 ? true : existingField?.configured ?? false
      const valuePreview = rawValue.length > 0 ? this.maskCredentialValue(rawValue, secret) : existingField?.valuePreview || ''
      return {
        key,
        label: inputField?.label || templateField?.label || existingField?.label || key,
        secret,
        configured,
        valuePreview
      }
    })
  }

  private normalizeConnectorSchedule(
    input: {
      enabled?: boolean
      intervalMinutes?: number
      timezone?: string
      incremental?: boolean
    } | undefined,
    existing?: OpenPortWorkspaceConnector['schedule']
  ): OpenPortWorkspaceConnector['schedule'] {
    const base = existing || {
      enabled: false,
      intervalMinutes: 60,
      timezone: 'UTC',
      incremental: true,
      nextRunAt: null
    }
    const enabled = input?.enabled ?? base.enabled
    const intervalMinutes = Math.max(
      5,
      Math.min(7 * 24 * 60, Number(input?.intervalMinutes ?? (base.intervalMinutes || 60)))
    )
    const nextRunAt =
      enabled && (!base.nextRunAt || !existing || (input?.enabled === true && existing.enabled === false))
        ? new Date(Date.now() + intervalMinutes * 60_000).toISOString()
        : enabled
          ? base.nextRunAt
          : null
    return {
      enabled,
      intervalMinutes,
      timezone: input?.timezone?.trim() || base.timezone || 'UTC',
      incremental: input?.incremental ?? base.incremental,
      nextRunAt
    }
  }

  private normalizeConnectorSyncPolicy(
    input:
      | {
          autoRetry?: boolean
          maxRetries?: number
          retryBackoffSeconds?: number
          maxDocumentsPerRun?: number
        }
      | undefined,
    existing?: OpenPortWorkspaceConnector['syncPolicy']
  ): OpenPortWorkspaceConnector['syncPolicy'] {
    const base = existing || {
      autoRetry: true,
      maxRetries: 3,
      retryBackoffSeconds: 30,
      maxDocumentsPerRun: 500
    }
    return {
      autoRetry: input?.autoRetry ?? base.autoRetry,
      maxRetries: Math.max(0, Math.min(10, Number(input?.maxRetries ?? (base.maxRetries || 0)))),
      retryBackoffSeconds: Math.max(
        5,
        Math.min(3600, Number(input?.retryBackoffSeconds ?? (base.retryBackoffSeconds || 30)))
      ),
      maxDocumentsPerRun: Math.max(
        10,
        Math.min(10_000, Number(input?.maxDocumentsPerRun ?? (base.maxDocumentsPerRun || 500)))
      )
    }
  }

  private normalizeConnectorSourceConfig(
    input:
      | {
          directoryPath?: string
          urls?: string[]
          bucket?: string
          prefix?: string
          repository?: string
          branch?: string
          notionDatabaseId?: string
          rssFeedUrls?: string[]
          includePatterns?: string[]
          excludePatterns?: string[]
        }
      | undefined,
    existing?: OpenPortWorkspaceConnector['sourceConfig']
  ): OpenPortWorkspaceConnector['sourceConfig'] {
    const base = existing || {
      directoryPath: '',
      urls: [],
      bucket: '',
      prefix: '',
      repository: '',
      branch: 'main',
      notionDatabaseId: '',
      rssFeedUrls: [],
      includePatterns: [],
      excludePatterns: []
    }
    return {
      directoryPath: input?.directoryPath?.trim() ?? base.directoryPath,
      urls: this.normalizeStringList(input?.urls ?? base.urls),
      bucket: input?.bucket?.trim() ?? base.bucket,
      prefix: input?.prefix?.trim() ?? base.prefix,
      repository: input?.repository?.trim() ?? base.repository,
      branch: input?.branch?.trim() || base.branch || 'main',
      notionDatabaseId: input?.notionDatabaseId?.trim() ?? base.notionDatabaseId,
      rssFeedUrls: this.normalizeStringList(input?.rssFeedUrls ?? base.rssFeedUrls),
      includePatterns: this.normalizeStringList(input?.includePatterns ?? base.includePatterns),
      excludePatterns: this.normalizeStringList(input?.excludePatterns ?? base.excludePatterns)
    }
  }

  private async appendConnectorAuditEvent(
    workspaceId: string,
    input: {
      connectorId: string
      taskId: string | null
      level: OpenPortWorkspaceConnectorAuditEvent['level']
      action: string
      message: string
      detail?: string
    }
  ): Promise<void> {
    const audits = await this.stateStore.readWorkspaceConnectorAuditEvents(workspaceId)
    const item: OpenPortWorkspaceConnectorAuditEvent = {
      id: `connector_audit_${randomUUID()}`,
      workspaceId,
      connectorId: input.connectorId,
      taskId: input.taskId,
      level: input.level,
      action: input.action,
      message: input.message,
      detail: input.detail || '',
      createdAt: new Date().toISOString()
    }
    await this.stateStore.writeWorkspaceConnectorAuditEvents(workspaceId, [item, ...audits].slice(0, 1000))
  }

  private async enqueueConnectorTask(
    workspaceId: string,
    connector: OpenPortWorkspaceConnector,
    input: {
      trigger: OpenPortWorkspaceConnectorTask['trigger']
      mode: OpenPortWorkspaceConnectorSyncMode
      attempt: number
      maxAttempts: number
      scheduledAt: string
      retryOfTaskId: string | null
    }
  ): Promise<OpenPortWorkspaceConnectorTask> {
    const tasks = await this.stateStore.readWorkspaceConnectorTasks(workspaceId)
    const now = new Date().toISOString()
    const item: OpenPortWorkspaceConnectorTask = {
      id: `connector_task_${randomUUID()}`,
      workspaceId,
      connectorId: connector.id,
      trigger: input.trigger,
      mode: input.mode,
      status: 'queued',
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      scheduledAt: input.scheduledAt,
      startedAt: null,
      finishedAt: null,
      retryOfTaskId: input.retryOfTaskId,
      nextRetryAt: null,
      errorMessage: null,
      summary: {
        scanned: 0,
        created: 0,
        updated: 0,
        removed: 0,
        errors: 0
      },
      createdAt: now,
      updatedAt: now
    }
    await this.stateStore.writeWorkspaceConnectorTasks(workspaceId, [item, ...tasks].slice(0, 1000))
    await this.appendConnectorAuditEvent(workspaceId, {
      connectorId: connector.id,
      taskId: item.id,
      level: 'info',
      action: 'task.queued',
      message: `Sync task queued (${item.trigger}/${item.mode}).`,
      detail: JSON.stringify({ attempt: item.attempt, maxAttempts: item.maxAttempts })
    })
    return item
  }

  private estimateConnectorScanCount(connector: OpenPortWorkspaceConnector, mode: OpenPortWorkspaceConnectorSyncMode): number {
    const base =
      connector.adapter === 'directory'
        ? 80
        : connector.adapter === 'web'
          ? 40
          : connector.adapter === 's3'
            ? 120
            : connector.adapter === 'github'
              ? 90
              : connector.adapter === 'notion'
                ? 60
                : 30
    const incrementalFactor = mode === 'incremental' ? 0.35 : 1
    return Math.max(1, Math.round(base * incrementalFactor))
  }

  private resolveConnectorReadinessError(
    connector: OpenPortWorkspaceConnector,
    credentials: OpenPortWorkspaceConnectorCredential[]
  ): string | null {
    if (!connector.enabled) {
      return 'Connector is disabled.'
    }
    if (connector.adapter === 'directory' && !connector.sourceConfig.directoryPath.trim()) {
      return 'Directory connector requires sourceConfig.directoryPath.'
    }
    if (connector.adapter === 'web' && connector.sourceConfig.urls.length === 0) {
      return 'Web connector requires at least one source URL.'
    }
    if (connector.adapter === 's3' && (!connector.sourceConfig.bucket.trim() || !connector.sourceConfig.prefix.trim())) {
      return 'S3 connector requires bucket and prefix.'
    }
    if (connector.adapter === 'github' && !connector.sourceConfig.repository.trim()) {
      return 'GitHub connector requires repository.'
    }
    if (connector.adapter === 'notion' && !connector.sourceConfig.notionDatabaseId.trim()) {
      return 'Notion connector requires notionDatabaseId.'
    }
    if (connector.adapter === 'rss' && connector.sourceConfig.rssFeedUrls.length === 0) {
      return 'RSS connector requires at least one feed URL.'
    }
    if (connector.credentialId) {
      const credential = credentials.find((entry) => entry.id === connector.credentialId)
      if (!credential) {
        return 'Connector credential was not found.'
      }
      if (credential.fields.some((field) => field.secret && !field.configured)) {
        return 'Connector credential has missing secret fields.'
      }
    }
    return null
  }

  private async runConnectorSchedulerTick(): Promise<void> {
    const workspaceIds = await this.stateStore.listWorkspaceIdsWithConnectors()
    const now = new Date()
    for (const workspaceId of workspaceIds) {
      const connectors = await this.stateStore.readWorkspaceConnectors(workspaceId)
      const dueConnectors = connectors.filter(
        (connector) =>
          connector.enabled &&
          connector.schedule.enabled &&
          connector.schedule.nextRunAt &&
          new Date(connector.schedule.nextRunAt).getTime() <= now.getTime()
      )
      if (dueConnectors.length === 0) continue

      for (const connector of dueConnectors) {
        await this.enqueueConnectorTask(workspaceId, connector, {
          trigger: 'schedule',
          mode: connector.schedule.incremental ? 'incremental' : 'full',
          attempt: 1,
          maxAttempts: Math.max(1, connector.syncPolicy.maxRetries + 1),
          scheduledAt: now.toISOString(),
          retryOfTaskId: null
        })
      }

      await this.stateStore.writeWorkspaceConnectors(
        workspaceId,
        connectors.map((connector) => {
          if (!dueConnectors.some((entry) => entry.id === connector.id)) return connector
          return {
            ...connector,
            schedule: {
              ...connector.schedule,
              nextRunAt: new Date(now.getTime() + connector.schedule.intervalMinutes * 60_000).toISOString()
            },
            updatedAt: now.toISOString()
          }
        })
      )
    }
  }

  private async runConnectorQueueTick(): Promise<void> {
    if (this.connectorRunner) return
    this.connectorRunner = (async () => {
      while (true) {
        const workspaceIds = await this.stateStore.listWorkspaceIdsWithConnectorTasks()
        let target: { workspaceId: string; task: OpenPortWorkspaceConnectorTask } | null = null
        for (const workspaceId of workspaceIds) {
          const tasks = await this.stateStore.readWorkspaceConnectorTasks(workspaceId)
          const dueTask = tasks
            .filter((task) => task.status === 'queued' && new Date(task.scheduledAt).getTime() <= Date.now())
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
          if (!dueTask) continue
          if (!target || dueTask.createdAt < target.task.createdAt) {
            target = { workspaceId, task: dueTask }
          }
        }
        if (!target) {
          return
        }
        await this.executeConnectorTask(target.workspaceId, target.task.id)
      }
    })().finally(() => {
      this.connectorRunner = null
    })
    await this.connectorRunner
  }

  private async executeConnectorTask(workspaceId: string, taskId: string): Promise<void> {
    const [tasks, connectors, credentials] = await Promise.all([
      this.stateStore.readWorkspaceConnectorTasks(workspaceId),
      this.stateStore.readWorkspaceConnectors(workspaceId),
      this.stateStore.readWorkspaceConnectorCredentials(workspaceId)
    ])
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task || task.status !== 'queued') return
    const connector = connectors.find((entry) => entry.id === task.connectorId)
    if (!connector) return

    const startedAt = new Date().toISOString()
    const runningTask: OpenPortWorkspaceConnectorTask = {
      ...task,
      status: 'running',
      startedAt,
      updatedAt: startedAt
    }
    await this.stateStore.writeWorkspaceConnectorTasks(
      workspaceId,
      tasks.map((entry) => (entry.id === taskId ? runningTask : entry))
    )
    await this.appendConnectorAuditEvent(workspaceId, {
      connectorId: connector.id,
      taskId,
      level: 'info',
      action: 'task.started',
      message: `Sync task started for connector "${connector.name}".`
    })

    const readinessError = this.resolveConnectorReadinessError(connector, credentials)
    if (readinessError) {
      const failedAt = new Date().toISOString()
      const failedTask: OpenPortWorkspaceConnectorTask = {
        ...runningTask,
        status: 'failed',
        finishedAt: failedAt,
        errorMessage: readinessError,
        summary: { ...runningTask.summary, errors: Math.max(1, runningTask.summary.errors) },
        updatedAt: failedAt
      }
      const nextTasks = tasks.map((entry) => (entry.id === taskId ? failedTask : entry))
      await this.stateStore.writeWorkspaceConnectorTasks(workspaceId, nextTasks)
      await this.stateStore.writeWorkspaceConnectors(
        workspaceId,
        connectors.map((entry) =>
          entry.id === connector.id
            ? {
                ...entry,
                status: {
                  ...entry.status,
                  health: 'error',
                  lastRunAt: failedAt,
                  lastFailureAt: failedAt,
                  lastTaskId: taskId,
                  lastErrorMessage: readinessError
                },
                updatedAt: failedAt
              }
            : entry
        )
      )
      await this.appendConnectorAuditEvent(workspaceId, {
        connectorId: connector.id,
        taskId,
        level: 'error',
        action: 'task.failed',
        message: readinessError
      })
      if (connector.syncPolicy.autoRetry && task.attempt < task.maxAttempts) {
        const retryDelaySeconds = connector.syncPolicy.retryBackoffSeconds * task.attempt
        const scheduledAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
        await this.enqueueConnectorTask(workspaceId, connector, {
          trigger: 'retry',
          mode: task.mode,
          attempt: task.attempt + 1,
          maxAttempts: task.maxAttempts,
          scheduledAt,
          retryOfTaskId: task.id
        })
      }
      return
    }

    const scanned = Math.min(connector.syncPolicy.maxDocumentsPerRun, this.estimateConnectorScanCount(connector, task.mode))
    const created = Math.max(1, Math.round(scanned * (task.mode === 'full' ? 0.45 : 0.2)))
    const updated = Math.max(0, Math.round(scanned * 0.22))
    const removed = task.mode === 'incremental' ? Math.round(scanned * 0.08) : Math.round(scanned * 0.04)
    const finishedAt = new Date().toISOString()
    const successTask: OpenPortWorkspaceConnectorTask = {
      ...runningTask,
      status: 'success',
      finishedAt,
      errorMessage: null,
      summary: {
        scanned,
        created,
        updated,
        removed,
        errors: 0
      },
      updatedAt: finishedAt
    }
    await this.stateStore.writeWorkspaceConnectorTasks(
      workspaceId,
      tasks.map((entry) => (entry.id === taskId ? successTask : entry))
    )
    await this.stateStore.writeWorkspaceConnectors(
      workspaceId,
      connectors.map((entry) =>
        entry.id === connector.id
          ? {
              ...entry,
              status: {
                ...entry.status,
                health: 'ok',
                lastRunAt: finishedAt,
                lastSuccessAt: finishedAt,
                lastTaskId: taskId,
                lastErrorMessage: null
              },
              updatedAt: finishedAt
            }
          : entry
      )
    )
    await this.appendConnectorAuditEvent(workspaceId, {
      connectorId: connector.id,
      taskId,
      level: 'info',
      action: 'task.completed',
      message: 'Sync task completed successfully.',
      detail: JSON.stringify(successTask.summary)
    })
  }

  private async enqueueToolRun(
    workspaceId: string,
    tool: OpenPortWorkspaceTool,
    input: {
      trigger: OpenPortWorkspaceToolRun['trigger']
      replayOfRunId: string | null
      debug: boolean
      inputPayload: string
      stepLimit?: number
    }
  ): Promise<OpenPortWorkspaceToolRun> {
    const tools = await this.stateStore.readWorkspaceTools(workspaceId)
    const toolNameById = new Map(tools.map((entry) => [entry.id, entry.name] as const))
    const limitedSteps =
      typeof input.stepLimit === 'number' && input.stepLimit > 0
        ? tool.executionChain.steps.slice(0, Math.floor(input.stepLimit))
        : tool.executionChain.steps
    const steps: OpenPortWorkspaceToolRun['steps'] = limitedSteps.map((step, index) => ({
      id: `tool_run_step_${randomUUID()}`,
      chainStepId: step.id,
      toolId: step.toolId,
      toolName: toolNameById.get(step.toolId) || step.toolId,
      mode: step.mode,
      when: step.when,
      condition: step.condition,
      conditionMatched: false,
      branchPath: `step-${index + 1}`,
      outputKey: step.outputKey,
      status: 'pending',
      inputSnapshot: '',
      outputSnapshot: '',
      errorMessage: null,
      startedAt: null,
      finishedAt: null
    }))
    const now = new Date().toISOString()
    const run: OpenPortWorkspaceToolRun = {
      id: `tool_run_${randomUUID()}`,
      workspaceId,
      toolId: tool.id,
      trigger: input.trigger,
      status: 'queued',
      debug: input.debug,
      replayOfRunId: input.replayOfRunId,
      inputPayload: input.inputPayload,
      outputPayload: '',
      errorMessage: null,
      steps,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    }
    const runs = await this.stateStore.readWorkspaceToolRuns(workspaceId)
    await this.stateStore.writeWorkspaceToolRuns(workspaceId, [run, ...runs].slice(0, 1000))
    return run
  }

  private evaluateStepCondition(
    condition: string,
    context: {
      inputPayload: string
      previousError: string | null
      previousOutput: string
    }
  ): boolean {
    const trimmed = condition.trim()
    if (!trimmed) return true
    if (trimmed === 'prev_error') return Boolean(context.previousError)
    if (trimmed === 'prev_success') return !context.previousError
    if (trimmed.startsWith('contains:')) {
      const expected = trimmed.slice('contains:'.length).trim()
      if (!expected) return true
      return context.inputPayload.toLowerCase().includes(expected.toLowerCase())
    }
    if (trimmed.startsWith('output_contains:')) {
      const expected = trimmed.slice('output_contains:'.length).trim()
      if (!expected) return true
      return context.previousOutput.toLowerCase().includes(expected.toLowerCase())
    }
    return true
  }

  private async runToolQueueTick(): Promise<void> {
    if (this.toolRunner) return
    this.toolRunner = (async () => {
      while (true) {
        const workspaceIds = await this.stateStore.listWorkspaceIdsWithToolRuns()
        let target: { workspaceId: string; run: OpenPortWorkspaceToolRun } | null = null
        for (const workspaceId of workspaceIds) {
          const runs = await this.stateStore.readWorkspaceToolRuns(workspaceId)
          const run = runs
            .filter((entry) => entry.status === 'queued')
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
          if (!run) continue
          if (!target || run.createdAt < target.run.createdAt) {
            target = { workspaceId, run }
          }
        }
        if (!target) {
          return
        }
        await this.executeToolRun(target.workspaceId, target.run.id)
      }
    })().finally(() => {
      this.toolRunner = null
    })
    await this.toolRunner
  }

  private async executeToolRun(workspaceId: string, runId: string): Promise<void> {
    const [runs, tools] = await Promise.all([
      this.stateStore.readWorkspaceToolRuns(workspaceId),
      this.stateStore.readWorkspaceTools(workspaceId)
    ])
    const run = runs.find((entry) => entry.id === runId)
    if (!run || run.status !== 'queued') return
    const tool = tools.find((entry) => entry.id === run.toolId)
    if (!tool) {
      const failed: OpenPortWorkspaceToolRun = {
        ...run,
        status: 'failed',
        errorMessage: 'Tool not found.',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await this.stateStore.writeWorkspaceToolRuns(
        workspaceId,
        runs.map((entry) => (entry.id === runId ? failed : entry))
      )
      return
    }

    let previousError: string | null = null
    let previousOutput = ''
    let hasFailure = false
    const startedAt = new Date().toISOString()
    const stepRuns = run.steps.map((step) => ({ ...step }))
    const running: OpenPortWorkspaceToolRun = {
      ...run,
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      steps: stepRuns
    }
    await this.stateStore.writeWorkspaceToolRuns(
      workspaceId,
      runs.map((entry) => (entry.id === runId ? running : entry))
    )

    for (let index = 0; index < stepRuns.length; index += 1) {
      const step = stepRuns[index]
      const whenAllowed =
        step.when === 'always' ||
        (step.when === 'on_success' && !hasFailure) ||
        (step.when === 'on_error' && hasFailure)
      const conditionMatched = whenAllowed && this.evaluateStepCondition(step.condition, {
        inputPayload: run.inputPayload,
        previousError,
        previousOutput
      })
      if (!conditionMatched) {
        stepRuns[index] = {
          ...step,
          conditionMatched: false,
          status: 'skipped',
          branchPath: `step-${index + 1}:skip`,
          startedAt: null,
          finishedAt: new Date().toISOString()
        }
        continue
      }

      const stepStart = new Date().toISOString()
      const triggerFailure = step.condition.toLowerCase().includes('force_fail')
      const outputPayload = JSON.stringify(
        {
          step: index + 1,
          toolId: step.toolId,
          mode: step.mode,
          outputKey: step.outputKey || `step_${index + 1}`,
          debug: run.debug
        },
        null,
        2
      )

      if (triggerFailure) {
        hasFailure = true
        previousError = `Step ${index + 1} forced failure by condition.`
        stepRuns[index] = {
          ...step,
          conditionMatched: true,
          status: 'failed',
          branchPath: `step-${index + 1}:failed`,
          inputSnapshot: run.inputPayload,
          outputSnapshot: '',
          errorMessage: previousError,
          startedAt: stepStart,
          finishedAt: new Date().toISOString()
        }
        if (step.mode !== 'fallback') {
          break
        }
      } else {
        previousOutput = outputPayload
        previousError = null
        stepRuns[index] = {
          ...step,
          conditionMatched: true,
          status: 'success',
          branchPath: `step-${index + 1}:${step.mode}`,
          inputSnapshot: run.inputPayload,
          outputSnapshot: outputPayload,
          errorMessage: null,
          startedAt: stepStart,
          finishedAt: new Date().toISOString()
        }
      }
    }

    const finishedAt = new Date().toISOString()
    const status: OpenPortWorkspaceToolRun['status'] = hasFailure ? 'failed' : 'success'
    const outputPayload = JSON.stringify(
      {
        toolId: tool.id,
        toolName: tool.name,
        status,
        executedSteps: stepRuns.filter((step) => step.status === 'success').length,
        skippedSteps: stepRuns.filter((step) => step.status === 'skipped').length,
        failedSteps: stepRuns.filter((step) => step.status === 'failed').length
      },
      null,
      2
    )
    const completed: OpenPortWorkspaceToolRun = {
      ...running,
      status,
      outputPayload,
      errorMessage: hasFailure ? (previousError || 'Execution failed.') : null,
      steps: stepRuns,
      finishedAt,
      updatedAt: finishedAt
    }
    await this.stateStore.writeWorkspaceToolRuns(
      workspaceId,
      runs.map((entry) => (entry.id === runId ? completed : entry))
    )
  }

  private defaultResourceAccessGrants(
    actor: Actor,
    resourceType: OpenPortWorkspaceResourceType,
    resourceId: string
  ): OpenPortWorkspaceResourceGrant[] {
    return this.ensureGrantSafeguards(actor.workspaceId, resourceType, resourceId, [
      this.buildResourceGrant({
        workspaceId: actor.workspaceId,
        resourceType,
        resourceId,
        principalType: 'workspace',
        principalId: actor.workspaceId,
        permission: 'admin'
      }),
      this.buildResourceGrant({
        workspaceId: actor.workspaceId,
        resourceType,
        resourceId,
        principalType: 'user',
        principalId: actor.userId,
        permission: 'admin'
      })
    ])
  }

  private buildResourceGrant(input: {
    workspaceId: string
    resourceType: OpenPortWorkspaceResourceType
    resourceId: string
    principalType: OpenPortWorkspaceResourcePrincipalType
    principalId: string
    permission: OpenPortWorkspaceResourcePermission
  }): OpenPortWorkspaceResourceGrant {
    return {
      id: `workspace_resource_grant_${randomUUID()}`,
      workspaceId: input.workspaceId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      principalType: input.principalType,
      principalId: input.principalType === 'public' ? '*' : input.principalId,
      permission: input.permission,
      createdAt: new Date().toISOString()
    }
  }

  private ensureGrantSafeguards(
    workspaceId: string,
    resourceType: OpenPortWorkspaceResourceType,
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[]
  ): OpenPortWorkspaceResourceGrant[] {
    const normalized = new Map<string, OpenPortWorkspaceResourceGrant>()

    grants.forEach((grant) => {
      const principalType: OpenPortWorkspaceResourcePrincipalType =
        grant.principalType === 'workspace' || grant.principalType === 'group' || grant.principalType === 'public'
          ? grant.principalType
          : 'user'
      const principalId =
        principalType === 'workspace'
          ? workspaceId
          : principalType === 'public'
            ? '*'
            : grant.principalId?.trim() || ''
      if (!principalId) {
        return
      }

      const permission: OpenPortWorkspaceResourcePermission =
        grant.permission === 'admin' || grant.permission === 'write' ? grant.permission : 'read'

      const key = `${principalType}:${principalId}`
      normalized.set(key, {
        id: grant.id || `workspace_resource_grant_${randomUUID()}`,
        workspaceId,
        resourceType,
        resourceId,
        principalType,
        principalId,
        permission,
        createdAt: grant.createdAt || new Date().toISOString()
      })
    })

    const workspaceKey = `workspace:${workspaceId}`
    const workspaceGrant = normalized.get(workspaceKey)
    if (!workspaceGrant) {
      normalized.set(workspaceKey, this.buildResourceGrant({
        workspaceId,
        resourceType,
        resourceId,
        principalType: 'workspace',
        principalId: workspaceId,
        permission: 'admin'
      }))
    } else if (rankResourcePermission(workspaceGrant.permission) < rankResourcePermission('admin')) {
      workspaceGrant.permission = 'admin'
      normalized.set(workspaceKey, workspaceGrant)
    }

    return Array.from(normalized.values())
  }

  private removeResourceGrant(
    workspaceId: string,
    resourceType: OpenPortWorkspaceResourceType,
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[],
    grantId: string
  ): OpenPortWorkspaceResourceGrant[] {
    return this.ensureGrantSafeguards(
      workspaceId,
      resourceType,
      resourceId,
      grants.filter((grant) => grant.id !== grantId)
    )
  }

  private async shareResource(
    actor: Actor,
    resourceType: OpenPortWorkspaceResourceType,
    resourceId: string,
    grants: OpenPortWorkspaceResourceGrant[],
    dto: ShareWorkspaceResourceDto
  ): Promise<OpenPortWorkspaceResourceGrant> {
    const principalType = dto.principalType
    const principalId =
      principalType === 'workspace'
        ? dto.principalId?.trim() || actor.workspaceId
        : principalType === 'public'
          ? '*'
          : dto.principalId?.trim() || ''

    if (!principalId) {
      throw new BadRequestException('principalId is required')
    }
    if (principalType === 'group') {
      await this.groups.requireGroup(actor, principalId)
    }

    const existing = grants.find(
      (grant) => grant.principalType === principalType && grant.principalId === principalId
    )
    if (existing) {
      return {
        ...existing,
        permission: dto.permission
      }
    }

    return this.buildResourceGrant({
      workspaceId: actor.workspaceId,
      resourceType,
      resourceId,
      principalType,
      principalId,
      permission: dto.permission
    })
  }

  private async ensureResourcePermission(
    actor: Actor,
    grants: OpenPortWorkspaceResourceGrant[],
    required: OpenPortWorkspaceResourcePermission
  ): Promise<void> {
    const groupIds = await this.resolveActorGroupIds(actor)
    if (!this.hasResourcePermission(actor, groupIds, grants, required)) {
      throw new ForbiddenException(`${required} access required`)
    }
  }

  private hasResourcePermission(
    actor: Actor,
    groupIds: Set<string>,
    grants: OpenPortWorkspaceResourceGrant[],
    required: OpenPortWorkspaceResourcePermission
  ): boolean {
    const resolved = this.resolveResourcePermission(actor, groupIds, grants)
    return Boolean(resolved && rankResourcePermission(resolved) >= rankResourcePermission(required))
  }

  private resolveResourcePermission(
    actor: Actor,
    groupIds: Set<string>,
    grants: OpenPortWorkspaceResourceGrant[]
  ): OpenPortWorkspaceResourcePermission | null {
    if (!Array.isArray(grants) || grants.length === 0) {
      return null
    }

    const matched: OpenPortWorkspaceResourcePermission[] = []
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
    return matched.sort((left, right) => rankResourcePermission(right) - rankResourcePermission(left))[0] || null
  }

  private async resolveActorGroupIds(actor: Actor): Promise<Set<string>> {
    const groups = await this.groups.listGroupsForUser(actor.workspaceId, actor.userId)
    return new Set(groups.map((group) => group.id))
  }

  private assertModuleRead(actor: Actor, module: 'models' | 'knowledge' | 'prompts' | 'tools' | 'skills'): void {
    this.workspaces.assertWorkspaceModuleAccess(actor.userId, actor.workspaceId, module, 'read')
  }

  private assertModuleManage(actor: Actor, module: 'models' | 'knowledge' | 'prompts' | 'tools' | 'skills'): void {
    this.workspaces.assertWorkspaceModuleAccess(actor.userId, actor.workspaceId, module, 'manage')
  }

  private async ensureDefaultModel(actor: Actor): Promise<OpenPortWorkspaceModel> {
    const now = new Date().toISOString()
    const item: OpenPortWorkspaceModel = {
      id: 'model_openport_local',
      workspaceId: actor.workspaceId,
      name: 'OpenPort Local',
      route: 'openport/local',
      provider: 'openport',
      description: 'Default local route for self-hosted chat.',
      tags: ['default'],
      status: 'active',
      isDefault: true,
      filterIds: [],
      defaultFilterIds: [],
      actionIds: [],
      defaultFeatureIds: [],
      capabilities: {
        vision: false,
        webSearch: false,
        imageGeneration: false,
        codeInterpreter: false
      },
      knowledgeItemIds: [],
      toolIds: [],
      builtinToolIds: [],
      skillIds: [],
      promptSuggestions: [],
      accessGrants: this.defaultResourceAccessGrants(actor, 'model', 'model_openport_local'),
      createdAt: now,
      updatedAt: now
    }
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, [item])
    return item
  }

  private normalizeValves(input: Record<string, string> | undefined | null): Record<string, string> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {}
    }

    return Object.entries(input).reduce<Record<string, string>>((result, [key, value]) => {
      const normalizedKey = key.trim()
      if (!normalizedKey || typeof value !== 'string') return result
      result[normalizedKey] = value
      return result
    }, {})
  }

  private normalizeValveSchema(
    input:
      | Array<{
          id?: string
          key?: string
          label?: string
          type?: 'string' | 'number' | 'boolean' | 'json'
          description?: string
          defaultValue?: string
          required?: boolean
        }>
      | undefined
      | null
  ): OpenPortWorkspaceToolValveSchemaField[] {
    if (!Array.isArray(input)) {
      return []
    }

    return input
      .map((field, index) => ({
        id: field.id?.trim() || `valve_schema_${index}_${randomUUID()}`,
        key: field.key?.trim() || '',
        label: field.label?.trim() || '',
        type:
          field.type === 'number' || field.type === 'boolean' || field.type === 'json' || field.type === 'string'
            ? field.type
            : 'string',
        description: field.description?.trim() || '',
        defaultValue: field.defaultValue?.trim() || '',
        required: Boolean(field.required)
      }))
      .filter((field) => field.key.length > 0)
  }

  private normalizeToolExamples(
    input:
      | Array<{
          id?: string
          name?: string
          input?: string
          output?: string
        }>
      | undefined
      | null
  ): OpenPortWorkspaceTool['examples'] {
    if (!Array.isArray(input)) {
      return []
    }

    return input
      .map((example, index) => ({
        id: example.id?.trim() || `tool_example_${randomUUID()}`,
        name: example.name?.trim() || `Example ${index + 1}`,
        input: example.input ?? '',
        output: example.output ?? ''
      }))
      .filter((example) => example.name.length > 0)
  }

  private normalizeToolExecutionChain(
    input:
      | {
          enabled?: boolean
          steps?: Array<{
            id?: string
            toolId?: string
            mode?: 'sequential' | 'parallel' | 'fallback'
            when?: 'always' | 'on_success' | 'on_error'
            condition?: string
            outputKey?: string
          }>
        }
      | undefined
      | null,
    existing?: OpenPortWorkspaceToolExecutionChain
  ): OpenPortWorkspaceToolExecutionChain {
    const fallback = existing || { enabled: false, steps: [] }
    if (!input || typeof input !== 'object') {
      return fallback
    }

    const steps = Array.isArray(input.steps)
      ? input.steps
          .map((step, index) => {
            const mode: OpenPortWorkspaceToolExecutionChain['steps'][number]['mode'] =
              step?.mode === 'parallel' || step?.mode === 'fallback' ? step.mode : 'sequential'
            const when: OpenPortWorkspaceToolExecutionChain['steps'][number]['when'] =
              step?.when === 'on_success' || step?.when === 'on_error' ? step.when : 'always'
            return {
              id: step?.id?.trim() || `tool_chain_step_${index}_${randomUUID()}`,
              toolId: step?.toolId?.trim() || '',
              mode,
              when,
              condition: step?.condition?.trim() || '',
              outputKey: step?.outputKey?.trim() || ''
            }
          })
          .filter((step) => step.toolId.length > 0)
      : fallback.steps

    return {
      enabled: input.enabled ?? fallback.enabled,
      steps
    }
  }

  private normalizeImportedToolPackage(
    input: Record<string, unknown>
  ): {
    sourceToolId: string | null
    tool: OpenPortWorkspaceToolPackage['tool']
  } {
    const packageRecord = this.unwrapPackageRecord(input)
    const metadataRecord =
      packageRecord.metadata && typeof packageRecord.metadata === 'object' && !Array.isArray(packageRecord.metadata)
        ? (packageRecord.metadata as Record<string, unknown>)
        : {}
    const toolRecord =
      packageRecord.tool && typeof packageRecord.tool === 'object' && !Array.isArray(packageRecord.tool)
        ? (packageRecord.tool as Record<string, unknown>)
        : null

    if (!toolRecord) {
      throw new BadRequestException('Tool package payload must contain "tool".')
    }

    const name = typeof toolRecord.name === 'string' ? toolRecord.name.trim() : ''
    if (!name) {
      throw new BadRequestException('Tool package "tool.name" is required.')
    }

    const valvesInput =
      toolRecord.valves && typeof toolRecord.valves === 'object' && !Array.isArray(toolRecord.valves)
        ? Object.entries(toolRecord.valves as Record<string, unknown>).reduce<Record<string, string>>((result, [key, value]) => {
            if (typeof value !== 'string') return result
            result[key] = value
            return result
          }, {})
        : undefined

    const valveSchemaInput = Array.isArray(toolRecord.valveSchema)
      ? toolRecord.valveSchema.map((field) => {
          const schemaField =
            field && typeof field === 'object' && !Array.isArray(field)
              ? (field as Record<string, unknown>)
              : {}
          const schemaType =
            schemaField.type === 'number'
              ? 'number'
              : schemaField.type === 'boolean'
                ? 'boolean'
                : schemaField.type === 'json'
                  ? 'json'
                  : 'string'
          return {
            id: typeof schemaField.id === 'string' ? schemaField.id : undefined,
            key: typeof schemaField.key === 'string' ? schemaField.key : undefined,
            label: typeof schemaField.label === 'string' ? schemaField.label : undefined,
            type: schemaType as 'string' | 'number' | 'boolean' | 'json',
            description: typeof schemaField.description === 'string' ? schemaField.description : undefined,
            defaultValue: typeof schemaField.defaultValue === 'string' ? schemaField.defaultValue : undefined,
            required: Boolean(schemaField.required)
          }
        })
      : undefined

    const examplesInput = Array.isArray(toolRecord.examples)
      ? toolRecord.examples.map((example) => {
          const exampleRecord =
            example && typeof example === 'object' && !Array.isArray(example)
              ? (example as Record<string, unknown>)
              : {}
          return {
            id: typeof exampleRecord.id === 'string' ? exampleRecord.id : undefined,
            name: typeof exampleRecord.name === 'string' ? exampleRecord.name : undefined,
            input: typeof exampleRecord.input === 'string' ? exampleRecord.input : undefined,
            output: typeof exampleRecord.output === 'string' ? exampleRecord.output : undefined
          }
        })
      : undefined

    const executionChainRecord =
      toolRecord.executionChain && typeof toolRecord.executionChain === 'object' && !Array.isArray(toolRecord.executionChain)
        ? (toolRecord.executionChain as Record<string, unknown>)
        : null
    const executionChainInput = executionChainRecord
      ? {
          enabled: Boolean(executionChainRecord.enabled),
          steps: Array.isArray(executionChainRecord.steps)
            ? executionChainRecord.steps.map((step) => {
                const stepRecord =
                  step && typeof step === 'object' && !Array.isArray(step)
                    ? (step as Record<string, unknown>)
                    : {}
                const mode: OpenPortWorkspaceToolExecutionChain['steps'][number]['mode'] =
                  stepRecord.mode === 'parallel'
                    ? 'parallel'
                    : stepRecord.mode === 'fallback'
                      ? 'fallback'
                      : 'sequential'
                const when: OpenPortWorkspaceToolExecutionChain['steps'][number]['when'] =
                  stepRecord.when === 'on_success'
                    ? 'on_success'
                    : stepRecord.when === 'on_error'
                      ? 'on_error'
                      : 'always'
                return {
                  id: typeof stepRecord.id === 'string' ? stepRecord.id : undefined,
                  toolId: typeof stepRecord.toolId === 'string' ? stepRecord.toolId : undefined,
                  mode,
                  when,
                  condition: typeof stepRecord.condition === 'string' ? stepRecord.condition : undefined,
                  outputKey: typeof stepRecord.outputKey === 'string' ? stepRecord.outputKey : undefined
                }
              })
            : undefined
        }
      : undefined

    const tool: OpenPortWorkspaceToolPackage['tool'] = {
      name,
      description: typeof toolRecord.description === 'string' ? toolRecord.description.trim() : '',
      integrationId: typeof toolRecord.integrationId === 'string' ? toolRecord.integrationId.trim() || null : null,
      enabled: typeof toolRecord.enabled === 'boolean' ? toolRecord.enabled : true,
      scopes: this.normalizeStringList(toolRecord.scopes),
      tags: this.normalizeStringList(toolRecord.tags),
      manifest: typeof toolRecord.manifest === 'string' ? toolRecord.manifest : '',
      valves: this.normalizeValves(valvesInput),
      valveSchema: this.normalizeValveSchema(valveSchemaInput),
      examples: this.normalizeToolExamples(examplesInput),
      executionChain: this.normalizeToolExecutionChain(executionChainInput)
    }

    return {
      sourceToolId:
        typeof metadataRecord.sourceToolId === 'string' && metadataRecord.sourceToolId.trim()
          ? metadataRecord.sourceToolId.trim()
          : null,
      tool
    }
  }

  private unwrapPackageRecord(input: Record<string, unknown>): Record<string, unknown> {
    if (
      input.package &&
      typeof input.package === 'object' &&
      !Array.isArray(input.package)
    ) {
      return input.package as Record<string, unknown>
    }
    return input
  }

  private normalizeStringList(input: unknown): string[] {
    if (!Array.isArray(input)) {
      return []
    }

    return input
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
  }

  private buildToolPackageToolPayload(item: OpenPortWorkspaceTool): OpenPortWorkspaceToolPackage['tool'] {
    return {
      name: item.name,
      description: item.description,
      integrationId: item.integrationId,
      enabled: item.enabled,
      scopes: [...item.scopes],
      tags: [...item.tags],
      manifest: item.manifest,
      valves: { ...item.valves },
      valveSchema: item.valveSchema.map((field) => ({ ...field })),
      examples: item.examples.map((example) => ({ ...example })),
      executionChain: {
        enabled: item.executionChain.enabled,
        steps: item.executionChain.steps.map((step) => ({ ...step }))
      }
    }
  }

  private buildToolValidationReport(input: {
    name: string
    manifest: string
    valves: Record<string, string>
    valveSchema: OpenPortWorkspaceToolValveSchemaField[]
    examples: OpenPortWorkspaceTool['examples']
    executionChain: OpenPortWorkspaceToolExecutionChain
    availableToolIds?: Set<string>
  }): OpenPortWorkspaceToolValidationResponse {
    const errors: string[] = []
    const warnings: string[] = []
    const name = input.name.trim()
    if (!name) {
      errors.push('Tool name is required.')
    }

    const manifest = input.manifest.trim()
    const parsedManifest: Record<string, string> = {}
    if (!manifest) {
      errors.push('Manifest body is required.')
    } else {
      const seenKeys = new Set<string>()
      manifest.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const separator = trimmed.indexOf(':')
        if (separator <= 0) return
        const key = trimmed.slice(0, separator).trim()
        const value = trimmed.slice(separator + 1).trim()
        if (!key) return
        if (seenKeys.has(key)) {
          warnings.push(`Manifest key "${key}" is duplicated. Last value wins.`)
        }
        seenKeys.add(key)
        parsedManifest[key] = value
      })
      if (!parsedManifest.name) {
        errors.push('Manifest must contain "name: <value>".')
      }
      if (!parsedManifest.entry) {
        errors.push('Manifest must contain "entry: <value>".')
      }
    }

    const schemaKeys = input.valveSchema.map((field) => field.key.trim()).filter(Boolean)
    const duplicateSchemaKeys = schemaKeys.filter((key, index) => schemaKeys.indexOf(key) !== index)
    if (duplicateSchemaKeys.length > 0) {
      errors.push(`Duplicate schema keys: ${Array.from(new Set(duplicateSchemaKeys)).join(', ')}`)
    }

    const schemaByKey = new Map(input.valveSchema.map((field) => [field.key.trim(), field] as const))
    const missingRequired: string[] = []
    input.valveSchema.forEach((field) => {
      const key = field.key.trim()
      if (!key || !field.required) return
      const runtimeValue = input.valves[key]
      const defaultValue = field.defaultValue.trim()
      if (!runtimeValue?.trim() && !defaultValue) {
        missingRequired.push(key)
      }
    })
    if (missingRequired.length > 0) {
      warnings.push(`Required schema fields without value/default: ${missingRequired.join(', ')}`)
    }

    const unknownValves = Object.keys(input.valves).filter((key) => !schemaByKey.has(key))
    if (unknownValves.length > 0) {
      warnings.push(`Runtime valves not declared in schema: ${unknownValves.join(', ')}`)
    }

    input.valveSchema.forEach((field) => {
      const key = field.key.trim()
      if (!key) return
      const value = (input.valves[key] ?? field.defaultValue ?? '').trim()
      if (!value) return
      if (field.type === 'number' && Number.isNaN(Number(value))) {
        warnings.push(`Valve "${key}" expects number, got "${value}".`)
      }
      if (field.type === 'boolean' && !['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        warnings.push(`Valve "${key}" expects boolean(true/false/1/0), got "${value}".`)
      }
      if (field.type === 'json') {
        try {
          JSON.parse(value)
        } catch {
          warnings.push(`Valve "${key}" expects valid JSON.`)
        }
      }
    })

    if (input.examples.length === 0) {
      warnings.push('No runtime examples defined.')
    }

    const chainStepIds = input.executionChain.steps.map((step) => step.id.trim()).filter(Boolean)
    const duplicateStepIds = chainStepIds.filter((id, index) => chainStepIds.indexOf(id) !== index)
    if (duplicateStepIds.length > 0) {
      errors.push(`Duplicate execution chain step ids: ${Array.from(new Set(duplicateStepIds)).join(', ')}`)
    }

    if (input.executionChain.enabled && input.executionChain.steps.length === 0) {
      warnings.push('Execution chain is enabled, but no steps are configured.')
    }

    const unknownToolsInChain = input.executionChain.steps
      .map((step) => step.toolId.trim())
      .filter((toolId) => Boolean(toolId) && input.availableToolIds && !input.availableToolIds.has(toolId))
    if (unknownToolsInChain.length > 0) {
      warnings.push(`Execution chain references unknown tools: ${Array.from(new Set(unknownToolsInChain)).join(', ')}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsedManifest,
      schemaCoverage: {
        schemaFields: input.valveSchema.length,
        requiredFields: input.valveSchema.filter((field) => field.required).length,
        fieldsWithDefaults: input.valveSchema.filter((field) => field.defaultValue.trim().length > 0).length,
        valvesBound: Object.keys(input.valves).length,
        missingRequired,
        unknownValves
      }
    }
  }

  private async appendPromptVersion(
    workspaceId: string,
    prompt: OpenPortWorkspacePrompt,
    versionLabel?: string,
    commitMessage?: string
  ): Promise<OpenPortWorkspacePromptVersion> {
    const versions = await this.stateStore.readWorkspacePromptVersions(workspaceId)
    const promptVersions = versions.filter((entry) => entry.promptId === prompt.id)
    const item: OpenPortWorkspacePromptVersion = {
      id: `prompt_version_${randomUUID()}`,
      promptId: prompt.id,
      workspaceId,
      title: prompt.title,
      command: prompt.command,
      description: prompt.description,
      content: prompt.content,
      tags: prompt.tags,
      versionLabel: versionLabel || `Version ${promptVersions.length + 1}`,
      commitMessage: commitMessage?.trim() || '',
      savedAt: new Date().toISOString()
    }

    await this.stateStore.writeWorkspacePromptVersions(workspaceId, [item, ...versions])
    return item
  }

  private resolvePromptPublicationVersion(
    item: OpenPortWorkspacePrompt,
    versions: OpenPortWorkspacePromptVersion[],
    explicitVersionId?: string
  ): string | null {
    if (explicitVersionId?.trim()) {
      return explicitVersionId.trim()
    }
    if (item.publishedVersionId?.trim()) {
      return item.publishedVersionId
    }
    if (item.productionVersionId?.trim()) {
      return item.productionVersionId
    }

    return versions
      .filter((entry) => entry.promptId === item.id)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]?.id || null
  }
}
