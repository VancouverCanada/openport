import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common'
import type {
  OpenPortWorkspaceDeleteResponse,
  OpenPortListResponse,
  OpenPortWorkspaceCapabilityPolicy,
  OpenPortWorkspaceCapabilityPolicyResponse,
  OpenPortWorkspaceCapabilityRole,
  OpenPortWorkspace,
  OpenPortWorkspaceCreateResponse,
  OpenPortWorkspaceInvite,
  OpenPortWorkspaceInviteResponse,
  OpenPortWorkspaceMember,
  OpenPortWorkspaceMemberResponse,
  OpenPortWorkspaceMemberRole,
  OpenPortWorkspaceModuleCapabilities,
  OpenPortWorkspaceModulePermissions,
  OpenPortWorkspaceResourceCapabilities,
  OpenPortWorkspaceUpdateResponse
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { IdentityStateService } from '../storage/identity-state.service.js'
import { AddMemberDto } from './dto/add-member.dto.js'
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js'
import type { InviteMemberDto } from './dto/invite-member.dto.js'

type WorkspaceRecord = {
  id: string
  ownerUserId: string
  name: string
  slug: string
  createdAt: string
}

type WorkspaceMember = {
  id: string
  workspaceId: string
  userId: string
  role: OpenPortWorkspaceMemberRole
  createdAt: string
}

type WorkspaceInvite = {
  id: string
  workspaceId: string
  email: string
  role: string
  status: 'pending'
  createdAt: string
}

type WorkspaceCapabilityPolicyChange = {
  role: OpenPortWorkspaceCapabilityRole
  module: keyof OpenPortWorkspaceResourceCapabilities
  action: keyof OpenPortWorkspaceModuleCapabilities
  enabled: boolean
}

const CAPABILITY_MODULES: Array<keyof OpenPortWorkspaceResourceCapabilities> = [
  'models',
  'knowledge',
  'prompts',
  'tools',
  'skills',
  'access'
]

const CAPABILITY_ACTIONS: Array<keyof OpenPortWorkspaceModuleCapabilities> = [
  'read',
  'manage',
  'import',
  'export',
  'publish',
  'share',
  'validate'
]

@Injectable()
export class WorkspacesService implements OnModuleInit {
  constructor(private readonly identityStore: IdentityStateService) {}

  private readonly workspaces = new Map<string, WorkspaceRecord>()
  private readonly members = new Map<string, WorkspaceMember[]>()
  private readonly invites = new Map<string, WorkspaceInvite[]>()
  private readonly capabilityPolicies = new Map<string, OpenPortWorkspaceCapabilityPolicy>()

  onModuleInit(): void {
    this.workspaces.clear()
    this.members.clear()
    this.invites.clear()
    this.capabilityPolicies.clear()

    this.identityStore.readWorkspaces().forEach((workspace) => {
      this.workspaces.set(workspace.id, {
        id: workspace.id,
        ownerUserId: workspace.ownerUserId,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt
      })
    })

    this.identityStore.readMembers().forEach((member) => {
      const workspaceMembers = this.members.get(member.workspaceId) || []
      workspaceMembers.push({
        ...member,
        role: this.normalizeMemberRole(member.role)
      })
      this.members.set(member.workspaceId, workspaceMembers)
    })

    this.identityStore.readInvites().forEach((invite) => {
      const workspaceInvites = this.invites.get(invite.workspaceId) || []
      workspaceInvites.push(invite)
      this.invites.set(invite.workspaceId, workspaceInvites)
    })

    this.identityStore.readCapabilityPolicies().forEach((policy) => {
      this.capabilityPolicies.set(policy.workspaceId, this.normalizeCapabilityPolicy(policy))
    })
  }

  listForUser(userId: string): OpenPortListResponse<OpenPortWorkspace> {
    this.ensureSeedWorkspace(userId)
    const items = [...this.workspaces.values()].filter((workspace) =>
      (this.members.get(workspace.id) || []).some((member) => member.userId === userId)
    )

    return { items }
  }

  create(userId: string, dto: CreateWorkspaceDto): OpenPortWorkspaceCreateResponse {
    const id = `ws_${randomUUID()}`
    const workspace: WorkspaceRecord = {
      id,
      ownerUserId: userId,
      name: dto.name.trim(),
      slug: this.normalizeWorkspaceSlug(dto.slug || dto.name),
      createdAt: new Date().toISOString()
    }
    this.workspaces.set(id, workspace)
    this.members.set(id, [{
      id: `wsm_${randomUUID()}`,
      workspaceId: id,
      userId,
      role: 'owner',
      createdAt: workspace.createdAt
    }])
    this.invites.set(id, [])
    this.capabilityPolicies.set(id, this.buildDefaultCapabilityPolicy(id))
    this.persistAll()
    return { workspace }
  }

  update(userId: string, workspaceId: string, input: { name?: string; slug?: string }): OpenPortWorkspaceUpdateResponse {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      throw new ForbiddenException('Workspace not found or access denied')
    }

    const nextName = input.name?.trim() || workspace.name
    const nextSlug = this.normalizeWorkspaceSlug(input.slug || nextName)
    const updated: WorkspaceRecord = {
      ...workspace,
      name: nextName,
      slug: nextSlug
    }
    this.workspaces.set(workspaceId, updated)
    this.persistWorkspaces()
    return { workspace: updated }
  }

  remove(userId: string, workspaceId: string): OpenPortWorkspaceDeleteResponse {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      throw new ForbiddenException('Workspace not found or access denied')
    }
    if (workspace.ownerUserId !== userId) {
      throw new ForbiddenException('Only workspace owner can delete workspace')
    }

    const ownedWorkspaceIds = [...this.workspaces.values()]
      .filter((entry) => (this.members.get(entry.id) || []).some((member) => member.userId === userId))
      .map((entry) => entry.id)
    if (ownedWorkspaceIds.length <= 1) {
      throw new ForbiddenException('Cannot delete the last accessible workspace')
    }

    this.workspaces.delete(workspaceId)
    this.members.delete(workspaceId)
    this.invites.delete(workspaceId)
    this.capabilityPolicies.delete(workspaceId)
    this.persistAll()
    return { ok: true }
  }

  resolveWorkspaceForUser(userId: string, requestedWorkspaceId?: string): OpenPortWorkspace {
    this.ensureSeedWorkspace(userId)
    const items = this.listForUser(userId).items
    const next =
      (requestedWorkspaceId
        ? items.find((workspace) => workspace.id === requestedWorkspaceId)
        : null) || items[0]
    if (!next) {
      throw new ForbiddenException('Workspace not found or access denied')
    }
    return next
  }

  getCapabilityPolicy(userId: string, workspaceId: string): OpenPortWorkspaceCapabilityPolicyResponse {
    this.ensureWorkspaceAccess(userId, workspaceId)
    return {
      policy: this.ensureWorkspaceCapabilityPolicy(workspaceId)
    }
  }

  updateCapabilityPolicy(
    userId: string,
    workspaceId: string,
    input: { change?: WorkspaceCapabilityPolicyChange; changes?: WorkspaceCapabilityPolicyChange[] }
  ): OpenPortWorkspaceCapabilityPolicyResponse {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    const policy = structuredClone(this.ensureWorkspaceCapabilityPolicy(workspaceId))
    const changes = [
      ...(input.change ? [input.change] : []),
      ...((input.changes || []).filter(Boolean))
    ]

    if (changes.length === 0) {
      return { policy }
    }

    changes.forEach((change) => {
      const rolePolicy = policy.roles[change.role]
      if (!rolePolicy) return
      const modulePolicy = rolePolicy[change.module]
      if (!modulePolicy) return
      modulePolicy[change.action] = Boolean(change.enabled)
    })

    this.capabilityPolicies.set(workspaceId, this.normalizeCapabilityPolicy(policy))
    this.persistCapabilityPolicies()
    return {
      policy: this.ensureWorkspaceCapabilityPolicy(workspaceId)
    }
  }

  listMembers(userId: string, workspaceId: string): OpenPortListResponse<OpenPortWorkspaceMember> {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    return {
      items: this.members.get(workspaceId) || []
    }
  }

  addMember(actorUserId: string, workspaceId: string, dto: AddMemberDto): OpenPortWorkspaceMemberResponse {
    this.ensureWorkspaceManagementAccess(actorUserId, workspaceId)
    const role = dto.role === 'owner' ? 'admin' : dto.role
    const current = this.members.get(workspaceId) || []
    const existing = current.find((member) => member.userId === dto.userId.trim())
    if (existing) {
      const updated = { ...existing, role }
      this.members.set(
        workspaceId,
        current.map((member) => (member.id === existing.id ? updated : member))
      )
      this.persistMembers()
      return { item: updated }
    }

    const created: WorkspaceMember = {
      id: `wsm_${randomUUID()}`,
      workspaceId,
      userId: dto.userId.trim(),
      role,
      createdAt: new Date().toISOString()
    }
    this.members.set(workspaceId, [...current, created])
    this.persistMembers()
    return { item: created }
  }

  updateMemberRole(
    actorUserId: string,
    workspaceId: string,
    memberId: string,
    role: OpenPortWorkspaceMemberRole
  ): OpenPortWorkspaceMemberResponse {
    this.ensureWorkspaceAccess(actorUserId, workspaceId)
    const actorRole = this.getWorkspaceMemberRole(actorUserId, workspaceId)
    if (actorRole !== 'owner' && actorRole !== 'admin') {
      throw new ForbiddenException('Only workspace owners or admins can manage roles')
    }

    const current = this.members.get(workspaceId) || []
    const target = current.find((member) => member.id === memberId)
    if (!target) {
      throw new ForbiddenException('Workspace member not found')
    }
    if (target.role === 'owner') {
      throw new ForbiddenException('Workspace owner role cannot be changed')
    }
    if (actorRole === 'admin' && role === 'owner') {
      throw new ForbiddenException('Only owners can promote another owner')
    }

    const updated = { ...target, role }
    this.members.set(
      workspaceId,
      current.map((member) => (member.id === memberId ? updated : member))
    )
    this.persistMembers()
    return { item: updated }
  }

  inviteMember(userId: string, workspaceId: string, dto: InviteMemberDto): OpenPortWorkspaceInviteResponse {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    const invite: WorkspaceInvite = {
      id: `wsi_${randomUUID()}`,
      workspaceId,
      email: dto.email.trim().toLowerCase(),
      role: dto.role,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    const current = this.invites.get(workspaceId) || []
    current.push(invite)
    this.invites.set(workspaceId, current)
    this.persistInvites()
    return { invite }
  }

  listInvites(userId: string, workspaceId: string): OpenPortListResponse<OpenPortWorkspaceInvite> {
    this.ensureWorkspaceManagementAccess(userId, workspaceId)
    return {
      items: this.invites.get(workspaceId) || []
    }
  }

  assertWorkspaceAccess(userId: string, workspaceId: string): void {
    this.ensureWorkspaceAccess(userId, workspaceId)
  }

  assertWorkspaceModuleAccess(
    userId: string,
    workspaceId: string,
    module: keyof OpenPortWorkspaceModulePermissions,
    mode: 'read' | 'manage' = 'read'
  ): void {
    this.ensureWorkspaceAccess(userId, workspaceId)
    const capabilities = this.getWorkspaceResourceCapabilities(userId, workspaceId)[module]
    const allowed = mode === 'manage' ? capabilities.manage : capabilities.read
    if (!allowed) {
      throw new ForbiddenException(
        mode === 'manage' ? `Workspace ${module} management access denied` : `Workspace ${module} access denied`
      )
    }
  }

  ensureWorkspaceMember(workspaceId: string, userId: string, role: OpenPortWorkspaceMemberRole = 'member'): void {
    const current = this.members.get(workspaceId) || []
    if (current.some((member) => member.userId === userId)) {
      return
    }

    current.push({
      id: `wsm_${randomUUID()}`,
      workspaceId,
      userId,
      role,
      createdAt: new Date().toISOString()
    })
    this.members.set(workspaceId, current)
    this.persistMembers()
  }

  getWorkspaceMemberRole(userId: string, workspaceId: string): OpenPortWorkspaceMemberRole {
    this.ensureWorkspaceAccess(userId, workspaceId)
    const member = (this.members.get(workspaceId) || []).find((entry) => entry.userId === userId)
    if (!member) {
      throw new ForbiddenException('Workspace not found or access denied')
    }
    return this.normalizeMemberRole(member.role)
  }

  getWorkspaceModulePermissions(userId: string, workspaceId: string): OpenPortWorkspaceModulePermissions {
    const capabilities = this.getWorkspaceResourceCapabilities(userId, workspaceId)
    return {
      models: capabilities.models.read,
      knowledge: capabilities.knowledge.read,
      prompts: capabilities.prompts.read,
      tools: capabilities.tools.read,
      skills: capabilities.skills.read,
      access: capabilities.access.read
    }
  }

  getWorkspaceResourceCapabilities(userId: string, workspaceId: string): OpenPortWorkspaceResourceCapabilities {
    const role = this.getWorkspaceMemberRole(userId, workspaceId)
    const policy = this.ensureWorkspaceCapabilityPolicy(workspaceId)
    const resolvedRole: OpenPortWorkspaceCapabilityRole =
      role === 'owner' || role === 'admin' ? 'admin' : role === 'member' ? 'member' : 'viewer'
    return structuredClone(policy.roles[resolvedRole])
  }

  private buildModuleCapabilities(
    input: Partial<OpenPortWorkspaceModuleCapabilities>
  ): OpenPortWorkspaceModuleCapabilities {
    return {
      read: Boolean(input.read),
      manage: Boolean(input.manage),
      import: Boolean(input.import),
      export: Boolean(input.export),
      publish: Boolean(input.publish),
      share: Boolean(input.share),
      validate: Boolean(input.validate)
    }
  }

  private ensureSeedWorkspace(userId: string): void {
    if ([...this.workspaces.values()].some((workspace) => workspace.ownerUserId === userId)) {
      return
    }

    const seedId = `ws_${userId}`
    const createdAt = new Date().toISOString()
    this.workspaces.set(seedId, {
      id: seedId,
      ownerUserId: userId,
      name: 'Default Workspace',
      slug: 'default-workspace',
      createdAt
    })
    this.members.set(seedId, [{
      id: `wsm_${randomUUID()}`,
      workspaceId: seedId,
      userId,
      role: 'owner',
      createdAt
    }])
    this.invites.set(seedId, [])
    this.capabilityPolicies.set(seedId, this.buildDefaultCapabilityPolicy(seedId))
    this.persistAll()
  }

  private ensureWorkspaceAccess(userId: string, workspaceId: string): void {
    this.ensureSeedWorkspace(userId)
    const allowed = (this.members.get(workspaceId) || []).some((member) => member.userId === userId)
    if (!allowed) {
      throw new ForbiddenException('Workspace not found or access denied')
    }
  }

  private ensureWorkspaceManagementAccess(userId: string, workspaceId: string): void {
    this.ensureWorkspaceAccess(userId, workspaceId)
    const role = this.getWorkspaceMemberRole(userId, workspaceId)
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenException('Workspace management requires owner or admin access')
    }
  }

  private normalizeMemberRole(role: string | undefined | null): OpenPortWorkspaceMemberRole {
    if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer') {
      return role
    }
    return 'viewer'
  }

  private ensureWorkspaceCapabilityPolicy(workspaceId: string): OpenPortWorkspaceCapabilityPolicy {
    if (!this.workspaces.has(workspaceId)) {
      throw new ForbiddenException('Workspace not found or access denied')
    }
    const existing = this.capabilityPolicies.get(workspaceId)
    if (existing) {
      const normalized = this.normalizeCapabilityPolicy(existing)
      this.capabilityPolicies.set(workspaceId, normalized)
      return normalized
    }

    const created = this.buildDefaultCapabilityPolicy(workspaceId)
    this.capabilityPolicies.set(workspaceId, created)
    this.persistCapabilityPolicies()
    return created
  }

  private normalizeWorkspaceSlug(input: string): string {
    const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return normalized || 'workspace'
  }

  private buildDefaultCapabilityPolicy(workspaceId: string): OpenPortWorkspaceCapabilityPolicy {
    return {
      workspaceId,
      roles: {
        admin: {
          models: this.buildModuleCapabilities({ read: true, manage: true, import: true, export: true, share: true }),
          knowledge: this.buildModuleCapabilities({ read: true, manage: true, import: true, export: true, validate: true }),
          prompts: this.buildModuleCapabilities({ read: true, manage: true, import: true, export: true, publish: true, share: true }),
          tools: this.buildModuleCapabilities({ read: true, manage: true, import: true, export: true, validate: true, share: true }),
          skills: this.buildModuleCapabilities({ read: true, manage: true, import: true, export: true, share: true }),
          access: this.buildModuleCapabilities({ read: true, manage: true })
        },
        member: {
          models: this.buildModuleCapabilities({ read: true }),
          knowledge: this.buildModuleCapabilities({ read: true }),
          prompts: this.buildModuleCapabilities({ read: true }),
          tools: this.buildModuleCapabilities({ read: true }),
          skills: this.buildModuleCapabilities({ read: true }),
          access: this.buildModuleCapabilities({ read: false })
        },
        viewer: {
          models: this.buildModuleCapabilities({ read: true }),
          knowledge: this.buildModuleCapabilities({ read: true }),
          prompts: this.buildModuleCapabilities({ read: true }),
          tools: this.buildModuleCapabilities({ read: true }),
          skills: this.buildModuleCapabilities({ read: true }),
          access: this.buildModuleCapabilities({ read: false })
        }
      },
      updatedAt: new Date().toISOString()
    }
  }

  private normalizeCapabilityPolicy(policy: OpenPortWorkspaceCapabilityPolicy): OpenPortWorkspaceCapabilityPolicy {
    const next: OpenPortWorkspaceCapabilityPolicy = {
      workspaceId: policy.workspaceId,
      roles: {
        admin: {
          models: this.buildModuleCapabilities({}),
          knowledge: this.buildModuleCapabilities({}),
          prompts: this.buildModuleCapabilities({}),
          tools: this.buildModuleCapabilities({}),
          skills: this.buildModuleCapabilities({}),
          access: this.buildModuleCapabilities({})
        },
        member: {
          models: this.buildModuleCapabilities({}),
          knowledge: this.buildModuleCapabilities({}),
          prompts: this.buildModuleCapabilities({}),
          tools: this.buildModuleCapabilities({}),
          skills: this.buildModuleCapabilities({}),
          access: this.buildModuleCapabilities({})
        },
        viewer: {
          models: this.buildModuleCapabilities({}),
          knowledge: this.buildModuleCapabilities({}),
          prompts: this.buildModuleCapabilities({}),
          tools: this.buildModuleCapabilities({}),
          skills: this.buildModuleCapabilities({}),
          access: this.buildModuleCapabilities({})
        }
      },
      updatedAt: new Date().toISOString()
    }

    ;(['admin', 'member', 'viewer'] as OpenPortWorkspaceCapabilityRole[]).forEach((role) => {
      CAPABILITY_MODULES.forEach((module) => {
        CAPABILITY_ACTIONS.forEach((action) => {
          next.roles[role][module][action] = Boolean(policy.roles?.[role]?.[module]?.[action])
        })
      })
    })

    next.updatedAt = policy.updatedAt || new Date().toISOString()
    return next
  }

  private persistWorkspaces(): void {
    this.identityStore.writeWorkspaces([...this.workspaces.values()])
  }

  private persistMembers(): void {
    this.identityStore.writeMembers([...this.members.values()].flat())
  }

  private persistInvites(): void {
    this.identityStore.writeInvites([...this.invites.values()].flat())
  }

  private persistCapabilityPolicies(): void {
    this.identityStore.writeCapabilityPolicies([...this.capabilityPolicies.values()])
  }

  private persistAll(): void {
    this.persistWorkspaces()
    this.persistMembers()
    this.persistInvites()
    this.persistCapabilityPolicies()
  }
}
