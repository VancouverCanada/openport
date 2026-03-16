import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  OpenPortListResponse,
  OpenPortWorkspaceGroup,
  OpenPortWorkspaceGroupResponse
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

type Actor = {
  userId: string
  workspaceId: string
}

type GroupInput = {
  name?: string
  description?: string
  memberUserIds?: string[]
}

function normalizeName(value: string | undefined): string {
  return (value || '').trim().replace(/\s+/g, ' ')
}

function normalizeMemberIds(values: string[] | undefined, fallbackUserId: string): string[] {
  const seen = new Set<string>()
  const items = [...(values || []), fallbackUserId]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })

  return items
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly stateStore: ApiStateStoreService,
    private readonly workspaces: WorkspacesService
  ) {}

  async list(actor: Actor): Promise<OpenPortListResponse<OpenPortWorkspaceGroup>> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const items = await this.stateStore.readWorkspaceGroups(actor.workspaceId)
    return { items: items.sort((left, right) => left.name.localeCompare(right.name)) }
  }

  async get(actor: Actor, groupId: string): Promise<OpenPortWorkspaceGroupResponse> {
    return { item: await this.requireGroup(actor, groupId) }
  }

  async create(actor: Actor, input: GroupInput): Promise<OpenPortWorkspaceGroupResponse> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const name = normalizeName(input.name)
    if (!name) {
      throw new BadRequestException('Group name cannot be empty')
    }

    const items = await this.stateStore.readWorkspaceGroups(actor.workspaceId)
    const now = new Date().toISOString()
    const item: OpenPortWorkspaceGroup = {
      id: `group_${randomUUID()}`,
      workspaceId: actor.workspaceId,
      name,
      description: (input.description || '').trim(),
      memberUserIds: normalizeMemberIds(input.memberUserIds, actor.userId),
      createdAt: now,
      updatedAt: now
    }

    item.memberUserIds.forEach((memberUserId) => {
      this.workspaces.ensureWorkspaceMember(actor.workspaceId, memberUserId)
    })
    await this.stateStore.writeWorkspaceGroups(actor.workspaceId, [item, ...items])
    return { item }
  }

  async update(actor: Actor, groupId: string, input: GroupInput): Promise<OpenPortWorkspaceGroupResponse> {
    const items = await this.stateStore.readWorkspaceGroups(actor.workspaceId)
    const item = await this.requireGroup(actor, groupId, items)
    const next: OpenPortWorkspaceGroup = {
      ...item,
      name: normalizeName(input.name) || item.name,
      description: input.description === undefined ? item.description : input.description.trim(),
      memberUserIds:
        input.memberUserIds === undefined ? item.memberUserIds : normalizeMemberIds(input.memberUserIds, actor.userId),
      updatedAt: new Date().toISOString()
    }

    next.memberUserIds.forEach((memberUserId) => {
      this.workspaces.ensureWorkspaceMember(actor.workspaceId, memberUserId)
    })
    await this.stateStore.writeWorkspaceGroups(
      actor.workspaceId,
      items.map((entry) => (entry.id === groupId ? next : entry))
    )
    return { item: next }
  }

  async remove(actor: Actor, groupId: string): Promise<{ ok: true }> {
    const items = await this.stateStore.readWorkspaceGroups(actor.workspaceId)
    await this.requireGroup(actor, groupId, items)
    await this.stateStore.writeWorkspaceGroups(
      actor.workspaceId,
      items.filter((entry) => entry.id !== groupId)
    )
    return { ok: true }
  }

  async listGroupsForUser(workspaceId: string, userId: string): Promise<OpenPortWorkspaceGroup[]> {
    const groups = await this.stateStore.readWorkspaceGroups(workspaceId)
    return groups.filter((group) => group.memberUserIds.includes(userId))
  }

  async requireGroup(actor: Actor, groupId: string, groups?: OpenPortWorkspaceGroup[]): Promise<OpenPortWorkspaceGroup> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const item = (groups || (await this.stateStore.readWorkspaceGroups(actor.workspaceId))).find((entry) => entry.id === groupId)
    if (!item) {
      throw new NotFoundException('Group not found')
    }
    return item
  }
}
