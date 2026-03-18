'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  createWorkspaceModel,
  fetchGroups,
  fetchProjectKnowledge,
  fetchWorkspaceModel,
  fetchWorkspaceModels,
  fetchWorkspaceSkills,
  fetchWorkspaceTools,
  loadSession,
  updateWorkspaceModel,
  type OpenPortProjectKnowledgeItem,
  type OpenPortWorkspaceModel,
  type OpenPortWorkspaceResourceGrant,
  type OpenPortWorkspaceGroup,
  type OpenPortWorkspaceSkill,
  type OpenPortWorkspaceTool
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'
import { WorkspaceResourceMenu } from './workspace-resource-menu'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'
import {
  WorkspaceResourceSelectorModal,
  type WorkspaceResourceSelectorPermission
} from './workspace-resource-selector-modal'
import { WorkspaceTokenSelectorModal } from './workspace-token-selector-modal'

type WorkspaceModelEditorProps = {
  modelId?: string
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function normalizeTokenList(values: string[]): string[] {
  return Array.from(
    values.reduce((set, entry) => {
      const normalized = normalizeToken(entry)
      if (normalized) set.add(normalized)
      return set
    }, new Set<string>())
  )
}

const RECOMMENDED_PROVIDER_OPTIONS = [
  'openport',
  'ollama',
  'openai',
  'anthropic',
  'google',
  'meta',
  'xai',
  'microsoft',
  'azure',
  'alibaba',
  'mistral',
  'deepseek',
  'qwen'
] as const

function inferProviderFromRoute(route: string): string {
  const prefix = (route || '').trim().toLowerCase().split('/')[0] || ''
  return prefix
}

function slugifyRouteComponent(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function buildRecommendedRoute(input: { provider: string; name: string }): string {
  const providerKey = (input.provider || '').trim().toLowerCase() || 'openport'
  const name = (input.name || '').trim()
  if (providerKey === 'ollama') {
    // Preserve native Ollama naming (may include tags or namespaces).
    return `ollama/${name || 'model'}`
  }
  return `${providerKey}/${slugifyRouteComponent(name) || 'model'}`
}

function collectModelTokens(
  models: OpenPortWorkspaceModel[],
  pick: (model: OpenPortWorkspaceModel) => string[]
): string[] {
  return Array.from(
    models.reduce((set, item) => {
      pick(item).forEach((entry) => {
        const normalized = normalizeToken(entry)
        if (normalized) set.add(normalized)
      })
      return set
    }, new Set<string>())
  ).sort((left, right) => left.localeCompare(right))
}

function rankPermission(permission: WorkspaceResourceSelectorPermission): number {
  if (permission === 'admin') return 3
  if (permission === 'write') return 2
  if (permission === 'read') return 1
  return 0
}

function resolveResourcePermission(
  accessGrants: OpenPortWorkspaceResourceGrant[] | undefined,
  input: {
    userId: string
    workspaceId: string
    groupIds: Set<string>
  }
): WorkspaceResourceSelectorPermission {
  if (!Array.isArray(accessGrants) || accessGrants.length === 0) {
    return 'none'
  }

  const matched: WorkspaceResourceSelectorPermission[] = []
  accessGrants.forEach((grant) => {
    if (grant.principalType === 'public' && grant.principalId === '*') {
      matched.push(grant.permission)
    }
    if (grant.principalType === 'workspace' && grant.principalId === input.workspaceId) {
      matched.push(grant.permission)
    }
    if (grant.principalType === 'user' && grant.principalId === input.userId) {
      matched.push(grant.permission)
    }
    if (grant.principalType === 'group' && input.groupIds.has(grant.principalId)) {
      matched.push(grant.permission)
    }
  })

  if (matched.length === 0) return 'none'
  return matched.sort((left, right) => rankPermission(right) - rankPermission(left))[0] || 'none'
}

export function WorkspaceModelEditor({ modelId }: WorkspaceModelEditorProps) {
  const router = useRouter()
  const session = loadSession()
  const [name, setName] = useState('')
  const [route, setRoute] = useState('openport/local')
  const [provider, setProvider] = useState('openport')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<'active' | 'disabled'>('active')
  const [isDefault, setIsDefault] = useState(false)
  const [filterIds, setFilterIds] = useState<string[]>([])
  const [defaultFilterIds, setDefaultFilterIds] = useState<string[]>([])
  const [actionIds, setActionIds] = useState<string[]>([])
  const [defaultFeatureIds, setDefaultFeatureIds] = useState<string[]>([])
  const [filterInput, setFilterInput] = useState('')
  const [defaultFilterInput, setDefaultFilterInput] = useState('')
  const [actionInput, setActionInput] = useState('')
  const [defaultFeatureInput, setDefaultFeatureInput] = useState('')
  const [filterSelectorOpen, setFilterSelectorOpen] = useState(false)
  const [defaultFilterSelectorOpen, setDefaultFilterSelectorOpen] = useState(false)
  const [actionSelectorOpen, setActionSelectorOpen] = useState(false)
  const [defaultFeatureSelectorOpen, setDefaultFeatureSelectorOpen] = useState(false)
  const [knowledgeSelectorOpen, setKnowledgeSelectorOpen] = useState(false)
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false)
  const [builtinToolSelectorOpen, setBuiltinToolSelectorOpen] = useState(false)
  const [skillSelectorOpen, setSkillSelectorOpen] = useState(false)
  const [capabilities, setCapabilities] = useState({
    vision: false,
    webSearch: false,
    imageGeneration: false,
    codeInterpreter: false
  })
  const [knowledgeItemIds, setKnowledgeItemIds] = useState<string[]>([])
  const [toolIds, setToolIds] = useState<string[]>([])
  const [builtinToolIds, setBuiltinToolIds] = useState<string[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [promptSuggestions, setPromptSuggestions] = useState<Array<{ id: string; title: string; prompt: string }>>([])
  const [knowledgeItems, setKnowledgeItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [tools, setTools] = useState<OpenPortWorkspaceTool[]>([])
  const [skills, setSkills] = useState<OpenPortWorkspaceSkill[]>([])
  const [models, setModels] = useState<OpenPortWorkspaceModel[]>([])
  const [groups, setGroups] = useState<OpenPortWorkspaceGroup[]>([])
  const [loading, setLoading] = useState(Boolean(modelId))
  const [saving, setSaving] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)

  useEffect(() => {
    let isActive = true
    const currentSession = loadSession()

    void Promise.all([
      fetchProjectKnowledge(currentSession).catch(() => ({ items: [] })),
      fetchWorkspaceTools(currentSession).catch(() => ({ items: [] })),
      fetchWorkspaceSkills(currentSession).catch(() => ({ items: [] })),
      fetchWorkspaceModels(currentSession).catch(() => ({ items: [] })),
      fetchGroups(currentSession).catch(() => ({ items: [] })),
      modelId ? fetchWorkspaceModel(modelId, currentSession).catch(() => null) : Promise.resolve(null)
    ]).then(([knowledgeResponse, toolsResponse, skillsResponse, modelsResponse, groupsResponse, modelResponse]) => {
      if (!isActive) return
      setKnowledgeItems(knowledgeResponse.items)
      setTools(toolsResponse.items)
      setSkills(skillsResponse.items)
      setModels(modelsResponse.items.filter((item) => item.id !== modelId))
      setGroups(groupsResponse.items)

      if (modelResponse?.item) {
        const item = modelResponse.item
        setName(item.name)
        setRoute(item.route)
        setProvider(item.provider)
        setDescription(item.description)
        setTags(item.tags.join(', '))
        setStatus(item.status)
        setIsDefault(item.isDefault)
        setFilterIds(normalizeTokenList(item.filterIds))
        setDefaultFilterIds(normalizeTokenList(item.defaultFilterIds))
        setActionIds(normalizeTokenList(item.actionIds))
        setDefaultFeatureIds(normalizeTokenList(item.defaultFeatureIds))
        setCapabilities(item.capabilities)
        setKnowledgeItemIds(item.knowledgeItemIds)
        setToolIds(item.toolIds)
        setBuiltinToolIds(item.builtinToolIds)
        setSkillIds(item.skillIds)
        setPromptSuggestions(item.promptSuggestions)
      }

      setLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [modelId])

  function updatePromptSuggestion(id: string, key: 'title' | 'prompt', value: string): void {
    setPromptSuggestions((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }

  function addPromptSuggestion(): void {
    setPromptSuggestions((current) => [
      ...current,
      {
        id: `suggestion_${crypto.randomUUID()}`,
        title: `Suggestion ${current.length + 1}`,
        prompt: ''
      }
    ])
  }

  function removePromptSuggestion(id: string): void {
    setPromptSuggestions((current) => current.filter((item) => item.id !== id))
  }

  function addToken(
    rawValue: string,
    selected: string[],
    setSelected: (next: string[]) => void,
    clearInput?: () => void
  ): void {
    const token = normalizeToken(rawValue)
    if (!token) return
    if (selected.includes(token)) {
      clearInput?.()
      return
    }
    setSelected([...selected, token])
    clearInput?.()
  }

  function removeToken(
    value: string,
    selected: string[],
    setSelected: (next: string[]) => void
  ): void {
    setSelected(selected.filter((entry) => entry !== value))
  }

  const suggestedFilterIds = collectModelTokens(models, (item) => item.filterIds)
  const suggestedDefaultFilterIds = collectModelTokens(models, (item) => item.defaultFilterIds)
  const suggestedActionIds = collectModelTokens(models, (item) => item.actionIds)
  const suggestedDefaultFeatureIds = collectModelTokens(models, (item) => item.defaultFeatureIds)

  const knowledgeGroups = Array.from(
    knowledgeItems.reduce((map, item) => {
      const key = item.collectionName || 'General'
      const bucket = map.get(key) || []
      bucket.push(item)
      map.set(key, bucket)
      return map
    }, new Map<string, OpenPortProjectKnowledgeItem[]>())
  ).sort(([left], [right]) => left.localeCompare(right))
  const actorGroupIds = new Set(
    groups
      .filter((group) => group.memberUserIds.includes(session?.userId || ''))
      .map((group) => group.id)
  )
  const knowledgeItemNameById = new Map(knowledgeItems.map((item) => [item.id, item.name]))
  const toolNameById = new Map(tools.map((item) => [item.id, item.name]))
  const skillNameById = new Map(skills.map((item) => [item.id, item.name]))

  const knowledgeSelectorItems = knowledgeItems
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.previewText || 'No preview text available.',
      metadata: [item.collectionName, item.source, `${item.chunkCount} chunks`],
      permission: 'read' as const
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  const toolSelectorItems = tools
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || 'No description.',
      metadata: [item.enabled ? 'enabled' : 'disabled', ...(item.scopes || []), ...(item.tags || [])].filter(Boolean),
      permission: resolveResourcePermission(item.accessGrants, {
        userId: session?.userId || '',
        workspaceId: session?.workspaceId || '',
        groupIds: actorGroupIds
      })
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  const skillSelectorItems = skills
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || 'No description.',
      metadata: [item.enabled ? 'enabled' : 'disabled', ...(item.tags || [])].filter(Boolean),
      permission: resolveResourcePermission(item.accessGrants, {
        userId: session?.userId || '',
        workspaceId: session?.workspaceId || '',
        groupIds: actorGroupIds
      })
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)

    const inferredProvider = inferProviderFromRoute(route)
    const normalizedProvider = (provider || '').trim() || inferredProvider || 'openport'
    const normalizedRoute = (route || '').trim() || buildRecommendedRoute({ provider: normalizedProvider, name })

    const payload = {
      id: modelId,
      name,
      route: normalizedRoute,
      provider: normalizedProvider,
      description,
      tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
      status,
      isDefault,
      filterIds: normalizeTokenList(filterIds),
      defaultFilterIds: normalizeTokenList(defaultFilterIds),
      actionIds: normalizeTokenList(actionIds),
      defaultFeatureIds: normalizeTokenList(defaultFeatureIds),
      capabilities,
      knowledgeItemIds,
      toolIds,
      builtinToolIds,
      skillIds,
      promptSuggestions: promptSuggestions
        .map((item) => ({
          id: item.id,
          title: item.title.trim(),
          prompt: item.prompt.trim()
        }))
        .filter((item) => item.prompt.length > 0)
    }

    try {
      if (modelId) {
        await updateWorkspaceModel(modelId, payload, session)
        notify('success', 'Model updated.')
      } else {
        await createWorkspaceModel(payload, session)
        notify('success', 'Model created.')
      }
      setRoute(normalizedRoute)
      setProvider(normalizedProvider)
      router.push('/workspace/models')
      router.refresh()
    } catch {
      notify('error', 'Unable to save model.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-editor-page">
      {modelId ? (
        <WorkspaceResourceAccessModal
          module="models"
          onClose={() => setAccessModalOpen(false)}
          open={accessModalOpen}
          resourceId={modelId}
          resourceLabel="Model"
        />
      ) : null}
      <PageHeader
        actions={
          modelId ? (
            <WorkspaceResourceMenu
              ariaLabel="Model editor actions"
              items={[
                { href: '/workspace/models', icon: 'solar:arrow-left-outline', label: 'Back to models' },
                { icon: 'solar:shield-user-outline', label: 'Access', onClick: () => setAccessModalOpen(true) }
              ]}
            />
          ) : (
            <CapsuleButton href="/workspace/models" variant="secondary">Back to models</CapsuleButton>
          )
        }
        description="Define a reusable model route for chat sessions, prompts, and tool attachments."
        label="Workspace"
        title={modelId ? 'Edit model' : 'Create model'}
      />

      {loading ? <p className="workspace-module-empty">Loading model…</p> : null}

      {!loading ? (
        <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <WorkspaceTokenSelectorModal
            description="Select filters in a focused selector flow."
            onClose={() => setFilterSelectorOpen(false)}
            onSave={(tokens) => {
              setFilterIds(tokens)
              setFilterSelectorOpen(false)
            }}
            open={filterSelectorOpen}
            selectedTokens={filterIds}
            suggestedTokens={suggestedFilterIds}
            title="Select filters"
          />
          <WorkspaceTokenSelectorModal
            description="Select default filters for model startup."
            onClose={() => setDefaultFilterSelectorOpen(false)}
            onSave={(tokens) => {
              setDefaultFilterIds(tokens)
              setDefaultFilterSelectorOpen(false)
            }}
            open={defaultFilterSelectorOpen}
            selectedTokens={defaultFilterIds}
            suggestedTokens={suggestedDefaultFilterIds}
            title="Select default filters"
          />
          <WorkspaceTokenSelectorModal
            description="Select action hooks for this model."
            onClose={() => setActionSelectorOpen(false)}
            onSave={(tokens) => {
              setActionIds(tokens)
              setActionSelectorOpen(false)
            }}
            open={actionSelectorOpen}
            selectedTokens={actionIds}
            suggestedTokens={suggestedActionIds}
            title="Select actions"
          />
          <WorkspaceTokenSelectorModal
            description="Select default features for this model."
            onClose={() => setDefaultFeatureSelectorOpen(false)}
            onSave={(tokens) => {
              setDefaultFeatureIds(tokens)
              setDefaultFeatureSelectorOpen(false)
            }}
            open={defaultFeatureSelectorOpen}
            selectedTokens={defaultFeatureIds}
            suggestedTokens={suggestedDefaultFeatureIds}
            title="Select default features"
          />
          <WorkspaceResourceSelectorModal
            description="Select knowledge sources attached to this model route."
            items={knowledgeSelectorItems}
            onClose={() => setKnowledgeSelectorOpen(false)}
            onSave={(ids) => {
              setKnowledgeItemIds(ids)
              setKnowledgeSelectorOpen(false)
            }}
            open={knowledgeSelectorOpen}
            selectedIds={knowledgeItemIds}
            title="Select knowledge"
          />
          <WorkspaceResourceSelectorModal
            description="Select tools this model can invoke."
            items={toolSelectorItems}
            onClose={() => setToolSelectorOpen(false)}
            onSave={(ids) => {
              setToolIds(ids)
              setToolSelectorOpen(false)
            }}
            open={toolSelectorOpen}
            selectedIds={toolIds}
            title="Select tools"
          />
          <WorkspaceResourceSelectorModal
            description="Select tools mounted by default for this model."
            items={toolSelectorItems}
            onClose={() => setBuiltinToolSelectorOpen(false)}
            onSave={(ids) => {
              setBuiltinToolIds(ids)
              setBuiltinToolSelectorOpen(false)
            }}
            open={builtinToolSelectorOpen}
            selectedIds={builtinToolIds}
            title="Select builtin tools"
          />
          <WorkspaceResourceSelectorModal
            description="Select skills available to this model route."
            items={skillSelectorItems}
            onClose={() => setSkillSelectorOpen(false)}
            onSave={(ids) => {
              setSkillIds(ids)
              setSkillSelectorOpen(false)
            }}
            open={skillSelectorOpen}
            selectedIds={skillIds}
            title="Select skills"
          />
          <Field label="Name">
            <input onChange={(event) => setName(event.target.value)} required value={name} />
          </Field>
          <Field
            label={
              <span className="workspace-editor-field-label-row">
                <span>Route</span>
                <TextButton
                  onClick={(event) => {
                    event.preventDefault()
                    const inferredProvider = inferProviderFromRoute(route)
                    const normalizedProvider = (provider || '').trim() || inferredProvider || 'openport'
                    const recommended = buildRecommendedRoute({ provider: normalizedProvider, name })
                    setProvider(normalizedProvider)
                    setRoute(recommended)
                  }}
                  size="sm"
                  type="button"
                  variant="link"
                >
                  Use recommended
                </TextButton>
              </span>
            }
          >
            <input
              onChange={(event) => setRoute(event.target.value)}
              placeholder={buildRecommendedRoute({ provider: provider || 'openport', name: name || 'model' })}
              value={route}
            />
          </Field>
          <Field label="Provider">
            <input
              list="workspace-model-provider-options"
              onChange={(event) => setProvider(event.target.value)}
              placeholder="openport / ollama / openai / ..."
              value={provider}
            />
            <datalist id="workspace-model-provider-options">
              {RECOMMENDED_PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
          <Field label="Description">
            <textarea onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
          </Field>
          <Field label="Tags">
            <input onChange={(event) => setTags(event.target.value)} placeholder="review, local, default" value={tags} />
          </Field>
          <div className="workspace-editor-grid">
            <Field label="Status">
              <select onChange={(event) => setStatus(event.target.value as 'active' | 'disabled')} value={status}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </Field>
            <label className="workspace-editor-checkbox">
              <input checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} type="checkbox" />
              <span>Default model</span>
            </label>
          </div>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Filters</strong></ResourceCardHeading>
              <span>Selector-style filter assignment aligned to Open WebUI model editor flow.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              {filterIds.map((token) => (
                <Tag key={token}>{token}</Tag>
              ))}
            </div>
            {filterIds.length > 0 ? (
              <div className="workspace-inline-actions">
                {filterIds.map((token) => (
                  <TextButton key={`remove-filter-${token}`} onClick={() => removeToken(token, filterIds, setFilterIds)} type="button" variant="link">
                    Remove {token}
                  </TextButton>
                ))}
              </div>
            ) : null}
            <Field label="Add filter token">
              <input
                onChange={(event) => setFilterInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addToken(filterInput, filterIds, setFilterIds, () => setFilterInput(''))
                }}
                placeholder="safety"
                value={filterInput}
              />
            </Field>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => addToken(filterInput, filterIds, setFilterIds, () => setFilterInput(''))} type="button" variant="secondary">Add filter</CapsuleButton>
              <CapsuleButton onClick={() => setFilterSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Default filters</strong></ResourceCardHeading>
              <span>Choose the default filter chain applied when chat sessions bootstrap.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              {defaultFilterIds.map((token) => (
                <Tag key={token}>{token}</Tag>
              ))}
            </div>
            {defaultFilterIds.length > 0 ? (
              <div className="workspace-inline-actions">
                {defaultFilterIds.map((token) => (
                  <TextButton key={`remove-default-filter-${token}`} onClick={() => removeToken(token, defaultFilterIds, setDefaultFilterIds)} type="button" variant="link">
                    Remove {token}
                  </TextButton>
                ))}
              </div>
            ) : null}
            <Field label="Add default filter token">
              <input
                onChange={(event) => setDefaultFilterInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addToken(defaultFilterInput, defaultFilterIds, setDefaultFilterIds, () => setDefaultFilterInput(''))
                }}
                placeholder="strict-review"
                value={defaultFilterInput}
              />
            </Field>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => addToken(defaultFilterInput, defaultFilterIds, setDefaultFilterIds, () => setDefaultFilterInput(''))} type="button" variant="secondary">Add default filter</CapsuleButton>
              <CapsuleButton onClick={() => setDefaultFilterSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Actions</strong></ResourceCardHeading>
              <span>Attach reusable action hooks, with selection behavior matching Open WebUI-style action selectors.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              {actionIds.map((token) => (
                <Tag key={token}>{token}</Tag>
              ))}
            </div>
            {actionIds.length > 0 ? (
              <div className="workspace-inline-actions">
                {actionIds.map((token) => (
                  <TextButton key={`remove-action-${token}`} onClick={() => removeToken(token, actionIds, setActionIds)} type="button" variant="link">
                    Remove {token}
                  </TextButton>
                ))}
              </div>
            ) : null}
            <Field label="Add action token">
              <input
                onChange={(event) => setActionInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addToken(actionInput, actionIds, setActionIds, () => setActionInput(''))
                }}
                placeholder="summarize"
                value={actionInput}
              />
            </Field>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => addToken(actionInput, actionIds, setActionIds, () => setActionInput(''))} type="button" variant="secondary">Add action</CapsuleButton>
              <CapsuleButton onClick={() => setActionSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Default features</strong></ResourceCardHeading>
              <span>Define default feature flags exposed in chat for this model route.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              {defaultFeatureIds.map((token) => (
                <Tag key={token}>{token}</Tag>
              ))}
            </div>
            {defaultFeatureIds.length > 0 ? (
              <div className="workspace-inline-actions">
                {defaultFeatureIds.map((token) => (
                  <TextButton key={`remove-feature-${token}`} onClick={() => removeToken(token, defaultFeatureIds, setDefaultFeatureIds)} type="button" variant="link">
                    Remove {token}
                  </TextButton>
                ))}
              </div>
            ) : null}
            <Field label="Add default feature token">
              <input
                onChange={(event) => setDefaultFeatureInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addToken(defaultFeatureInput, defaultFeatureIds, setDefaultFeatureIds, () => setDefaultFeatureInput(''))
                }}
                placeholder="reasoning"
                value={defaultFeatureInput}
              />
            </Field>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => addToken(defaultFeatureInput, defaultFeatureIds, setDefaultFeatureIds, () => setDefaultFeatureInput(''))} type="button" variant="secondary">Add feature</CapsuleButton>
              <CapsuleButton onClick={() => setDefaultFeatureSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Capabilities</strong></ResourceCardHeading>
              <span>Keep feature switches close to the model, similar to Open WebUI&apos;s model editor.</span>
            </ResourceCardCopy>
            <div className="workspace-editor-grid workspace-editor-grid--compact">
              {[
                ['vision', 'Vision'],
                ['webSearch', 'Web search'],
                ['imageGeneration', 'Image generation'],
                ['codeInterpreter', 'Code interpreter']
              ].map(([key, label]) => (
                <label key={key} className="workspace-editor-checkbox">
                  <input
                    checked={capabilities[key as keyof typeof capabilities]}
                    onChange={(event) =>
                      setCapabilities((current) => ({
                        ...current,
                        [key]: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Knowledge</strong></ResourceCardHeading>
              <span>Use unified selector flow for collection-aware knowledge attachments.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{knowledgeItemIds.length} selected</Tag>
              <Tag>{knowledgeGroups.length} collections</Tag>
            </div>
            <div className="workspace-module-chip-row">
              {knowledgeItemIds.map((id) => (
                <Tag key={id}>{knowledgeItemNameById.get(id) || id}</Tag>
              ))}
            </div>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => setKnowledgeSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Tools</strong></ResourceCardHeading>
              <span>Select invokable tools through one access-aware selector.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{toolIds.length} selected</Tag>
            </div>
            <div className="workspace-module-chip-row">
              {toolIds.map((id) => (
                <Tag key={id}>{toolNameById.get(id) || id}</Tag>
              ))}
            </div>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => setToolSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Builtin tools</strong></ResourceCardHeading>
              <span>Define default mounted tools with the same resource selector UX.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{builtinToolIds.length} selected</Tag>
            </div>
            <div className="workspace-module-chip-row">
              {builtinToolIds.map((id) => (
                <Tag key={id}>{toolNameById.get(id) || id}</Tag>
              ))}
            </div>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => setBuiltinToolSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Skills</strong></ResourceCardHeading>
              <span>Attach reusable skills in the same access-aware selector flow.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{skillIds.length} selected</Tag>
            </div>
            <div className="workspace-module-chip-row">
              {skillIds.map((id) => (
                <Tag key={id}>{skillNameById.get(id) || id}</Tag>
              ))}
            </div>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={() => setSkillSelectorOpen(true)} type="button" variant="secondary">Open selector</CapsuleButton>
            </div>
          </section>

          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Prompt suggestions</strong></ResourceCardHeading>
              <span>Seed starter prompts for the chat empty state, following Open WebUI&apos;s prompt suggestion pattern.</span>
            </ResourceCardCopy>
            <div className="workspace-editor-suggestions">
              {promptSuggestions.length === 0 ? (
                <p className="workspace-module-empty">No prompt suggestions yet.</p>
              ) : (
                promptSuggestions.map((suggestion, index) => (
                  <div key={suggestion.id} className="workspace-editor-suggestion">
                    <Field label={`Suggestion ${index + 1} title`}>
                      <input
                        onChange={(event) => updatePromptSuggestion(suggestion.id, 'title', event.target.value)}
                        placeholder="Review a draft"
                        value={suggestion.title}
                      />
                    </Field>
                    <Field label={`Suggestion ${index + 1} prompt`}>
                      <textarea
                        onChange={(event) => updatePromptSuggestion(suggestion.id, 'prompt', event.target.value)}
                        placeholder="Review this draft for clarity, legal risk, and missing steps."
                        rows={3}
                        value={suggestion.prompt}
                      />
                    </Field>
                    <div className="workspace-inline-actions">
                      <CapsuleButton onClick={() => removePromptSuggestion(suggestion.id)} type="button" variant="secondary">Remove</CapsuleButton>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="workspace-inline-actions">
              <CapsuleButton onClick={addPromptSuggestion} type="button" variant="secondary">Add suggestion</CapsuleButton>
            </div>
          </section>

          <div className="workspace-editor-actions">
            <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Saving…' : modelId ? 'Save model' : 'Create model'}</CapsuleButton>
            <CapsuleButton onClick={() => router.push('/workspace/models')} type="button" variant="secondary">Cancel</CapsuleButton>
          </div>
        </form>
      ) : null}
    </div>
  )
}
