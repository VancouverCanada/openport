'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  createWorkspaceSkill,
  fetchWorkspaceModels,
  fetchWorkspaceSkill,
  fetchWorkspaceTools,
  loadSession,
  updateWorkspaceSkill,
  type OpenPortWorkspaceModel,
  type OpenPortWorkspaceTool
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { WorkspaceResourceMenu } from './workspace-resource-menu'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'

type WorkspaceSkillEditorProps = {
  skillId?: string
}

export function WorkspaceSkillEditor({ skillId }: WorkspaceSkillEditorProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [linkedModelIds, setLinkedModelIds] = useState<string[]>([])
  const [linkedToolIds, setLinkedToolIds] = useState<string[]>([])
  const [models, setModels] = useState<OpenPortWorkspaceModel[]>([])
  const [tools, setTools] = useState<OpenPortWorkspaceTool[]>([])
  const [loading, setLoading] = useState(Boolean(skillId))
  const [saving, setSaving] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchWorkspaceModels(loadSession()).catch(() => ({ items: [] })),
      fetchWorkspaceTools(loadSession()).catch(() => ({ items: [] })),
      skillId ? fetchWorkspaceSkill(skillId, loadSession()).catch(() => null) : Promise.resolve(null)
    ])
      .then(([modelsResponse, toolsResponse, response]) => {
        if (!isActive) return
        setModels(modelsResponse.items)
        setTools(toolsResponse.items)
        if (response?.item) {
          setName(response.item.name)
          setDescription(response.item.description)
          setContent(response.item.content)
          setTags(response.item.tags.join(', '))
          setEnabled(response.item.enabled)
          setLinkedModelIds(response.item.linkedModelIds || [])
          setLinkedToolIds(response.item.linkedToolIds || [])
        }
        setLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [skillId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)

    const payload = {
      id: skillId,
      name,
      description,
      content,
      tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
      enabled,
      linkedModelIds,
      linkedToolIds
    }

    try {
      if (skillId) {
        await updateWorkspaceSkill(skillId, payload, loadSession())
        notify('success', 'Skill updated.')
      } else {
        await createWorkspaceSkill(payload, loadSession())
        notify('success', 'Skill created.')
      }
      router.push('/workspace/skills')
      router.refresh()
    } catch {
      notify('error', 'Unable to save skill.')
    } finally {
      setSaving(false)
    }
  }

  function toggleLinkedModel(modelId: string): void {
    setLinkedModelIds((current) =>
      current.includes(modelId) ? current.filter((entry) => entry !== modelId) : [...current, modelId]
    )
  }

  function toggleLinkedTool(toolId: string): void {
    setLinkedToolIds((current) =>
      current.includes(toolId) ? current.filter((entry) => entry !== toolId) : [...current, toolId]
    )
  }

  return (
    <div className="workspace-editor-page">
      {skillId ? (
        <WorkspaceResourceAccessModal
          module="skills"
          onClose={() => setAccessModalOpen(false)}
          open={accessModalOpen}
          resourceId={skillId}
          resourceLabel="Skill"
        />
      ) : null}
      <PageHeader
        actions={
          skillId ? (
            <WorkspaceResourceMenu
              ariaLabel="Skill editor actions"
              items={[
                { href: '/workspace/skills', icon: 'solar:arrow-left-outline', label: 'Back to skills' },
                { icon: 'solar:shield-user-outline', label: 'Access', onClick: () => setAccessModalOpen(true) }
              ]}
            />
          ) : (
            <CapsuleButton href="/workspace/skills" variant="secondary">Back to skills</CapsuleButton>
          )
        }
        description="Define reusable skill instructions and lightweight capability modules, similar to Open WebUI skills."
        label="Workspace"
        title={skillId ? 'Edit skill' : 'Create skill'}
      />

      {loading ? <p className="workspace-module-empty">Loading skill…</p> : null}
      {!loading ? (
        <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Name">
            <input onChange={(event) => setName(event.target.value)} required value={name} />
          </Field>
          <Field label="Description">
            <input onChange={(event) => setDescription(event.target.value)} value={description} />
          </Field>
          <Field label="Tags">
            <input onChange={(event) => setTags(event.target.value)} placeholder="analysis, writing, retrieval" value={tags} />
          </Field>
          <label className="workspace-editor-checkbox">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            <span>Enabled</span>
          </label>
          <Field label="Skill content">
            <textarea onChange={(event) => setContent(event.target.value)} rows={18} value={content} />
          </Field>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Orchestration links</strong></ResourceCardHeading>
              <span>Attach this skill to models and tools for reusable composition across workspace assets.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{linkedModelIds.length} model links</Tag>
              <Tag>{linkedToolIds.length} tool links</Tag>
            </div>
            <Field label="Linked models">
              {models.length === 0 ? (
                <p className="workspace-module-empty">No models available.</p>
              ) : (
                <div className="workspace-editor-checklist">
                  {models.map((item) => (
                    <label key={item.id} className="workspace-editor-check">
                      <input
                        checked={linkedModelIds.includes(item.id)}
                        onChange={() => toggleLinkedModel(item.id)}
                        type="checkbox"
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Linked tools">
              {tools.length === 0 ? (
                <p className="workspace-module-empty">No tools available.</p>
              ) : (
                <div className="workspace-editor-checklist">
                  {tools.map((item) => (
                    <label key={item.id} className="workspace-editor-check">
                      <input
                        checked={linkedToolIds.includes(item.id)}
                        onChange={() => toggleLinkedTool(item.id)}
                        type="checkbox"
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
          </section>
          <div className="workspace-editor-actions">
            <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Saving…' : skillId ? 'Save skill' : 'Create skill'}</CapsuleButton>
          </div>
        </form>
      ) : null}
    </div>
  )
}
