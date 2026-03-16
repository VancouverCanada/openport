'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  fetchGroups,
  fetchWorkspaceResourceAccessGrants,
  loadSession,
  revokeWorkspaceResourceShare,
  shareWorkspaceResource,
  type OpenPortWorkspaceGroup,
  type OpenPortWorkspaceResourceGrant,
  type OpenPortWorkspaceResourcePermission,
  type OpenPortWorkspaceResourcePrincipalType,
  type WorkspaceResourceModule
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'

type WorkspaceResourceAccessProps = {
  module: WorkspaceResourceModule
  resourceId: string
}

const MODULE_LABELS: Record<WorkspaceResourceModule, string> = {
  models: 'Model',
  prompts: 'Prompt',
  tools: 'Tool',
  skills: 'Skill'
}

function describeGrant(grant: OpenPortWorkspaceResourceGrant): string {
  if (grant.principalType === 'workspace') return `Workspace · ${grant.principalId}`
  if (grant.principalType === 'group') return `Group · ${grant.principalId}`
  if (grant.principalType === 'public') return 'Public'
  return `User · ${grant.principalId}`
}

export function WorkspaceResourceAccess({ module, resourceId }: WorkspaceResourceAccessProps) {
  const session = useMemo(() => loadSession(), [])
  const [loading, setLoading] = useState(true)
  const [grants, setGrants] = useState<OpenPortWorkspaceResourceGrant[]>([])
  const [groups, setGroups] = useState<OpenPortWorkspaceGroup[]>([])
  const [principalType, setPrincipalType] = useState<OpenPortWorkspaceResourcePrincipalType>('user')
  const [principalId, setPrincipalId] = useState('')
  const [permission, setPermission] = useState<OpenPortWorkspaceResourcePermission>('read')
  const [working, setWorking] = useState(false)
  const { canModuleAction, canManageModule } = useWorkspaceAuthority()
  const canShare = canModuleAction(module, 'share') || canManageModule(module)
  const resourceLabel = MODULE_LABELS[module]

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [grantResponse, groupsResponse] = await Promise.all([
        fetchWorkspaceResourceAccessGrants(module, resourceId, session),
        fetchGroups(session).catch(() => ({ items: [] }))
      ])
      setGrants(grantResponse.items)
      setGroups(groupsResponse.items)
    } catch {
      setGrants([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [module, resourceId])

  async function handleShare(): Promise<void> {
    if (!canShare) return
    setWorking(true)
    try {
      await shareWorkspaceResource(module, resourceId, {
        principalType,
        principalId:
          principalType === 'workspace'
            ? session?.workspaceId
            : principalType === 'group'
              ? principalId.trim()
              : principalType === 'public'
                ? '*'
                : principalId.trim(),
        permission
      }, session)
      notify('success', 'Access grant updated.')
      if (principalType !== 'workspace' && principalType !== 'public') {
        setPrincipalId('')
      }
      await load()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to update access grant.')
    } finally {
      setWorking(false)
    }
  }

  async function handleRevoke(grantId: string): Promise<void> {
    if (!canShare) return
    setWorking(true)
    try {
      await revokeWorkspaceResourceShare(module, resourceId, grantId, session)
      notify('success', 'Access grant removed.')
      await load()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to remove access grant.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="workspace-resource-page">
      <PageHeader
        actions={<CapsuleButton href={`/workspace/${module}/${resourceId}`} variant="secondary">Back</CapsuleButton>}
        description={`Configure resource-level access grants for this ${resourceLabel.toLowerCase()}.`}
        label="Workspace"
        title={`${resourceLabel} access`}
      />

      <section className="workspace-resource-section">
        {loading ? <p className="workspace-module-empty">Loading access grants…</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {grants.map((grant) => (
              <ResourceCard
                key={grant.id}
                actions={
                  canShare ? (
                    <ResourceCardActions>
                      <TextButton
                        danger
                        disabled={working}
                        onClick={() => void handleRevoke(grant.id)}
                        type="button"
                        variant="link"
                      >
                        Revoke
                      </TextButton>
                    </ResourceCardActions>
                  ) : null
                }
              >
                <ResourceCardCopy>
                  <ResourceCardHeading>
                    <strong>{describeGrant(grant)}</strong>
                    <Tag>{grant.permission}</Tag>
                  </ResourceCardHeading>
                  <p>Added {new Date(grant.createdAt).toLocaleString()}</p>
                </ResourceCardCopy>
              </ResourceCard>
            ))}
          </div>
        ) : null}
      </section>

      {canShare ? (
        <section className="workspace-resource-section">
          <div className="workspace-module-section-heading">
            <h2>Add grant</h2>
          </div>
          <div className="workspace-resource-filters">
            <Field label="Principal type">
              <select
                onChange={(event) => setPrincipalType(event.target.value as OpenPortWorkspaceResourcePrincipalType)}
                value={principalType}
              >
                <option value="user">User</option>
                <option value="group">Group</option>
                <option value="workspace">Workspace</option>
                <option value="public">Public</option>
              </select>
            </Field>
            {principalType === 'group' ? (
              <Field label="Group">
                <select onChange={(event) => setPrincipalId(event.target.value)} value={principalId}>
                  <option value="">Select group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : principalType === 'workspace' || principalType === 'public' ? null : (
              <Field label="User ID">
                <input
                  onChange={(event) => setPrincipalId(event.target.value)}
                  placeholder="user_xxx"
                  value={principalId}
                />
              </Field>
            )}
            <Field label="Permission">
              <select
                onChange={(event) => setPermission(event.target.value as OpenPortWorkspaceResourcePermission)}
                value={permission}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <CapsuleButton disabled={working} onClick={() => void handleShare()} type="button" variant="primary">
            Save grant
          </CapsuleButton>
        </section>
      ) : (
        <section className="workspace-resource-section">
          <p className="workspace-module-empty">No permission to manage grants for this resource.</p>
        </section>
      )}
    </div>
  )
}
