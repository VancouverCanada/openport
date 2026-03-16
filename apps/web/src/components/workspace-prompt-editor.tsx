'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  createWorkspacePrompt,
  deleteWorkspacePromptVersion,
  fetchWorkspacePrompt,
  fetchWorkspacePromptVersions,
  loadSession,
  publishWorkspacePrompt,
  retractWorkspacePromptCommunity,
  restoreWorkspacePromptVersion,
  setWorkspacePromptProductionVersion,
  submitWorkspacePromptCommunity,
  unpublishWorkspacePrompt,
  updateWorkspacePrompt
} from '../lib/openport-api'
import { downloadJsonFile, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { WorkspacePromptHistoryMenu } from './workspace-prompt-history-menu'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { WorkspaceResourceMenu } from './workspace-resource-menu'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'

type WorkspacePromptEditorProps = {
  promptId?: string
}

export function WorkspacePromptEditor({ promptId }: WorkspacePromptEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [command, setCommand] = useState('/summarize')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'workspace'>('workspace')
  const [commitMessage, setCommitMessage] = useState('')
  const [setAsProduction, setSetAsProduction] = useState(true)
  const [productionVersionId, setProductionVersionId] = useState<string | null>(null)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [communityStatus, setCommunityStatus] = useState<'none' | 'submitted'>('none')
  const [communitySubmittedVersionId, setCommunitySubmittedVersionId] = useState<string | null>(null)
  const [communitySubmittedAt, setCommunitySubmittedAt] = useState<string | null>(null)
  const [communitySubmissionUrl, setCommunitySubmissionUrl] = useState('')
  const [communitySubmissionNote, setCommunitySubmissionNote] = useState('')
  const [versions, setVersions] = useState<Array<{
    id: string
    versionLabel: string
    commitMessage?: string
    savedAt: string
    content: string
  }>>([])
  const [compareVersionId, setCompareVersionId] = useState('current')
  const [loading, setLoading] = useState(Boolean(promptId))
  const [saving, setSaving] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function exportDraft(): void {
    downloadJsonFile(
      `openport-prompt-draft-${(command || title || promptId || 'prompt').replace(/[^a-z0-9-]+/gi, '-')}.json`,
      {
        items: [
          {
            id: promptId || undefined,
            title,
            command,
            description,
            content,
            tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
            visibility,
            productionVersionId
          }
        ]
      }
    )
  }

  async function importDraft(file: File): Promise<void> {
    try {
      const parsed = await readJsonFile(file)
      const items = Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: Array<Record<string, unknown>> }).items
        : Array.isArray(parsed)
          ? (parsed as Array<Record<string, unknown>>)
          : []
      const next = items[0]
      if (!next) {
        notify('error', 'No prompt found in import file.')
        return
      }
      setTitle(typeof next.title === 'string' ? next.title : '')
      setCommand(typeof next.command === 'string' ? next.command : '/prompt')
      setDescription(typeof next.description === 'string' ? next.description : '')
      setContent(typeof next.content === 'string' ? next.content : '')
      setTags(Array.isArray(next.tags) ? next.tags.join(', ') : '')
      setVisibility(next.visibility === 'private' ? 'private' : 'workspace')
      notify('success', 'Prompt draft imported.')
    } catch {
      notify('error', 'Unable to import prompt draft.')
    }
  }

  async function shareToCommunity(): Promise<void> {
    try {
      const payload = {
        title,
        command,
        description,
        content,
        tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
        visibility
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      const url = 'https://openwebui.com'
      const tab = window.open(`${url}/prompts/create`, '_blank', 'noopener,noreferrer')
      const handler = (event: MessageEvent) => {
        if (event.origin !== url || !tab) return
        if (event.data === 'loaded') {
          tab.postMessage(JSON.stringify(payload), '*')
          window.removeEventListener('message', handler)
        }
      }
      window.addEventListener('message', handler)
      window.setTimeout(() => window.removeEventListener('message', handler), 12000)
      notify('success', 'Prompt payload copied. Community page opened in a new tab.')
    } catch {
      notify('error', 'Unable to prepare prompt for community sharing.')
    }
  }

  async function copyCommunityPayload(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            title,
            command,
            description,
            content,
            tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
            visibility
          },
          null,
          2
        )
      )
      notify('success', 'Community payload copied.')
    } catch {
      notify('error', 'Unable to copy community payload.')
    }
  }

  useEffect(() => {
    if (!promptId) return
    let isActive = true
    void Promise.all([
      fetchWorkspacePrompt(promptId, loadSession()),
      fetchWorkspacePromptVersions(promptId, loadSession()).catch(() => ({ items: [] }))
    ])
      .then(([response, versionsResponse]) => {
        if (!isActive) return
        setTitle(response.item.title)
        setCommand(response.item.command)
        setDescription(response.item.description)
        setContent(response.item.content)
        setTags(response.item.tags.join(', '))
        setVisibility(response.item.visibility)
        setProductionVersionId(response.item.productionVersionId)
        setPublishedVersionId(response.item.publishedVersionId)
        setPublishedAt(response.item.publishedAt)
        setCommunityStatus(response.item.communityStatus)
        setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
        setCommunitySubmittedAt(response.item.communitySubmittedAt)
        setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
        setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
        setVersions(versionsResponse.items)
        setCompareVersionId(response.item.productionVersionId || 'current')
        setLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [promptId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    const payload = {
      id: promptId,
      title,
      command,
      description,
      content,
      tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
      visibility,
      commitMessage: commitMessage.trim() || undefined,
      setAsProduction
    }

    try {
      if (promptId) {
        const response = await updateWorkspacePrompt(promptId, payload, loadSession())
        setProductionVersionId(response.item.productionVersionId)
        setPublishedVersionId(response.item.publishedVersionId)
        setPublishedAt(response.item.publishedAt)
        setCommunityStatus(response.item.communityStatus)
        setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
        setCommunitySubmittedAt(response.item.communitySubmittedAt)
        setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
        setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
        notify('success', 'Prompt updated.')
      } else {
        const response = await createWorkspacePrompt(payload, loadSession())
        setProductionVersionId(response.item.productionVersionId)
        setPublishedVersionId(response.item.publishedVersionId)
        setPublishedAt(response.item.publishedAt)
        setCommunityStatus(response.item.communityStatus)
        setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
        setCommunitySubmittedAt(response.item.communitySubmittedAt)
        setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
        setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
        notify('success', 'Prompt created.')
      }
      router.push('/workspace/prompts')
      router.refresh()
    } catch {
      notify('error', 'Unable to save prompt.')
    } finally {
      setCommitMessage('')
      setSetAsProduction(true)
      setSaving(false)
    }
  }

  async function handleRestore(versionId: string): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await restoreWorkspacePromptVersion(promptId, versionId, loadSession())
      const versionsResponse = await fetchWorkspacePromptVersions(promptId, loadSession())
      const promptResponse = await fetchWorkspacePrompt(promptId, loadSession())
      setTitle(response.item.title)
      setCommand(response.item.command)
      setDescription(response.item.description)
      setContent(response.item.content)
      setTags(response.item.tags.join(', '))
      setVisibility(response.item.visibility)
      setVersions(versionsResponse.items)
      setProductionVersionId(promptResponse.item.productionVersionId)
      setPublishedVersionId(promptResponse.item.publishedVersionId)
      setPublishedAt(promptResponse.item.publishedAt)
      setCommunityStatus(promptResponse.item.communityStatus)
      setCommunitySubmittedVersionId(promptResponse.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(promptResponse.item.communitySubmittedAt)
      setCommunitySubmissionUrl(promptResponse.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(promptResponse.item.communitySubmissionNote || '')
      setCompareVersionId(promptResponse.item.productionVersionId || 'current')
      notify('success', 'Prompt restored.')
    } catch {
      notify('error', 'Unable to restore prompt version.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetProduction(versionId: string): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await setWorkspacePromptProductionVersion(promptId, versionId, loadSession())
      setProductionVersionId(response.item.productionVersionId)
      setPublishedVersionId(response.item.publishedVersionId)
      setPublishedAt(response.item.publishedAt)
      setCommunityStatus(response.item.communityStatus)
      setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(response.item.communitySubmittedAt)
      setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
      notify('success', 'Production version updated.')
    } catch {
      notify('error', 'Unable to update production version.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteVersion(versionId: string): Promise<void> {
    if (!promptId || productionVersionId === versionId) return
    setSaving(true)
    try {
      const response = await deleteWorkspacePromptVersion(promptId, versionId, loadSession())
      setVersions(response.items)
      if (compareVersionId === versionId) {
        setCompareVersionId(productionVersionId || 'current')
      }
      notify('success', 'Prompt version deleted.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to delete prompt version.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(versionId?: string): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await publishWorkspacePrompt(promptId, versionId ? { versionId } : {}, loadSession())
      setPublishedVersionId(response.item.publishedVersionId)
      setPublishedAt(response.item.publishedAt)
      setCommunityStatus(response.item.communityStatus)
      setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(response.item.communitySubmittedAt)
      setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
      notify('success', 'Prompt published.')
    } catch {
      notify('error', 'Unable to publish prompt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnpublish(): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await unpublishWorkspacePrompt(promptId, loadSession())
      setPublishedVersionId(response.item.publishedVersionId)
      setPublishedAt(response.item.publishedAt)
      setCommunityStatus(response.item.communityStatus)
      setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(response.item.communitySubmittedAt)
      setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
      notify('success', 'Prompt unpublished.')
    } catch {
      notify('error', 'Unable to unpublish prompt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitCommunity(versionId?: string): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await submitWorkspacePromptCommunity(
        promptId,
        {
          versionId,
          submissionUrl: communitySubmissionUrl.trim() || undefined,
          note: communitySubmissionNote.trim() || undefined
        },
        loadSession()
      )
      setPublishedVersionId(response.item.publishedVersionId)
      setPublishedAt(response.item.publishedAt)
      setCommunityStatus(response.item.communityStatus)
      setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(response.item.communitySubmittedAt)
      setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
      notify('success', 'Prompt submitted to community flow.')
    } catch {
      notify('error', 'Unable to submit prompt to community flow.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRetractCommunity(): Promise<void> {
    if (!promptId) return
    setSaving(true)
    try {
      const response = await retractWorkspacePromptCommunity(promptId, loadSession())
      setCommunityStatus(response.item.communityStatus)
      setCommunitySubmittedVersionId(response.item.communitySubmittedVersionId)
      setCommunitySubmittedAt(response.item.communitySubmittedAt)
      setCommunitySubmissionUrl(response.item.communitySubmissionUrl || '')
      setCommunitySubmissionNote(response.item.communitySubmissionNote || '')
      notify('success', 'Prompt removed from community flow.')
    } catch {
      notify('error', 'Unable to retract prompt from community flow.')
    } finally {
      setSaving(false)
    }
  }

  const publishCandidateId =
    compareVersionId !== 'current' ? compareVersionId : productionVersionId || versions[0]?.id || null
  const publishCandidateLabel =
    compareVersionId !== 'current'
      ? versions.find((version) => version.id === compareVersionId)?.versionLabel || 'Selected version'
      : productionVersionId
        ? 'Production version'
        : versions[0]?.versionLabel || 'Latest version'
  const communityCandidateVersionId = publishCandidateId
  const communityCandidateVersionLabel = publishCandidateLabel

  return (
    <div className="workspace-editor-page">
      {promptId ? (
        <WorkspaceResourceAccessModal
          module="prompts"
          onClose={() => setAccessModalOpen(false)}
          open={accessModalOpen}
          resourceId={promptId}
          resourceLabel="Prompt"
        />
      ) : null}
      <PageHeader
        actions={
          <>
            <CapsuleButton onClick={exportDraft} type="button" variant="secondary">Export draft</CapsuleButton>
            <CapsuleButton onClick={() => void copyCommunityPayload()} type="button" variant="secondary">Copy payload</CapsuleButton>
            <label className="text-button text-button--inline text-button--md">
              Import draft
              <input
                accept="application/json"
                className="workspace-hidden-input"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importDraft(file)
                  event.currentTarget.value = ''
                }}
                ref={fileInputRef}
                type="file"
              />
            </label>
            <CapsuleButton onClick={() => void shareToCommunity()} type="button" variant="secondary">Community</CapsuleButton>
            {promptId ? (
              <WorkspaceResourceMenu
                ariaLabel="Prompt editor actions"
                items={[
                  { href: '/workspace/prompts', icon: 'solar:arrow-left-outline', label: 'Back to prompts' },
                  { icon: 'solar:shield-user-outline', label: 'Access', onClick: () => setAccessModalOpen(true) }
                ]}
              />
            ) : (
              <CapsuleButton href="/workspace/prompts" variant="secondary">Back</CapsuleButton>
            )}
          </>
        }
        description="Build reusable prompt commands similar to Open WebUI prompt resources."
        label="Workspace"
        title={promptId ? 'Edit prompt' : 'Create prompt'}
      />

      {loading ? <p className="workspace-module-empty">Loading prompt…</p> : null}
      {!loading ? (
        <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Title">
            <input onChange={(event) => setTitle(event.target.value)} required value={title} />
          </Field>
          <Field label="Command">
            <input onChange={(event) => setCommand(event.target.value)} required value={command} />
          </Field>
          <Field label="Description">
            <input onChange={(event) => setDescription(event.target.value)} value={description} />
          </Field>
          <Field label="Tags">
            <input onChange={(event) => setTags(event.target.value)} placeholder="review, drafting" value={tags} />
          </Field>
          <Field label="Visibility">
            <select onChange={(event) => setVisibility(event.target.value as typeof visibility)} value={visibility}>
              <option value="workspace">Workspace</option>
              <option value="private">Private</option>
            </select>
          </Field>
          <Field label="Version note">
            <input
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Summarized changes in this revision"
              value={commitMessage}
            />
          </Field>
          <label className="workspace-editor-checkbox">
            <input checked={setAsProduction} onChange={(event) => setSetAsProduction(event.target.checked)} type="checkbox" />
            <span>Set this save as production</span>
          </label>
          <Field label="Prompt content">
            <textarea onChange={(event) => setContent(event.target.value)} rows={16} value={content} />
          </Field>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Community payload preview</strong></ResourceCardHeading>
              <span>Preview the exact payload used for Open WebUI-style sharing and handoff.</span>
            </ResourceCardCopy>
            <pre className="workspace-module-prompt-preview workspace-module-prompt-preview--large">
              {JSON.stringify(
                {
                  title,
                  command,
                  description,
                  content,
                  tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
                  visibility
                },
                null,
                2
              )}
            </pre>
          </section>
          {promptId ? (
            <section className="workspace-editor-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Publishing</strong></ResourceCardHeading>
                <span>Manage the workspace-visible published snapshot used for community and team handoff.</span>
              </ResourceCardCopy>
              <div className="workspace-resource-detail-grid">
                <article className="workspace-resource-detail-card">
                  <strong>Status</strong>
                  <p>{publishedVersionId ? 'Published' : 'Draft only'}</p>
                </article>
                <article className="workspace-resource-detail-card">
                  <strong>Published version</strong>
                  <p>{publishedVersionId ? versions.find((version) => version.id === publishedVersionId)?.versionLabel || 'Version' : 'None'}</p>
                </article>
                <article className="workspace-resource-detail-card">
                  <strong>Published at</strong>
                  <p>{publishedAt ? new Date(publishedAt).toLocaleString() : 'Not published'}</p>
                </article>
              </div>
              <div className="workspace-editor-actions">
                {publishCandidateId ? (
                  <CapsuleButton disabled={saving} onClick={() => void handlePublish(publishCandidateId)} type="button" variant="secondary">
                    Publish {publishCandidateLabel}
                  </CapsuleButton>
                ) : null}
                {publishedVersionId ? (
                  <CapsuleButton disabled={saving} onClick={() => void handleUnpublish()} type="button" variant="secondary">
                    Unpublish
                  </CapsuleButton>
                ) : null}
                <CapsuleButton onClick={() => void copyCommunityPayload()} type="button" variant="secondary">Copy publish payload</CapsuleButton>
              </div>
            </section>
          ) : null}
          {promptId ? (
            <section className="workspace-editor-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Community submission</strong></ResourceCardHeading>
                <span>Track whether this prompt snapshot has been submitted to your external community channel.</span>
              </ResourceCardCopy>
              <div className="workspace-resource-detail-grid">
                <article className="workspace-resource-detail-card">
                  <strong>Status</strong>
                  <p>{communityStatus === 'submitted' ? 'Submitted' : 'Not submitted'}</p>
                </article>
                <article className="workspace-resource-detail-card">
                  <strong>Submitted version</strong>
                  <p>
                    {communitySubmittedVersionId
                      ? versions.find((version) => version.id === communitySubmittedVersionId)?.versionLabel || 'Version'
                      : 'None'}
                  </p>
                </article>
                <article className="workspace-resource-detail-card">
                  <strong>Submitted at</strong>
                  <p>{communitySubmittedAt ? new Date(communitySubmittedAt).toLocaleString() : 'Not submitted'}</p>
                </article>
              </div>
              <div className="workspace-resource-filters">
                <Field label="Submission URL">
                  <input
                    onChange={(event) => setCommunitySubmissionUrl(event.target.value)}
                    placeholder="https://openwebui.com/prompts/..."
                    value={communitySubmissionUrl}
                  />
                </Field>
                <Field label="Submission note">
                  <input
                    onChange={(event) => setCommunitySubmissionNote(event.target.value)}
                    placeholder="Optional release note for this submission"
                    value={communitySubmissionNote}
                  />
                </Field>
              </div>
              <div className="workspace-editor-actions">
                {communityCandidateVersionId ? (
                  <CapsuleButton
                    disabled={saving}
                    onClick={() => void handleSubmitCommunity(communityCandidateVersionId)}
                    type="button"
                    variant="secondary"
                  >
                    Submit {communityCandidateVersionLabel}
                  </CapsuleButton>
                ) : null}
                {communityStatus === 'submitted' ? (
                  <CapsuleButton disabled={saving} onClick={() => void handleRetractCommunity()} type="button" variant="secondary">
                    Retract submission
                  </CapsuleButton>
                ) : null}
                <CapsuleButton onClick={() => void shareToCommunity()} type="button" variant="secondary">Open community site</CapsuleButton>
              </div>
            </section>
          ) : null}
          {promptId ? (
            <section className="workspace-editor-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Version history</strong></ResourceCardHeading>
                <span>Snapshots are persisted server-side on each save, similar to Open WebUI prompt history.</span>
              </ResourceCardCopy>
              <Field label="Compare with">
                <select onChange={(event) => setCompareVersionId(event.target.value)} value={compareVersionId}>
                  <option value="current">Current draft</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.versionLabel}
                    </option>
                  ))}
                </select>
              </Field>
              <PromptDiffPreview
                currentContent={content}
                comparisonContent={versions.find((version) => version.id === compareVersionId)?.content || ''}
                comparisonLabel={
                  versions.find((version) => version.id === compareVersionId)?.versionLabel || 'Current draft'
                }
              />
              <div className="workspace-resource-list">
                {versions.length > 0 ? (
                  versions.map((version) => (
                    <ResourceCard
                      key={version.id}
                      actions={
                        <ResourceCardActions>
                          <WorkspacePromptHistoryMenu
                            canDelete
                            isCommunitySubmitted={communitySubmittedVersionId === version.id}
                            isProduction={productionVersionId === version.id}
                            isPublished={publishedVersionId === version.id}
                            onDelete={() => void handleDeleteVersion(version.id)}
                            onPublish={() => void handlePublish(version.id)}
                            onSubmitCommunity={() => void handleSubmitCommunity(version.id)}
                            onRestore={() => void handleRestore(version.id)}
                            onSetProduction={
                              productionVersionId === version.id
                                ? undefined
                                : () => void handleSetProduction(version.id)
                            }
                            version={version}
                          />
                        </ResourceCardActions>
                      }
                    >
                      <ResourceCardCopy>
                        <ResourceCardHeading>
                          <strong>{version.versionLabel}</strong>
                          <Tag>{new Date(version.savedAt).toLocaleString()}</Tag>
                          {productionVersionId === version.id ? <span className="status-pill">production</span> : null}
                        </ResourceCardHeading>
                        {version.commitMessage ? <p>{version.commitMessage}</p> : null}
                        <pre className="workspace-module-prompt-preview">{version.content}</pre>
                      </ResourceCardCopy>
                    </ResourceCard>
                  ))
                ) : (
                  <p className="workspace-module-empty">No prompt versions yet.</p>
                )}
              </div>
            </section>
          ) : null}
          <div className="workspace-editor-actions">
            <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Saving…' : promptId ? 'Save prompt' : 'Create prompt'}</CapsuleButton>
            <CapsuleButton onClick={() => router.push('/workspace/prompts')} type="button" variant="secondary">Cancel</CapsuleButton>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function PromptDiffPreview({
  currentContent,
  comparisonContent,
  comparisonLabel
}: {
  currentContent: string
  comparisonContent: string
  comparisonLabel: string
}) {
  if (!comparisonContent.trim()) {
    return null
  }

  const currentLines = currentContent.split('\n')
  const comparisonLines = comparisonContent.split('\n')
  const maxLength = Math.max(currentLines.length, comparisonLines.length)
  const lines = Array.from({ length: maxLength }, (_, index) => {
    const currentLine = currentLines[index] ?? ''
    const comparisonLine = comparisonLines[index] ?? ''
    if (currentLine === comparisonLine) {
      return { type: 'same', line: currentLine }
    }
    if (!comparisonLine) {
      return { type: 'added', line: currentLine }
    }
    if (!currentLine) {
      return { type: 'removed', line: comparisonLine }
    }
    return { type: 'changed', line: `${comparisonLine} → ${currentLine}` }
  }).filter((entry) => entry.line.trim().length > 0)

  return (
    <ResourceCard className="workspace-diff-card" stacked>
      <ResourceCardCopy className="workspace-editor-section-heading">
        <ResourceCardHeading><strong>Diff preview</strong></ResourceCardHeading>
        <span>Current draft compared with {comparisonLabel}.</span>
      </ResourceCardCopy>
      <div className="workspace-diff-list">
        {lines.length > 0 ? (
          lines.map((entry, index) => (
            <div key={`${entry.type}-${index}`} className={`workspace-diff-line is-${entry.type}`}>
              <span>{entry.line}</span>
            </div>
          ))
        ) : (
          <p className="workspace-module-empty">No differences detected.</p>
        )}
      </div>
    </ResourceCard>
  )
}
