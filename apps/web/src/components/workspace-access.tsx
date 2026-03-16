'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspaceMember,
  createGroup,
  deleteGroup,
  fetchCurrentUser,
  fetchGroups,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  loadSession,
  updateGroup,
  updateWorkspaceMemberRole,
  type OpenPortWorkspaceGroup,
  type OpenPortWorkspaceInvite,
  type OpenPortWorkspaceMember,
  type OpenPortWorkspaceMemberRole
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'

function toMembers(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function roleOptions(currentRole: OpenPortWorkspaceMemberRole): OpenPortWorkspaceMemberRole[] {
  if (currentRole === 'owner') return ['owner']
  return ['admin', 'member', 'viewer']
}

function WorkspaceMemberCard({
  item,
  onSave
}: {
  item: OpenPortWorkspaceMember
  onSave: (item: OpenPortWorkspaceMember, role: OpenPortWorkspaceMemberRole) => Promise<void>
}) {
  const [role, setRole] = useState<OpenPortWorkspaceMemberRole>(item.role)

  useEffect(() => {
    setRole(item.role)
  }, [item.role])

  return (
    <ResourceCard
      actions={
        item.role !== 'owner' ? (
          <ResourceCardActions>
            <TextButton onClick={() => void onSave(item, role)} type="button" variant="link">Save role</TextButton>
          </ResourceCardActions>
        ) : null
      }
    >
      <ResourceCardCopy>
        <ResourceCardHeading>
          <strong>{item.userId}</strong>
          <Tag>{item.role}</Tag>
        </ResourceCardHeading>
        <p>Added {new Date(item.createdAt).toLocaleString()}</p>
        <Field label="Role">
          <select disabled={item.role === 'owner'} onChange={(event) => setRole(event.target.value as OpenPortWorkspaceMemberRole)} value={role}>
            {roleOptions(item.role).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </ResourceCardCopy>
    </ResourceCard>
  )
}

function WorkspaceInviteCard({ item }: { item: OpenPortWorkspaceInvite }) {
  return (
    <ResourceCard>
      <ResourceCardCopy>
        <ResourceCardHeading>
          <strong>{item.email}</strong>
          <Tag>{item.role}</Tag>
        </ResourceCardHeading>
        <p>{item.status} · {new Date(item.createdAt).toLocaleString()}</p>
      </ResourceCardCopy>
    </ResourceCard>
  )
}

function WorkspaceGroupCard({
  item,
  onDelete,
  onSave
}: {
  item: OpenPortWorkspaceGroup
  onDelete: (groupId: string) => Promise<void>
  onSave: (item: OpenPortWorkspaceGroup, nextMembers: string) => Promise<void>
}) {
  const [memberDraft, setMemberDraft] = useState(item.memberUserIds.join(', '))

  useEffect(() => {
    setMemberDraft(item.memberUserIds.join(', '))
  }, [item])

  return (
    <ResourceCard
      actions={
        <ResourceCardActions>
          <TextButton onClick={() => void onSave(item, memberDraft)} type="button" variant="link">Save</TextButton>
          <TextButton danger onClick={() => void onDelete(item.id)} type="button" variant="link">Delete</TextButton>
        </ResourceCardActions>
      }
    >
      <ResourceCardCopy>
        <ResourceCardHeading>
          <strong>{item.name}</strong>
        </ResourceCardHeading>
        <p>{item.description || 'No description provided.'}</p>
        <textarea
          className="workspace-access-members"
          onChange={(event) => setMemberDraft(event.target.value)}
          value={memberDraft}
        />
      </ResourceCardCopy>
    </ResourceCard>
  )
}

export function WorkspaceAccess() {
  const session = useMemo(() => loadSession(), [])
  const [groups, setGroups] = useState<OpenPortWorkspaceGroup[]>([])
  const [members, setMembers] = useState<OpenPortWorkspaceMember[]>([])
  const [invites, setInvites] = useState<OpenPortWorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [membersDraft, setMembersDraft] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OpenPortWorkspaceMemberRole>('member')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState<OpenPortWorkspaceMemberRole>('member')
  const [currentRole, setCurrentRole] = useState<OpenPortWorkspaceMemberRole>('viewer')
  const [hasAccess, setHasAccess] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const workspaceId = session?.workspaceId
      if (!workspaceId) {
        setGroups([])
        setMembers([])
        setInvites([])
        return
      }

      const [groupsResponse, membersResponse, invitesResponse, currentUser] = await Promise.all([
        fetchGroups(session),
        fetchWorkspaceMembers(workspaceId, session),
        fetchWorkspaceInvites(workspaceId, session),
        fetchCurrentUser(session)
      ])

      setGroups(groupsResponse.items)
      setMembers(membersResponse.items)
      setInvites(invitesResponse.items)
      setCurrentRole(currentUser.workspaceRole)
      setHasAccess(Boolean(currentUser.permissions.workspace.access))
    } catch {
      setGroups([])
      setMembers([])
      setInvites([])
      setHasAccess(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreateGroup(): Promise<void> {
    if (!name.trim()) return
    try {
      await createGroup(
        {
          name: name.trim(),
          description: description.trim(),
          memberUserIds: toMembers(membersDraft)
        },
        session
      )
      setName('')
      setDescription('')
      setMembersDraft('')
      notify('success', 'Group created.')
      await load()
    } catch {
      notify('error', 'Unable to create group.')
    }
  }

  async function handleInvite(): Promise<void> {
    if (!inviteEmail.trim() || !session?.workspaceId) return
    try {
      await inviteWorkspaceMember(session.workspaceId, { email: inviteEmail.trim(), role: inviteRole }, session)
      setInviteEmail('')
      setInviteRole('member')
      notify('success', 'Invite created.')
      await load()
    } catch {
      notify('error', 'Unable to create invite.')
    }
  }

  async function handleAddMember(): Promise<void> {
    if (!memberUserId.trim() || !session?.workspaceId) return
    try {
      await createWorkspaceMember(session.workspaceId, { userId: memberUserId.trim(), role: memberRole }, session)
      setMemberUserId('')
      setMemberRole('member')
      notify('success', 'Member added.')
      await load()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to add member.')
    }
  }

  async function handleUpdateRole(item: OpenPortWorkspaceMember, role: OpenPortWorkspaceMemberRole): Promise<void> {
    if (!session?.workspaceId) return
    try {
      await updateWorkspaceMemberRole(session.workspaceId, item.id, role, session)
      notify('success', 'Member role updated.')
      await load()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to update role.')
    }
  }

  async function handleSaveGroup(item: OpenPortWorkspaceGroup, nextMembers: string): Promise<void> {
    try {
      await updateGroup(
        item.id,
        {
          memberUserIds: toMembers(nextMembers)
        },
        session
      )
      notify('success', 'Group updated.')
      await load()
    } catch {
      notify('error', 'Unable to update group.')
    }
  }

  async function handleDeleteGroup(groupId: string): Promise<void> {
    try {
      await deleteGroup(groupId, session)
      notify('success', 'Group deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete group.')
    }
  }

  return (
    <div className="workspace-resource-page">
      <PageHeader
        actions={<Tag>role: {currentRole}</Tag>}
        description="Manage workspace members, roles, invites, and reusable access groups outside the main Workspace module."
        label="Settings"
        title="Access"
      />

      {!loading && !hasAccess ? (
        <section className="workspace-resource-section">
          <ResourceCard stacked>
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Access denied</strong></ResourceCardHeading>
              <span>Only workspace owners and admins can manage members, invites, and groups.</span>
            </ResourceCardCopy>
          </ResourceCard>
        </section>
      ) : null}

      {hasAccess ? <section className="workspace-resource-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Members</strong></ResourceCardHeading>
          <span>Owners and admins can manage who can see the workspace modules, similar to Open WebUI admin-gated asset areas.</span>
        </ResourceCardCopy>
        <ResourceCard stacked>
          <div className="workspace-access-form">
            <input onChange={(event) => setMemberUserId(event.target.value)} placeholder="user_123" value={memberUserId} />
            <select onChange={(event) => setMemberRole(event.target.value as OpenPortWorkspaceMemberRole)} value={memberRole}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <CapsuleButton onClick={() => void handleAddMember()} type="button" variant="primary">Add member</CapsuleButton>
          </div>
        </ResourceCard>
        {loading ? <p className="workspace-module-empty">Loading members…</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {members.map((item) => (
              <WorkspaceMemberCard key={item.id} item={item} onSave={handleUpdateRole} />
            ))}
          </div>
        ) : null}
      </section> : null}

      {hasAccess ? <section className="workspace-resource-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Invites</strong></ResourceCardHeading>
          <span>Pre-assign roles before a member joins the workspace.</span>
        </ResourceCardCopy>
        <ResourceCard stacked>
          <div className="workspace-access-form">
            <input onChange={(event) => setInviteEmail(event.target.value)} placeholder="dev@example.com" value={inviteEmail} />
            <select onChange={(event) => setInviteRole(event.target.value as OpenPortWorkspaceMemberRole)} value={inviteRole}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <CapsuleButton onClick={() => void handleInvite()} type="button" variant="primary">Create invite</CapsuleButton>
          </div>
          <div className="workspace-resource-list">
            {invites.length > 0 ? invites.map((item) => <WorkspaceInviteCard key={item.id} item={item} />) : <p className="workspace-module-empty">No pending invites.</p>}
          </div>
        </ResourceCard>
      </section> : null}

      {hasAccess ? <section className="workspace-resource-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Groups</strong></ResourceCardHeading>
          <span>Reuse member sets across project access grants.</span>
        </ResourceCardCopy>
        <ResourceCard>
          <ResourceCardCopy>
            <ResourceCardHeading>
              <strong>Create group</strong>
            </ResourceCardHeading>
            <p>Use comma-separated user ids or emails to seed group membership.</p>
            <div className="workspace-access-form">
              <input onChange={(event) => setName(event.target.value)} placeholder="Group name" value={name} />
              <input onChange={(event) => setDescription(event.target.value)} placeholder="Description" value={description} />
              <textarea
                onChange={(event) => setMembersDraft(event.target.value)}
                placeholder="user_1, dev@example.com"
                value={membersDraft}
              />
              <CapsuleButton onClick={() => void handleCreateGroup()} type="button" variant="primary">Create group</CapsuleButton>
            </div>
          </ResourceCardCopy>
        </ResourceCard>
        {loading ? <p className="workspace-module-empty">Loading groups…</p> : null}
        {!loading && groups.length === 0 ? <p className="workspace-module-empty">No groups created yet.</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {groups.map((item) => (
              <WorkspaceGroupCard key={item.id} item={item} onDelete={handleDeleteGroup} onSave={handleSaveGroup} />
            ))}
          </div>
        ) : null}
      </section> : null}
    </div>
  )
}
