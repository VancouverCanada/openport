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
import { ModalShell } from './ui/modal-shell'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'

type WorkspaceResourceAccessModalProps = {
  module: WorkspaceResourceModule
  open: boolean
  onClose: () => void
  resourceId: string
  resourceLabel: string
}

function describeGrant(grant: OpenPortWorkspaceResourceGrant): string {
  if (grant.principalType === 'workspace') return `Workspace · ${grant.principalId}`
  if (grant.principalType === 'group') return `Group · ${grant.principalId}`
  if (grant.principalType === 'public') return 'Public'
  return `User · ${grant.principalId}`
}

export function WorkspaceResourceAccessModal({
  module,
  open,
  onClose,
  resourceId,
  resourceLabel
}: WorkspaceResourceAccessModalProps) {
  const session = useMemo(() => loadSession(), [])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [grants, setGrants] = useState<OpenPortWorkspaceResourceGrant[]>([])
  const [groups, setGroups] = useState<OpenPortWorkspaceGroup[]>([])
  const [principalType, setPrincipalType] = useState<OpenPortWorkspaceResourcePrincipalType>('user')
  const [principalId, setPrincipalId] = useState('')
  const [permission, setPermission] = useState<OpenPortWorkspaceResourcePermission>('read')
  const { canModuleAction, canManageModule } = useWorkspaceAuthority()
  const canShare = canModuleAction(module, 'share') || canManageModule(module)

  async function loadData(): Promise<void> {
    if (!open) return
    setLoading(true)
    try {
      const [grantsResponse, groupsResponse] = await Promise.all([
        fetchWorkspaceResourceAccessGrants(module, resourceId, session),
        fetchGroups(session).catch(() => ({ items: [] }))
      ])
      setGrants(grantsResponse.items)
      setGroups(groupsResponse.items)
    } catch {
      setGrants([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [open, module, resourceId])

  async function handleShare(): Promise<void> {
    if (!canShare) return
    setWorking(true)
    try {
      await shareWorkspaceResource(
        module,
        resourceId,
        {
          principalType,
          principalId:
            principalType === 'workspace'
              ? session?.workspaceId || ''
              : principalType === 'public'
                ? '*'
                : principalId.trim(),
          permission
        },
        session
      )
      if (principalType !== 'workspace' && principalType !== 'public') {
        setPrincipalId('')
      }
      notify('success', 'Access grant updated.')
      await loadData()
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
      await loadData()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to remove access grant.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell
      ariaLabel={`${resourceLabel} access`}
      onClose={onClose}
      open={open}
      title={<span>{resourceLabel} access</span>}
    >
      <section className="workspace-resource-section workspace-access-modal-section">
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
        <section className="workspace-resource-section workspace-access-modal-section">
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
      ) : null}
    </ModalShell>
  )
}
