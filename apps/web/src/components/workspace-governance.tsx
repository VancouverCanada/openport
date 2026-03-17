'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspace,
  deleteWorkspace,
  fetchCurrentUser,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  fetchWorkspaces,
  fetchWorkspaceCapabilityPolicy,
  loadSession,
  switchSessionWorkspace,
  updateWorkspace,
  updateWorkspaceCapabilityPolicy,
  type OpenPortWorkspace,
  type OpenPortWorkspaceCapabilityPolicy,
  type OpenPortWorkspaceInvite,
  type OpenPortWorkspaceMember
} from '../lib/openport-api'
import { canManageWorkspace } from '../lib/workspace-permissions'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'

type CapabilityRole = 'admin' | 'member' | 'viewer'
type CapabilityModule = Exclude<keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin'], 'access'>
type CapabilityAction = keyof OpenPortWorkspaceCapabilityPolicy['roles']['admin']['models']

const ROLE_OPTIONS: CapabilityRole[] = ['admin', 'member', 'viewer']
const MODULE_OPTIONS: CapabilityModule[] = ['models', 'knowledge', 'prompts', 'tools', 'skills']
const ACTION_OPTIONS: CapabilityAction[] = ['read', 'manage', 'import', 'export', 'publish', 'share', 'validate']

export function WorkspaceGovernance() {
  const router = useRouter()
  const session = useMemo(() => loadSession(), [])
  const [workspaces, setWorkspaces] = useState<OpenPortWorkspace[]>([])
  const [policy, setPolicy] = useState<OpenPortWorkspaceCapabilityPolicy | null>(null)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(session?.workspaceId || '')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceSlug, setWorkspaceSlug] = useState('')
  const [members, setMembers] = useState<OpenPortWorkspaceMember[]>([])
  const [invites, setInvites] = useState<OpenPortWorkspaceInvite[]>([])
  const [canManageAccess, setCanManageAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  async function load(workspaceId?: string): Promise<void> {
    setLoading(true)
    try {
      const resolvedSession = loadSession()
      if (!resolvedSession) {
        setWorkspaces([])
        setPolicy(null)
        setCanManageAccess(false)
        return
      }

      const [workspaceResponse, currentUser] = await Promise.all([
        fetchWorkspaces(resolvedSession),
        fetchCurrentUser(resolvedSession)
      ])
      setWorkspaces(workspaceResponse.items)
      setCanManageAccess(canManageWorkspace(currentUser))

      const selectedId = workspaceId || activeWorkspaceId || resolvedSession.workspaceId || workspaceResponse.items[0]?.id || ''
      if (selectedId) {
        const [policyResponse, memberResponse, inviteResponse] = await Promise.all([
          fetchWorkspaceCapabilityPolicy(selectedId, resolvedSession),
          fetchWorkspaceMembers(selectedId, resolvedSession).catch(() => ({ items: [] })),
          fetchWorkspaceInvites(selectedId, resolvedSession).catch(() => ({ items: [] }))
        ])
        const selectedWorkspace = workspaceResponse.items.find((entry) => entry.id === selectedId) || null
        setPolicy(policyResponse.policy)
        setActiveWorkspaceId(selectedId)
        setMembers(memberResponse.items)
        setInvites(inviteResponse.items)
        setWorkspaceName(selectedWorkspace?.name || '')
        setWorkspaceSlug(selectedWorkspace?.slug || '')
      } else {
        setPolicy(null)
        setMembers([])
        setInvites([])
        setWorkspaceName('')
        setWorkspaceSlug('')
      }
    } catch {
      setWorkspaces([])
      setPolicy(null)
      setCanManageAccess(false)
      setMembers([])
      setInvites([])
      setWorkspaceName('')
      setWorkspaceSlug('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreateWorkspace(): Promise<void> {
    if (!name.trim()) return
    setWorking(true)
    try {
      const response = await createWorkspace(
        {
          name: name.trim(),
          slug: slug.trim() || undefined
        },
        loadSession()
      )
      setName('')
      setSlug('')
      notify('success', 'Workspace created.')
      await load(response.workspace.id)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to create workspace.')
    } finally {
      setWorking(false)
    }
  }

  async function handleUpdateWorkspace(): Promise<void> {
    if (!activeWorkspaceId || !canManageAccess) return
    if (!workspaceName.trim()) return
    setWorking(true)
    try {
      const response = await updateWorkspace(
        activeWorkspaceId,
        {
          name: workspaceName.trim(),
          slug: workspaceSlug.trim() || undefined
        },
        loadSession()
      )
      setWorkspaceName(response.workspace.name)
      setWorkspaceSlug(response.workspace.slug || '')
      notify('success', 'Workspace updated.')
      await load(activeWorkspaceId)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to update workspace.')
    } finally {
      setWorking(false)
    }
  }

  async function handleDeleteWorkspace(): Promise<void> {
    if (!activeWorkspaceId || !canManageAccess) return
    const target = workspaces.find((item) => item.id === activeWorkspaceId)
    if (!target) return
    if (!window.confirm(`Delete workspace "${target.name}"? This cannot be undone.`)) return

    setWorking(true)
    try {
      const resolvedSession = loadSession()
      if (!resolvedSession) {
        notify('error', 'Session not found.')
        return
      }
      await deleteWorkspace(activeWorkspaceId, resolvedSession)
      notify('success', 'Workspace deleted.')
      const refreshed = await fetchWorkspaces(resolvedSession)
      const fallback = refreshed.items[0]?.id || ''
      setWorkspaces(refreshed.items)
      if (fallback) {
        switchSessionWorkspace(fallback)
        setActiveWorkspaceId(fallback)
      } else {
        setActiveWorkspaceId('')
      }
      await load(fallback || undefined)
      router.refresh()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to delete workspace.')
    } finally {
      setWorking(false)
    }
  }

  function handleSwitchWorkspace(workspaceId: string): void {
    const next = switchSessionWorkspace(workspaceId)
    if (!next) {
      notify('error', 'Unable to switch workspace.')
      return
    }

    setActiveWorkspaceId(workspaceId)
    notify('success', 'Workspace switched.')
    void load(workspaceId)
    router.refresh()
  }

  async function handleToggle(
    role: CapabilityRole,
    module: CapabilityModule,
    action: CapabilityAction,
    enabled: boolean
  ): Promise<void> {
    if (!activeWorkspaceId || !canManageAccess) return

    setPolicy((current) => {
      if (!current) return current
      const next = structuredClone(current)
      next.roles[role][module][action] = enabled
      next.updatedAt = new Date().toISOString()
      return next
    })

    try {
      const response = await updateWorkspaceCapabilityPolicy(
        activeWorkspaceId,
        {
          change: { role, module, action, enabled }
        },
        loadSession()
      )
      setPolicy(response.policy)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to update capability policy.')
      await load(activeWorkspaceId)
    }
  }

  return (
    <div className="workspace-resource-page">
      <PageHeader
        description="Manage workspaces and fine-grained capability gating by role (admin/member/viewer)."
        label="Settings"
        title="Workspaces"
      />

      <section className="workspace-resource-section">
        <ResourceCard>
          <ResourceCardCopy>
            <ResourceCardHeading>
              <strong>Active workspace</strong>
            </ResourceCardHeading>
            <div className="workspace-resource-filters">
              <Field label="Workspace">
                <select
                  disabled={loading || workspaces.length === 0}
                  onChange={(event) => handleSwitchWorkspace(event.target.value)}
                  value={activeWorkspaceId || ''}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {activeWorkspaceId ? <Tag>{activeWorkspaceId}</Tag> : null}
            {canManageAccess ? (
              <div className="workspace-resource-filters">
                <Field label="Workspace name">
                  <input onChange={(event) => setWorkspaceName(event.target.value)} value={workspaceName} />
                </Field>
                <Field label="Workspace slug">
                  <input onChange={(event) => setWorkspaceSlug(event.target.value)} value={workspaceSlug} />
                </Field>
              </div>
            ) : null}
            {canManageAccess ? (
              <div className="workspace-resource-actions">
                <CapsuleButton disabled={working || !workspaceName.trim()} onClick={() => void handleUpdateWorkspace()} type="button" variant="primary">
                  {working ? 'Saving…' : 'Save workspace'}
                </CapsuleButton>
                <CapsuleButton disabled={working || workspaces.length <= 1} onClick={() => void handleDeleteWorkspace()} type="button" variant="secondary">
                  Delete workspace
                </CapsuleButton>
              </div>
            ) : null}
          </ResourceCardCopy>
        </ResourceCard>
      </section>

      <section className="workspace-resource-section">
        <ResourceCard>
          <ResourceCardCopy>
            <ResourceCardHeading>
              <strong>Membership overview</strong>
            </ResourceCardHeading>
            <p>{members.length} members · {invites.length} pending invites</p>
            <div className="workspace-resource-tags">
              {members.slice(0, 6).map((member) => (
                <Tag key={member.id}>{member.userId} ({member.role})</Tag>
              ))}
              {members.length > 6 ? <Tag>+{members.length - 6} more</Tag> : null}
            </div>
            <CapsuleButton href="/settings/workspaces" type="button" variant="secondary">Open workspace settings</CapsuleButton>
          </ResourceCardCopy>
        </ResourceCard>
      </section>

      {canManageAccess ? (
        <section className="workspace-resource-section">
          <ResourceCard>
            <ResourceCardCopy>
              <ResourceCardHeading>
                <strong>Create workspace</strong>
              </ResourceCardHeading>
              <div className="workspace-resource-filters">
                <Field label="Name">
                  <input onChange={(event) => setName(event.target.value)} placeholder="Operations" value={name} />
                </Field>
                <Field label="Slug (optional)">
                  <input onChange={(event) => setSlug(event.target.value)} placeholder="operations" value={slug} />
                </Field>
              </div>
              <CapsuleButton disabled={working} onClick={() => void handleCreateWorkspace()} type="button" variant="primary">
                {working ? 'Creating…' : 'Create workspace'}
              </CapsuleButton>
            </ResourceCardCopy>
          </ResourceCard>
        </section>
      ) : null}

      <section className="workspace-resource-section">
        <ResourceCard stacked>
          <ResourceCardCopy>
            <ResourceCardHeading>
              <strong>Capability policy matrix</strong>
            </ResourceCardHeading>
            <p>Controls what each role can do per workspace module.</p>
          </ResourceCardCopy>

          {loading ? <p className="workspace-module-empty">Loading policy…</p> : null}
          {!loading && !policy ? <p className="workspace-module-empty">No capability policy available.</p> : null}
          {!loading && policy ? (
            <div className="workspace-policy-grid">
              {ROLE_OPTIONS.map((role) => (
                <article key={role} className="workspace-policy-card">
                  <div className="workspace-policy-card-heading">
                    <strong>{role}</strong>
                    <Tag>{role === 'admin' ? 'full control baseline' : 'policy-driven'}</Tag>
                  </div>
                  <div className="workspace-policy-table-wrap">
                    <table className="workspace-policy-table">
                      <thead>
                        <tr>
                          <th>Module</th>
                          {ACTION_OPTIONS.map((action) => (
                            <th key={`${role}-${action}`}>{action}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULE_OPTIONS.map((module) => (
                          <tr key={`${role}-${module}`}>
                            <td>{module}</td>
                            {ACTION_OPTIONS.map((action) => (
                              <td key={`${role}-${module}-${action}`}>
                                <input
                                  checked={Boolean(policy.roles[role][module][action])}
                                  disabled={!canManageAccess || working}
                                  onChange={(event) => {
                                    void handleToggle(role, module, action, event.target.checked)
                                  }}
                                  type="checkbox"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </ResourceCard>
      </section>
    </div>
  )
}
