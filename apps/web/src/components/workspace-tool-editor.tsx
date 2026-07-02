'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  createWorkspaceTool,
  fetchIntegrations,
  fetchWorkspaceModels,
  fetchWorkspaceTool,
  loadSession,
  updateWorkspaceModel,
  validateWorkspaceTool,
  updateWorkspaceTool,
  type OpenPortIntegration,
  type OpenPortWorkspaceModel,
  type OpenPortWorkspaceToolValidationResponse
} from '../lib/openport-api'
import type { OpenPortWorkspaceToolValveSchemaField } from '../lib/openport-api'
import { downloadJsonFile, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { WorkspaceToolManifestModal } from './workspace-tool-manifest-modal'
import { WorkspaceToolValvesModal } from './workspace-tool-valves-modal'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { Field } from './ui/field'
import { FieldInput } from './ui/field-input'
import { FieldSelect } from './ui/field-select'
import { PageHeader } from './ui/page-header'
import { ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'
import { WorkspaceResourceMenu } from './workspace-resource-menu'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'

type WorkspaceToolEditorProps = {
  resourceKind?: 'tool' | 'function'
  toolId?: string
}

export function WorkspaceToolEditor({ resourceKind = 'tool', toolId }: WorkspaceToolEditorProps) {
  const router = useRouter()
  const isFunction = resourceKind === 'function'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [integrationId, setIntegrationId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [scopes, setScopes] = useState('')
  const [tags, setTags] = useState('')
  const [manifest, setManifest] = useState('')
  const [valves, setValves] = useState<Array<{ id: string; key: string; value: string }>>([{ id: 'valve_0', key: '', value: '' }])
  const [examples, setExamples] = useState<Array<{ id: string; name: string; input: string; output: string }>>([
    { id: 'example_0', name: '', input: '', output: '' }
  ])
  const [valveSchema, setValveSchema] = useState<Array<OpenPortWorkspaceToolValveSchemaField>>([
    { id: 'schema_0', key: '', label: '', type: 'string', description: '', defaultValue: '', required: false }
  ])
  const [integrations, setIntegrations] = useState<OpenPortIntegration[]>([])
  const [models, setModels] = useState<OpenPortWorkspaceModel[]>([])
  const [linkedModelIds, setLinkedModelIds] = useState<string[]>([])
  const [builtinModelIds, setBuiltinModelIds] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(toolId))
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const [validationReport, setValidationReport] = useState<OpenPortWorkspaceToolValidationResponse | null>(null)
  const [importing, setImporting] = useState(false)
  const [manifestModalOpen, setManifestModalOpen] = useState(false)
  const [valvesModalOpen, setValvesModalOpen] = useState(false)
  const [syncingBindings, setSyncingBindings] = useState(false)
  const { canManageModule } = useWorkspaceAuthority()
  const canManageModelBindings = canManageModule('models')

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchIntegrations(loadSession()).catch(() => ({ items: [] })),
      fetchWorkspaceModels(loadSession()).catch(() => ({ items: [] })),
      toolId ? fetchWorkspaceTool(toolId, loadSession()).catch(() => null) : Promise.resolve(null)
    ]).then(([integrationsResponse, modelsResponse, toolResponse]) => {
      if (!isActive) return
      setIntegrations(integrationsResponse.items)
      setModels(modelsResponse.items)
      if (toolId) {
        setLinkedModelIds(
          modelsResponse.items
            .filter((item) => item.toolIds.includes(toolId))
            .map((item) => item.id)
        )
        setBuiltinModelIds(
          modelsResponse.items
            .filter((item) => item.builtinToolIds.includes(toolId))
            .map((item) => item.id)
        )
      } else {
        setLinkedModelIds([])
        setBuiltinModelIds([])
      }
      if (toolResponse?.item) {
        setName(toolResponse.item.name)
        setDescription(toolResponse.item.description)
        setIntegrationId(toolResponse.item.integrationId || '')
        setEnabled(toolResponse.item.enabled)
        setScopes(toolResponse.item.scopes.join(', '))
        setTags(toolResponse.item.tags.join(', '))
        setManifest(toolResponse.item.manifest)
        const nextValves = Object.entries(toolResponse.item.valves).map(([key, value], index) => ({
          id: `valve_${index}`,
          key,
          value
        }))
        setValves(nextValves.length > 0 ? nextValves : [{ id: 'valve_0', key: '', value: '' }])
        setValveSchema(
          toolResponse.item.valveSchema.length > 0
            ? toolResponse.item.valveSchema
            : [{ id: 'schema_0', key: '', label: '', type: 'string', description: '', defaultValue: '', required: false }]
        )
        setExamples(
          toolResponse.item.examples.length > 0
            ? toolResponse.item.examples
            : [{ id: 'example_0', name: '', input: '', output: '' }]
        )
      }
      setLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [toolId])

  function exportToolDraft(): void {
    downloadJsonFile(
      `openport-${isFunction ? 'function' : 'tool'}-draft-${(name || toolId || resourceKind).replace(/[^a-z0-9-]+/gi, '-')}.json`,
      {
        items: [
          {
            id: toolId || undefined,
            name,
            description,
            integrationId: integrationId || null,
            enabled,
            scopes: scopes.split(',').map((entry) => entry.trim()).filter(Boolean),
            tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
            manifest,
            valves: valves.reduce<Record<string, string>>((result, valve) => {
              const key = valve.key.trim()
              if (!key) return result
              result[key] = valve.value.trim()
              return result
            }, {}),
            valveSchema,
            examples
          }
        ]
      }
    )
  }

  async function importToolDraft(file: File): Promise<void> {
    setImporting(true)
    try {
      const parsed = await readJsonFile(file)
      const items = Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items: Array<Record<string, unknown>> }).items)
        : Array.isArray(parsed)
          ? (parsed as Array<Record<string, unknown>>)
          : []
      const next = items[0]
      if (!next) {
        notify('error', 'No tool found in import file.')
        return
      }

      setName(typeof next.name === 'string' ? next.name : '')
      setDescription(typeof next.description === 'string' ? next.description : '')
      setIntegrationId(typeof next.integrationId === 'string' ? next.integrationId : '')
      setEnabled(typeof next.enabled === 'boolean' ? next.enabled : true)
      setScopes(Array.isArray(next.scopes) ? next.scopes.join(', ') : '')
      setTags(Array.isArray(next.tags) ? next.tags.join(', ') : '')
      setManifest(typeof next.manifest === 'string' ? next.manifest : '')

      const importedValves = next.valves && typeof next.valves === 'object'
        ? Object.entries(next.valves as Record<string, string>).map(([key, value], index) => ({
            id: `valve_import_${index}`,
            key,
            value: String(value)
          }))
        : []
      setValves(importedValves.length > 0 ? importedValves : [{ id: 'valve_0', key: '', value: '' }])

      const importedSchema = Array.isArray(next.valveSchema)
        ? (next.valveSchema as Array<OpenPortWorkspaceToolValveSchemaField>)
        : []
      setValveSchema(
        importedSchema.length > 0
          ? importedSchema
          : [{ id: 'schema_0', key: '', label: '', type: 'string', description: '', defaultValue: '', required: false }]
      )
      const importedExamples = Array.isArray(next.examples)
        ? next.examples
            .map((example, index) => ({
              id: typeof example?.id === 'string' ? example.id : `example_import_${index}`,
              name: typeof example?.name === 'string' ? example.name : '',
              input: typeof example?.input === 'string' ? example.input : '',
              output: typeof example?.output === 'string' ? example.output : ''
            }))
            .filter((example) => example.name || example.input || example.output)
        : []
      setExamples(importedExamples.length > 0 ? importedExamples : [{ id: 'example_0', name: '', input: '', output: '' }])

      notify('success', 'Tool draft imported.')
    } catch {
      notify('error', 'Unable to import tool draft.')
    } finally {
      setImporting(false)
    }
  }

  async function importToolDraftFromClipboard(): Promise<void> {
    setImporting(true)
    try {
      const raw = await navigator.clipboard.readText()
      const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
      const items = Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items: Array<Record<string, unknown>> }).items)
        : Array.isArray(parsed)
          ? parsed
          : []
      const next = items[0]
      if (!next) {
        notify('error', 'No tool found in clipboard payload.')
        return
      }

      setName(typeof next.name === 'string' ? next.name : '')
      setDescription(typeof next.description === 'string' ? next.description : '')
      setIntegrationId(typeof next.integrationId === 'string' ? next.integrationId : '')
      setEnabled(typeof next.enabled === 'boolean' ? next.enabled : true)
      setScopes(Array.isArray(next.scopes) ? next.scopes.join(', ') : '')
      setTags(Array.isArray(next.tags) ? next.tags.join(', ') : '')
      setManifest(typeof next.manifest === 'string' ? next.manifest : '')
      const importedValves = next.valves && typeof next.valves === 'object'
        ? Object.entries(next.valves as Record<string, string>).map(([key, value], index) => ({
            id: `valve_clipboard_${index}`,
            key,
            value: String(value)
          }))
        : []
      setValves(importedValves.length > 0 ? importedValves : [{ id: 'valve_0', key: '', value: '' }])
      const importedSchema = Array.isArray(next.valveSchema)
        ? (next.valveSchema as Array<OpenPortWorkspaceToolValveSchemaField>)
        : []
      setValveSchema(
        importedSchema.length > 0
          ? importedSchema
          : [{ id: 'schema_0', key: '', label: '', type: 'string', description: '', defaultValue: '', required: false }]
      )
      const importedExamples = Array.isArray(next.examples)
        ? next.examples
            .map((example, index) => ({
              id: typeof example?.id === 'string' ? example.id : `example_clipboard_${index}`,
              name: typeof example?.name === 'string' ? example.name : '',
              input: typeof example?.input === 'string' ? example.input : '',
              output: typeof example?.output === 'string' ? example.output : ''
            }))
            .filter((example) => example.name || example.input || example.output)
        : []
      setExamples(importedExamples.length > 0 ? importedExamples : [{ id: 'example_0', name: '', input: '', output: '' }])
      notify('success', 'Tool draft imported from clipboard.')
    } catch {
      notify('error', 'Unable to import tool draft from clipboard.')
    } finally {
      setImporting(false)
    }
  }

  async function copyToolkitPayload(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(toolkitPreview, null, 2))
      notify('success', 'Toolkit payload copied.')
    } catch {
      notify('error', 'Unable to copy toolkit payload.')
    }
  }

  function buildEditorPayload() {
    return {
      id: toolId,
      name,
      description,
      integrationId: integrationId || null,
      enabled,
      scopes: scopes.split(',').map((entry) => entry.trim()).filter(Boolean),
      tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
      manifest,
      valves: valves.reduce<Record<string, string>>((result, valve) => {
        const key = valve.key.trim()
        if (!key) return result
        result[key] = valve.value.trim()
        return result
      }, {}),
      valveSchema: valveSchema
        .map((field) => ({
          ...field,
          key: field.key.trim(),
          label: field.label.trim(),
          description: field.description.trim(),
          defaultValue: field.defaultValue.trim()
        }))
        .filter((field) => field.key),
      examples: examples
        .map((example) => ({
          ...example,
          name: example.name.trim()
        }))
        .filter((example) => example.name || example.input || example.output)
    }
  }

  function applySchemaDefaultsToValves(): void {
    setValves((current) => {
      const map = new Map(current.map((item) => [item.key.trim(), item] as const))
      valveSchema.forEach((field) => {
        const key = field.key.trim()
        if (!key) return
        const existing = map.get(key)
        const defaultValue = field.defaultValue.trim()
        if (existing) {
          map.set(key, { ...existing, value: existing.value || defaultValue })
          return
        }
        map.set(key, { id: `valve_schema_${Date.now()}_${key}`, key, value: defaultValue })
      })
      const next = [...map.values()].filter((entry) => entry.key.trim())
      return next.length > 0 ? next : [{ id: 'valve_0', key: '', value: '' }]
    })
    notify('success', 'Schema defaults applied to valves.')
  }

  async function runValidation(payload: ReturnType<typeof buildEditorPayload>, notifyWhenValid = false): Promise<OpenPortWorkspaceToolValidationResponse | null> {
    setValidating(true)
    try {
      const report = await validateWorkspaceTool(payload, loadSession())
      setValidationReport(report)
      if (notifyWhenValid && report.valid) {
        notify('success', `Validation passed with ${report.warnings.length} warning(s).`)
      }
      if (!report.valid) {
        notify('error', report.errors[0] || 'Tool validation failed.')
      }
      return report
    } catch {
      notify('error', 'Unable to validate tool payload.')
      return null
    } finally {
      setValidating(false)
    }
  }

  function toggleLinkedModel(modelId: string): void {
    setLinkedModelIds((current) =>
      current.includes(modelId) ? current.filter((entry) => entry !== modelId) : [...current, modelId]
    )
    setBuiltinModelIds((current) => (current.includes(modelId) ? current.filter((entry) => entry !== modelId) : current))
  }

  function toggleBuiltinModel(modelId: string): void {
    setBuiltinModelIds((current) =>
      current.includes(modelId) ? current.filter((entry) => entry !== modelId) : [...current, modelId]
    )
    setLinkedModelIds((current) => (current.includes(modelId) ? current : [...current, modelId]))
  }

  async function persistModelBindings(savedToolId: string): Promise<number> {
    if (!canManageModelBindings) return 0

    const targetLinked = new Set(linkedModelIds)
    const targetBuiltin = new Set(builtinModelIds)
    const updateTargets = models
      .map((model) => {
        const shouldBeBuiltin = targetBuiltin.has(model.id)
        const shouldBeLinked = targetLinked.has(model.id) || shouldBeBuiltin
        const hasLinked = model.toolIds.includes(savedToolId)
        const hasBuiltin = model.builtinToolIds.includes(savedToolId)

        const nextToolIds = shouldBeLinked
          ? hasLinked
            ? model.toolIds
            : [...model.toolIds, savedToolId]
          : model.toolIds.filter((entry) => entry !== savedToolId)

        const nextBuiltinToolIds = shouldBeBuiltin
          ? hasBuiltin
            ? model.builtinToolIds
            : [...model.builtinToolIds, savedToolId]
          : model.builtinToolIds.filter((entry) => entry !== savedToolId)

        const changed =
          nextToolIds.length !== model.toolIds.length ||
          nextBuiltinToolIds.length !== model.builtinToolIds.length

        if (!changed) return null
        return {
          modelId: model.id,
          toolIds: nextToolIds,
          builtinToolIds: nextBuiltinToolIds
        }
      })
      .filter((entry): entry is { modelId: string; toolIds: string[]; builtinToolIds: string[] } => Boolean(entry))

    if (updateTargets.length === 0) return 0

    setSyncingBindings(true)
    try {
      await Promise.all(
        updateTargets.map((entry) =>
          updateWorkspaceModel(
            entry.modelId,
            {
              toolIds: entry.toolIds,
              builtinToolIds: entry.builtinToolIds
            },
            loadSession()
          )
        )
      )
      setModels((current) =>
        current.map((model) => {
          const matched = updateTargets.find((entry) => entry.modelId === model.id)
          if (!matched) return model
          return {
            ...model,
            toolIds: matched.toolIds,
            builtinToolIds: matched.builtinToolIds
          }
        })
      )
      return updateTargets.length
    } finally {
      setSyncingBindings(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    const payload = buildEditorPayload()
    const report = await runValidation(payload)
    if (!report?.valid) {
      setSaving(false)
      return
    }

    try {
      let persistedToolId = toolId || ''
      if (toolId) {
        const response = await updateWorkspaceTool(toolId, payload, loadSession())
        persistedToolId = response.item.id
        notify('success', `${isFunction ? 'Function' : 'Tool'} updated.`)
      } else {
        const response = await createWorkspaceTool(payload, loadSession())
        persistedToolId = response.item.id
        notify('success', `${isFunction ? 'Function' : 'Tool'} created.`)
      }
      if (persistedToolId) {
        try {
          const syncedCount = await persistModelBindings(persistedToolId)
          if (syncedCount > 0) {
            notify('success', `Updated model bindings in ${syncedCount} model(s).`)
          }
        } catch {
          notify('info', 'Tool saved, but model bindings could not be synchronized.')
        }
      }
      router.push('/workspace/tools')
      router.refresh()
    } catch {
      notify('error', 'Unable to save tool.')
    } finally {
      setSaving(false)
    }
  }

  function updateValve(id: string, patch: Partial<{ key: string; value: string }>): void {
    setValves((current) => current.map((valve) => (valve.id === id ? { ...valve, ...patch } : valve)))
  }

  function addValve(): void {
    setValves((current) => [...current, { id: `valve_${Date.now()}`, key: '', value: '' }])
  }

  function removeValve(id: string): void {
    setValves((current) => {
      const next = current.filter((valve) => valve.id !== id)
      return next.length > 0 ? next : [{ id: 'valve_0', key: '', value: '' }]
    })
  }

  function updateValveSchemaField(id: string, patch: Partial<OpenPortWorkspaceToolValveSchemaField>): void {
    setValveSchema((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)))
  }

  function addValveSchemaField(): void {
    setValveSchema((current) => [
      ...current,
      {
        id: `schema_${Date.now()}`,
        key: '',
        label: '',
        type: 'string',
        description: '',
        defaultValue: '',
        required: false
      }
    ])
  }

  function removeValveSchemaField(id: string): void {
    setValveSchema((current) => {
      const next = current.filter((field) => field.id !== id)
      return next.length > 0
        ? next
        : [{ id: 'schema_0', key: '', label: '', type: 'string', description: '', defaultValue: '', required: false }]
    })
  }

  function updateExample(id: string, patch: Partial<{ name: string; input: string; output: string }>): void {
    setExamples((current) => current.map((example) => (example.id === id ? { ...example, ...patch } : example)))
  }

  function addExample(): void {
    setExamples((current) => [...current, { id: `example_${Date.now()}`, name: '', input: '', output: '' }])
  }

  function removeExample(id: string): void {
    setExamples((current) => {
      const next = current.filter((example) => example.id !== id)
      return next.length > 0 ? next : [{ id: 'example_0', name: '', input: '', output: '' }]
    })
  }

  function applyManifestTemplate(template: 'http' | 'policy' | 'retrieval'): void {
    if (template === 'http') {
      setManifest('name: http-proxy\nentry: tools/http-proxy.ts\nmethod: POST\npath: /execute')
      setValveSchema([
        {
          id: 'schema_http_url',
          key: 'baseUrl',
          label: 'Base URL',
          type: 'string',
          description: 'Upstream endpoint root URL.',
          defaultValue: 'https://api.example.com',
          required: true
        },
        {
          id: 'schema_http_timeout',
          key: 'timeoutMs',
          label: 'Timeout',
          type: 'number',
          description: 'Maximum request time in milliseconds.',
          defaultValue: '30000',
          required: false
        }
      ])
      return
    }
    if (template === 'policy') {
      setManifest('name: policy-guard\nentry: tools/policy-guard.ts\nmode: guard\nscopes:\n  - review')
      setValveSchema([
        {
          id: 'schema_policy_mode',
          key: 'strictMode',
          label: 'Strict mode',
          type: 'boolean',
          description: 'Block output when a policy match is found.',
          defaultValue: 'true',
          required: false
        }
      ])
      return
    }
    setManifest('name: retrieval-helper\nentry: tools/retrieval-helper.ts\nmode: knowledge\nscopes:\n  - chat')
    setValveSchema([
      {
        id: 'schema_retrieval_limit',
        key: 'resultLimit',
        label: 'Result limit',
        type: 'number',
        description: 'Maximum chunks retrieved per request.',
        defaultValue: '5',
        required: false
      },
      {
        id: 'schema_retrieval_strategy',
        key: 'rankingStrategy',
        label: 'Ranking strategy',
        type: 'string',
        description: 'Primary scoring mode for retrieved knowledge.',
        defaultValue: 'hybrid',
        required: false
      }
    ])
  }

  const manifestSummary = {
    name: manifest.match(/name:\s*(.+)/)?.[1]?.trim() || 'Unnamed',
    entry: manifest.match(/entry:\s*(.+)/)?.[1]?.trim() || 'No entry'
  }
  const toolkitPreview = {
    name: name || manifestSummary.name,
    integration: integrationId || 'none',
    scopes: scopes.split(',').map((entry) => entry.trim()).filter(Boolean),
    tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
    valves: valves.filter((valve) => valve.key.trim()).map((valve) => ({ key: valve.key.trim(), value: valve.value.trim() })),
    schema: valveSchema
      .filter((field) => field.key.trim())
      .map((field) => ({ key: field.key.trim(), type: field.type, required: field.required, defaultValue: field.defaultValue.trim() })),
    examples: examples
      .filter((example) => example.name || example.input || example.output)
      .map((example) => ({ name: example.name, input: example.input, output: example.output }))
  }
  const linkedModels = models.filter((model) => linkedModelIds.includes(model.id))
  const builtinModels = models.filter((model) => builtinModelIds.includes(model.id))

  return (
    <div className="workspace-editor-page">
      {toolId ? (
        <WorkspaceResourceAccessModal
          module="tools"
          onClose={() => setAccessModalOpen(false)}
          open={accessModalOpen}
          resourceId={toolId}
          resourceLabel="Tool"
        />
      ) : null}
      <PageHeader
        actions={
          <div className="workspace-resource-header-actions">
          <CapsuleButton onClick={exportToolDraft} type="button" variant="secondary">Export draft</CapsuleButton>
          <CapsuleButton disabled={importing} onClick={() => void importToolDraftFromClipboard()} type="button" variant="secondary">Paste import</CapsuleButton>
          <CapsuleButton onClick={() => void copyToolkitPayload()} type="button" variant="secondary">Copy payload</CapsuleButton>
          <CapsuleButton disabled={validating} onClick={() => void runValidation(buildEditorPayload(), true)} type="button" variant="secondary">
            {validating ? 'Validating…' : 'Validate toolkit'}
          </CapsuleButton>
          <label className="text-button text-button--inline text-button--md">
            Import draft
            <input
              accept="application/json"
              className="workspace-hidden-input"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importToolDraft(file)
                event.currentTarget.value = ''
              }}
              type="file"
            />
          </label>
          {toolId ? (
            <WorkspaceResourceMenu
              ariaLabel="Tool editor actions"
              items={[
                { href: '/workspace/tools', icon: 'solar:arrow-left-outline', label: 'Back to tools' },
                { icon: 'solar:shield-user-outline', label: 'Access', onClick: () => setAccessModalOpen(true) }
              ]}
            />
          ) : (
            <CapsuleButton href="/workspace/tools" variant="secondary">Back</CapsuleButton>
          )}
          </div>
        }
        description={
          isFunction
            ? 'Define a function-style toolkit manifest and connect it to runtime controls.'
            : 'Define the tool manifest and connect it to an integration or runtime surface.'
        }
        label="Workspace"
        title={toolId ? `Edit ${isFunction ? 'function' : 'tool'}` : `Create ${isFunction ? 'function' : 'tool'}`}
      />

      {loading ? <p className="workspace-module-empty">Loading tool…</p> : null}
      {!loading ? (
        <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <WorkspaceToolManifestModal
            manifest={manifest}
            manifestSummary={manifestSummary}
            onApplyTemplate={applyManifestTemplate}
            onChange={setManifest}
            onClose={() => setManifestModalOpen(false)}
            open={manifestModalOpen}
          />
          <WorkspaceToolValvesModal
            onAddSchemaField={addValveSchemaField}
            onAddValve={addValve}
            onClose={() => setValvesModalOpen(false)}
            onRemoveSchemaField={removeValveSchemaField}
            onRemoveValve={removeValve}
            onUpdateSchemaField={updateValveSchemaField}
            onUpdateValve={updateValve}
            open={valvesModalOpen}
            schemaFieldCount={valveSchema.filter((field) => field.key.trim()).length}
            valveCount={valves.filter((valve) => valve.key.trim()).length}
            valveSchema={valveSchema}
            valves={valves}
          />
          <Field label="Name">
            <FieldInput onChange={(event) => setName(event.target.value)} required value={name} />
          </Field>
          <Field label="Description">
            <FieldInput onChange={(event) => setDescription(event.target.value)} value={description} />
          </Field>
          <Field label="Integration">
            <FieldSelect onChange={(event) => setIntegrationId(event.target.value)} value={integrationId}>
              <option value="">No integration</option>
              {integrations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
                ))}
            </FieldSelect>
          </Field>
          <Field label="Scopes">
            <FieldInput onChange={(event) => setScopes(event.target.value)} placeholder="chat, review" value={scopes} />
          </Field>
          <Field label="Tags">
            <FieldInput onChange={(event) => setTags(event.target.value)} placeholder="policy, retrieval" value={tags} />
          </Field>
          <label className="workspace-editor-checkbox">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            <span>Enabled</span>
          </label>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Manifest</strong></ResourceCardHeading>
              <span>Open a focused manifest editor instead of editing toolkit metadata inline.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{manifestSummary.name}</Tag>
              <Tag>{manifestSummary.entry}</Tag>
            </div>
            <div className="workspace-editor-actions">
              <CapsuleButton onClick={() => setManifestModalOpen(true)} type="button" variant="secondary">Open manifest editor</CapsuleButton>
            </div>
          </section>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Toolkit preview</strong></ResourceCardHeading>
              <span>Preview the structured tool payload before saving.</span>
            </ResourceCardCopy>
            <pre className="workspace-module-prompt-preview workspace-module-prompt-preview--large">
              {JSON.stringify(toolkitPreview, null, 2)}
            </pre>
          </section>
          {validationReport ? (
            <section className="workspace-editor-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Validation report</strong></ResourceCardHeading>
                <span>Manifest/schema/valves checks before saving toolkit changes.</span>
              </ResourceCardCopy>
              <div className="workspace-module-chip-row">
                <Tag>{validationReport.valid ? 'valid' : 'invalid'}</Tag>
                <Tag>{validationReport.errors.length} errors</Tag>
                <Tag>{validationReport.warnings.length} warnings</Tag>
                <Tag>{validationReport.schemaCoverage.schemaFields} schema fields</Tag>
                <Tag>{validationReport.schemaCoverage.valvesBound} valves bound</Tag>
              </div>
              {validationReport.errors.length > 0 ? (
                <FeedbackBanner variant="error">
                  {validationReport.errors.join(' | ')}
                </FeedbackBanner>
              ) : null}
              {validationReport.warnings.length > 0 ? (
                <FeedbackBanner variant="warning">
                  {validationReport.warnings.join(' | ')}
                </FeedbackBanner>
              ) : null}
            </section>
          ) : null}
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Runtime example payload</strong></ResourceCardHeading>
              <span>Preview how the first example and current valves resolve into a runnable toolkit payload.</span>
            </ResourceCardCopy>
            <pre className="workspace-module-prompt-preview workspace-module-prompt-preview--large">
              {JSON.stringify(
                {
                  tool: toolkitPreview.name,
                  integration: toolkitPreview.integration,
                  example: examples.find((example) => example.name || example.input || example.output) || null,
                  valves: toolkitPreview.valves,
                  schema: toolkitPreview.schema
                },
                null,
                2
              )}
            </pre>
          </section>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Examples</strong></ResourceCardHeading>
              <span>Document common tool invocations alongside runnable guidance.</span>
            </ResourceCardCopy>
            <div className="workspace-valve-list">
              {examples.map((example) => (
                <div key={example.id} className="workspace-valve-schema-row">
                  <FieldInput onChange={(event) => updateExample(example.id, { name: event.target.value })} placeholder="name" value={example.name} />
                  <FieldInput onChange={(event) => updateExample(example.id, { input: event.target.value })} placeholder="input" value={example.input} />
                  <FieldInput onChange={(event) => updateExample(example.id, { output: event.target.value })} placeholder="output" value={example.output} />
                  <TextButton danger onClick={() => removeExample(example.id)} type="button" variant="link">Remove</TextButton>
                </div>
              ))}
            </div>
            <div className="workspace-editor-actions">
              <CapsuleButton onClick={addExample} type="button" variant="secondary">Add example</CapsuleButton>
            </div>
          </section>
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Valves</strong></ResourceCardHeading>
              <span>Manage runtime values and schema in a focused modal flow.</span>
            </ResourceCardCopy>
            <div className="workspace-resource-detail-grid">
              <article className="workspace-resource-detail-card">
                <strong>Values</strong>
                <p>{valves.filter((valve) => valve.key.trim()).length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Schema fields</strong>
                <p>{valveSchema.filter((field) => field.key.trim()).length}</p>
              </article>
            </div>
            <div className="workspace-editor-actions">
              <CapsuleButton onClick={() => setValvesModalOpen(true)} type="button" variant="secondary">Open valves editor</CapsuleButton>
              <CapsuleButton onClick={applySchemaDefaultsToValves} type="button" variant="secondary">Apply schema defaults</CapsuleButton>
            </div>
          </section>
          {canManageModelBindings ? (
            <section className="workspace-editor-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Model bindings</strong></ResourceCardHeading>
                <span>Attach this {isFunction ? 'function' : 'tool'} to models and mark builtin mounting.</span>
              </ResourceCardCopy>
              <div className="workspace-module-chip-row">
                <Tag>{linkedModels.length} linked models</Tag>
                <Tag>{builtinModels.length} builtin mounts</Tag>
                {syncingBindings ? <Tag>syncing…</Tag> : null}
              </div>
              {models.length === 0 ? (
                <p className="workspace-module-empty">No models available for bindings.</p>
              ) : (
                <div className="workspace-valve-list">
                  {models.map((model) => (
                    <div key={model.id} className="workspace-valve-schema-row">
                      <div>
                        <strong>{model.name}</strong>
                        <p>{model.route}</p>
                      </div>
                      <label className="workspace-editor-checkbox">
                        <input
                          checked={linkedModelIds.includes(model.id)}
                          onChange={() => toggleLinkedModel(model.id)}
                          type="checkbox"
                        />
                        <span>Link</span>
                      </label>
                      <label className="workspace-editor-checkbox">
                        <input
                          checked={builtinModelIds.includes(model.id)}
                          onChange={() => toggleBuiltinModel(model.id)}
                          type="checkbox"
                        />
                        <span>Builtin</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
          <section className="workspace-editor-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Model binding graph</strong></ResourceCardHeading>
              <span>Operational view of where this toolkit is mounted across model routes.</span>
            </ResourceCardCopy>
            <div className="workspace-module-chip-row">
              <Tag>{integrationId || 'no integration'}</Tag>
              <Tag>{linkedModels.length} linked</Tag>
              <Tag>{builtinModels.length} builtin</Tag>
              <Tag>{toolkitPreview.schema.length} valves schema</Tag>
            </div>
            <div className="workspace-valve-list">
              {linkedModels.length === 0 ? (
                <p className="workspace-module-empty">No model routes currently linked to this toolkit.</p>
              ) : (
                linkedModels.map((model) => (
                  <div key={`graph-${model.id}`} className="workspace-valve-schema-row">
                    <span>{integrationId || 'runtime'}</span>
                    <span>&rarr;</span>
                    <strong>{name || 'unnamed toolkit'}</strong>
                    <span>&rarr;</span>
                    <span>{model.route}</span>
                    {builtinModelIds.includes(model.id) ? <Tag>builtin</Tag> : <Tag>optional</Tag>}
                  </div>
                ))
              )}
            </div>
          </section>
          <div className="workspace-editor-actions">
            <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Saving…' : toolId ? 'Save tool' : 'Create tool'}</CapsuleButton>
            <CapsuleButton onClick={() => router.push('/workspace/tools')} type="button" variant="secondary">Cancel</CapsuleButton>
          </div>
        </form>
      ) : null}
    </div>
  )
}
