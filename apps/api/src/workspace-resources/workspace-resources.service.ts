import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  OpenPortListResponse,
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
import type { CreateWorkspaceSkillDto } from './dto/create-workspace-skill.dto.js'
import type { UpdateWorkspaceSkillDto } from './dto/update-workspace-skill.dto.js'
import type { ShareWorkspaceResourceDto } from './dto/share-workspace-resource.dto.js'

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
export class WorkspaceResourcesService {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly groups: GroupsService,
    private readonly stateStore: ApiStateStoreService
  ) {}

  async listModels(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceModel>> {
    this.assertModuleRead(actor, 'models')
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
