'use client'

import { useEffect, useState } from 'react'
import type {
  OpenPortChatSettings,
  OpenPortProjectCollaborationState,
  OpenPortProjectKnowledgeMatch,
  OpenPortWorkspaceModel
} from '@openport/product-contracts'
import {
  getDefaultChatSettings,
  getProjectOptions,
  getWorkspaceEventName,
  loadProjects,
  type OpenPortProject
} from '../lib/chat-workspace'
import { getModelRouteSource, getSystemPromptSource } from '../lib/chat-defaults'
import type { OpenPortChatUiPreferences } from '../lib/chat-ui-preferences'
import { loadSession, updateChatSessionMeta, updateChatSessionSettings } from '../lib/openport-api'
import { Iconify } from './iconify'
import { ControlsSection } from './ui/controls-section'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

type ChatControlsPanelProps = {
  activeArchived?: boolean
  activeThreadId: string | null
  activePinned?: boolean
  activeProject?: OpenPortProject | null
  collaboration?: OpenPortProjectCollaborationState | null
  composerAttachments?: Array<{
    id: string
    label: string
    meta?: string
    type: string
  }>
  selectedProjectId: string | null
  initialSettings?: OpenPortChatSettings | null
  initialTags?: string[]
  models?: OpenPortWorkspaceModel[]
  onArchiveToggle?: () => void
  isSearchingKnowledge?: boolean
  knowledgeMatches?: OpenPortProjectKnowledgeMatch[]
  onComposerAttachmentRemove?: (id: string) => void
  onSettingsChange?: (settings: OpenPortChatSettings) => void
  onPinToggle?: () => void
  onTagsChange?: (tags: string[]) => void
  onClose?: () => void
  uiPreferences?: OpenPortChatUiPreferences
}

const operatorModeOptions = [
  { label: 'Default', value: 'default' },
  { label: 'Review', value: 'review' },
  { label: 'Strict', value: 'strict' }
]

const reasoningEffortOptions: OpenPortChatSettings['params']['reasoningEffort'][] = ['low', 'medium', 'high']

export function ChatControlsPanel({
  activeArchived = false,
  activeThreadId,
  activePinned = false,
  activeProject = null,
  collaboration = null,
  composerAttachments = [],
  selectedProjectId,
  initialSettings,
  initialTags,
  models = [],
  onArchiveToggle,
  isSearchingKnowledge = false,
  knowledgeMatches = [],
  onComposerAttachmentRemove,
  onSettingsChange,
  onPinToggle,
  onTagsChange,
  onClose,
  uiPreferences
}: ChatControlsPanelProps) {
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [settings, setSettings] = useState<OpenPortChatSettings>(getDefaultChatSettings(selectedProjectId))
  const [tagsDraft, setTagsDraft] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [showValves, setShowValves] = useState(false)
  const [showSystemPrompt, setShowSystemPrompt] = useState(true)
  const [showAdvancedParams, setShowAdvancedParams] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const projectOptions = getProjectOptions(projects)
  const contextProject =
    activeProject || (settings.projectId ? projects.find((project) => project.id === settings.projectId) || null : null)
  const modelRouteSource = uiPreferences
    ? getModelRouteSource(settings.valves.modelRoute, contextProject, uiPreferences, models)
    : 'chat'
  const systemPromptSource = uiPreferences
    ? getSystemPromptSource(settings.systemPrompt, contextProject, uiPreferences)
    : 'chat'

  useEffect(() => {
    const nextProjects = loadProjects()
    setProjects(nextProjects)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const getOpen = (key: string, fallback: boolean): boolean => {
      const value = window.localStorage.getItem(`openport.chat-controls.${key}`)
      return value === null ? fallback : value === 'true'
    }

    setShowFiles(getOpen('files', composerAttachments.length > 0))
    setShowValves(getOpen('valves', false))
    setShowSystemPrompt(getOpen('systemPrompt', true))
    setShowAdvancedParams(getOpen('advancedParams', false))
    setShowContext(getOpen('context', false))
  }, [composerAttachments.length])

  useEffect(() => {
    if (!activeThreadId) {
      setSettings(getDefaultChatSettings(selectedProjectId))
      setTagsDraft('')
      return
    }

    setSettings({
      ...getDefaultChatSettings(selectedProjectId),
      ...(initialSettings || {}),
      projectId: initialSettings?.projectId ?? selectedProjectId ?? null
    })
    setTagsDraft((initialTags || []).join(', '))
  }, [activeThreadId, initialSettings, initialTags, selectedProjectId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleWorkspaceUpdate = () => {
      setProjects(loadProjects())
    }

    window.addEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
    return () => {
      window.removeEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
    }
  }, [])

  useEffect(() => {
    if (composerAttachments.length === 0) return
    setShowFiles(true)
  }, [composerAttachments.length])

  function patchSettings(nextSettings: OpenPortChatSettings): void {
    setSettings(nextSettings)
    onSettingsChange?.(nextSettings)
    if (!activeThreadId) return

    void updateChatSessionSettings(activeThreadId, nextSettings, loadSession())
      .then(({ session }) => {
        setSettings(session.settings)
        onSettingsChange?.(session.settings)
      })
      .catch(() => undefined)
  }

  function persistOpenState(key: string, open: boolean): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`openport.chat-controls.${key}`, String(open))
  }

  function updateProject(projectId: string | null): void {
    const nextSettings = { ...settings, projectId }
    patchSettings(nextSettings)
  }

  function updateTags(nextTags: string[]): void {
    setTagsDraft(nextTags.join(', '))
    onTagsChange?.(nextTags)
    if (!activeThreadId) return

    void updateChatSessionMeta(activeThreadId, { tags: nextTags }, loadSession())
      .then(({ session }) => {
        setTagsDraft(session.tags.join(', '))
        onTagsChange?.(session.tags)
      })
      .catch(() => undefined)
  }

  return (
    <aside className="chat-controls" aria-label="Chat controls">
      <div className="chat-controls-header">
        <div className="chat-controls-header-title">
          <Iconify icon="solar:tuning-4-outline" size={18} />
          <h2>Controls</h2>
        </div>
        {onClose ? (
          <IconButton aria-label="Close controls" className="chat-controls-close" onClick={onClose} size="md" type="button" variant="ghost">
            <Iconify icon="solar:close-outline" size={18} />
          </IconButton>
        ) : null}
      </div>

      <div className="chat-controls-intro">
        <span>{activeThreadId ? 'Session' : 'Draft'}</span>
        {activeThreadId ? (
          <div className="chat-controls-actions">
            <TextButton onClick={onPinToggle} size="sm" type="button" variant="inline">
              <Iconify icon={activePinned ? 'solar:pin-bold' : 'solar:pin-outline'} size={15} />
              <span>{activePinned ? 'Pinned' : 'Pin'}</span>
            </TextButton>
            <TextButton onClick={onArchiveToggle} size="sm" type="button" variant="inline">
              <Iconify icon={activeArchived ? 'solar:archive-bold' : 'solar:archive-outline'} size={15} />
              <span>{activeArchived ? 'Restore' : 'Archive'}</span>
            </TextButton>
          </div>
        ) : null}
      </div>

      {composerAttachments.length > 0 ? (
        <ControlsSection
          icon="solar:paperclip-outline"
          onToggle={() =>
            setShowFiles((current) => {
              const next = !current
              persistOpenState('files', next)
              return next
            })
          }
          open={showFiles}
          title="Files"
        >
          <div className="chat-controls-files">
            {composerAttachments.map((attachment) => (
              <div className="chat-controls-file-item" key={`${attachment.type}-${attachment.id}`}>
                <div className="chat-controls-file-copy">
                  <strong>{attachment.label}</strong>
                  {attachment.meta ? <span>{attachment.meta}</span> : null}
                </div>
                {onComposerAttachmentRemove ? (
                  <IconButton
                    aria-label={`Remove ${attachment.label}`}
                    onClick={() => onComposerAttachmentRemove(attachment.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Iconify icon="solar:close-outline" size={14} />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
        </ControlsSection>
      ) : null}

      <ControlsSection
        icon="solar:widget-5-outline"
        onToggle={() =>
          setShowValves((current) => {
            const next = !current
            persistOpenState('valves', next)
            return next
          })
        }
        open={showValves}
        title="Valves"
      >
        <div className="chat-controls-form-grid">
          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Model route</span>
            {models.length > 0 ? (
              <select
                className="chat-controls-select"
                id="chat-model-route-input"
                onChange={(event) =>
                  patchSettings({
                    ...settings,
                    valves: { ...settings.valves, modelRoute: event.target.value }
                  })
                }
                value={settings.valves.modelRoute}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.route}>
                    {model.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="chat-controls-input"
                id="chat-model-route-input"
                onChange={(event) =>
                  patchSettings({
                    ...settings,
                    valves: { ...settings.valves, modelRoute: event.target.value }
                  })
                }
                value={settings.valves.modelRoute}
              />
            )}
            <div className="chat-controls-subactions">
              <small className="chat-controls-field-meta">Source: {modelRouteSource}</small>
              {uiPreferences ? (
                <TextButton
                  onClick={() =>
                    patchSettings({
                      ...settings,
                      valves: {
                        ...settings.valves,
                        modelRoute:
                          contextProject?.data.defaultModelRoute ||
                          uiPreferences.chatDefaults.modelRoute ||
                          models.find((model) => model.isDefault)?.route ||
                          'openport/local'
                      }
                    })
                  }
                  size="sm"
                  type="button"
                  variant="inline"
                >
                  Reset
                </TextButton>
              ) : null}
            </div>
          </label>

          <label className="chat-controls-field chat-controls-switch">
            <span className="chat-controls-field-label">Function calling</span>
            <input
              checked={settings.valves.functionCalling}
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  valves: { ...settings.valves, functionCalling: event.target.checked }
                })
              }
              type="checkbox"
            />
          </label>
        </div>
      </ControlsSection>

      {contextProject || activeThreadId ? (
        <ControlsSection
          icon="solar:folder-with-files-outline"
          onToggle={() =>
            setShowContext((current) => {
              const next = !current
              persistOpenState('context', next)
              return next
            })
          }
          open={showContext}
          title="Context"
        >
          <div className="chat-controls-form-grid">
            <label className="chat-controls-field">
              <span className="chat-controls-field-label">Project</span>
              <select
                className="chat-controls-select"
                onChange={(event) => updateProject(event.target.value || null)}
                value={settings.projectId || ''}
              >
                <option value="">No project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="chat-controls-field">
              <span className="chat-controls-field-label">Tags</span>
              <input
                className="chat-controls-input"
                onBlur={() =>
                  updateTags(
                    tagsDraft
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  )
                }
                onChange={(event) => setTagsDraft(event.target.value)}
                placeholder="security, review"
                value={tagsDraft}
              />
            </label>

            {contextProject ? (
              <div className="chat-controls-field chat-controls-project-context">
                <span className="chat-controls-field-label">Attached project</span>
                <div className="chat-controls-project-context-copy">
                  <strong>{contextProject.name}</strong>
                  <span>{contextProject.meta.description || `${contextProject.data.files.filter((file) => file.selected).length} knowledge items available`}</span>
                </div>
              </div>
            ) : null}

            {contextProject && (collaboration || isSearchingKnowledge || knowledgeMatches.length > 0) ? (
              <div className="chat-controls-field chat-controls-project-context">
                <span className="chat-controls-field-label">Live context</span>
                <div className="chat-controls-project-context-copy">
                  <strong>
                    {isSearchingKnowledge
                      ? 'Searching attached knowledge'
                      : knowledgeMatches.length
                        ? `${knowledgeMatches.length} knowledge matches`
                        : collaboration?.activeUsers.length
                          ? `${collaboration.activeUsers.length} collaborators active`
                          : 'Context ready'}
                  </strong>
                  <span>
                    {knowledgeMatches.length
                      ? knowledgeMatches
                          .slice(0, 2)
                          .map((match) => match.itemName)
                          .join(', ')
                      : collaboration?.activeUsers.length
                        ? collaboration.activeUsers.map((presence) => presence.name).join(', ')
                        : 'Project context will be used as you draft and send.'}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </ControlsSection>
      ) : null}

      <ControlsSection
        icon="solar:document-text-outline"
        onToggle={() =>
          setShowSystemPrompt((current) => {
            const next = !current
            persistOpenState('systemPrompt', next)
            return next
          })
        }
        open={showSystemPrompt}
        title="System Prompt"
      >
        <textarea
          aria-label="System prompt"
          className="chat-controls-textarea"
          onChange={(event) =>
            patchSettings({
              ...settings,
              systemPrompt: event.target.value
            })
          }
          placeholder="Enter system prompt"
          value={settings.systemPrompt}
        />
        <div className="chat-controls-subactions">
          <small className="chat-controls-field-meta">Source: {systemPromptSource}</small>
          {uiPreferences ? (
            <TextButton
              onClick={() =>
                patchSettings({
                  ...settings,
                  systemPrompt:
                    contextProject?.data.systemPrompt ||
                    uiPreferences.chatDefaults.systemPrompt ||
                    ''
                })
              }
              size="sm"
              type="button"
              variant="inline"
            >
              Reset
            </TextButton>
          ) : null}
        </div>
      </ControlsSection>

      <ControlsSection
        icon="solar:slider-horizontal-outline"
        onToggle={() =>
          setShowAdvancedParams((current) => {
            const next = !current
            persistOpenState('advancedParams', next)
            return next
          })
        }
        open={showAdvancedParams}
        title="Advanced Params"
      >
        <div className="chat-controls-form-grid">
          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Operator mode</span>
            <select
              className="chat-controls-select"
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  valves: { ...settings.valves, operatorMode: event.target.value }
                })
              }
              value={settings.valves.operatorMode}
            >
              {operatorModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="chat-controls-field chat-controls-switch">
            <span className="chat-controls-field-label">Stream response</span>
            <input
              checked={settings.params.streamResponse}
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  params: { ...settings.params, streamResponse: event.target.checked }
                })
              }
              type="checkbox"
            />
          </label>

          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Reasoning effort</span>
            <select
              className="chat-controls-select"
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  params: {
                    ...settings.params,
                    reasoningEffort: event.target.value as OpenPortChatSettings['params']['reasoningEffort']
                  }
                })
              }
              value={settings.params.reasoningEffort}
            >
              {reasoningEffortOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Temperature</span>
            <input
              className="chat-controls-input"
              max="2"
              min="0"
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  params: { ...settings.params, temperature: Number(event.target.value) }
                })
              }
              step="0.1"
              type="number"
              value={settings.params.temperature}
            />
          </label>

          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Max tokens</span>
            <input
              className="chat-controls-input"
              min="1"
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  params: { ...settings.params, maxTokens: Number(event.target.value) }
                })
              }
              step="1"
              type="number"
              value={settings.params.maxTokens}
            />
          </label>

          <label className="chat-controls-field">
            <span className="chat-controls-field-label">Top p</span>
            <input
              className="chat-controls-input"
              max="1"
              min="0"
              onChange={(event) =>
                patchSettings({
                  ...settings,
                  params: { ...settings.params, topP: Number(event.target.value) }
                })
              }
              step="0.1"
              type="number"
              value={settings.params.topP}
            />
          </label>
        </div>
      </ControlsSection>
    </aside>
  )
}
