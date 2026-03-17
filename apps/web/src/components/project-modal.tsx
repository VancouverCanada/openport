'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGroups,
  fetchProjectAccessGrants,
  fetchProjectKnowledge,
  fetchWorkspaceModels,
  loadSession,
  revokeProjectGrant,
  shareProject,
  uploadProjectAsset,
  uploadProjectKnowledge,
  type OpenPortProjectGrant,
  type OpenPortProjectKnowledgeItem,
  type OpenPortProjectPermission,
  type OpenPortProjectPrincipalType,
  type OpenPortWorkspaceGroup,
  type OpenPortWorkspaceModel
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import type {
  OpenPortProject,
  OpenPortProjectFile,
  OpenPortProjectInput
} from '../lib/chat-workspace'
import { Iconify } from './iconify'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'
import { TextButton } from './ui/text-button'

type ProjectModalProps = {
  mode: 'create' | 'edit'
  onClose: () => void
  onSubmit: (input: OpenPortProjectInput) => void | Promise<void>
  open: boolean
  parentProject?: OpenPortProject | null
  project?: OpenPortProject | null
}

function createFileRecordFromKnowledge(item: OpenPortProjectKnowledgeItem): OpenPortProjectFile {
  return {
    id: `file_${item.id}`,
    name: item.name,
    type: item.type,
    size: item.size,
    addedAt: Date.now(),
    selected: true,
    knowledgeItemId: item.id,
    assetId: item.assetId
  }
}

type ShareFormState = {
  principalType: OpenPortProjectPrincipalType
  principalId: string
  permission: OpenPortProjectPermission
}

const DEFAULT_SHARE_FORM: ShareFormState = {
  principalType: 'workspace',
  principalId: '',
  permission: 'write'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, payload = ''] = result.split(',', 2)
      resolve(payload)
    }
    reader.readAsDataURL(file)
  })
}

const DEFAULT_PROJECT_MAX_FILE_COUNT = 32

function resolveProjectMaxFileCount(): number {
  const rawValue = process.env.NEXT_PUBLIC_OPENPORT_PROJECT_MAX_FILE_COUNT
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROJECT_MAX_FILE_COUNT
  }
  return Math.floor(parsed)
}

const PROJECT_MAX_FILE_COUNT = resolveProjectMaxFileCount()

function normalizeModelRoutes(routes: string[]): string[] {
  const uniqueRoutes = new Set<string>()
  routes.forEach((route) => {
    const normalizedRoute = route.trim()
    if (!normalizedRoute) return
    uniqueRoutes.add(normalizedRoute)
  })
  return Array.from(uniqueRoutes)
}

const PROJECT_ICON_CHOICES = [
  'solar:folder-with-files-outline',
  'solar:folder-outline',
  'solar:chat-round-line-outline',
  'solar:notebook-outline',
  'solar:code-2-outline',
  'solar:database-outline',
  'solar:cpu-bolt-outline',
  'solar:cloud-outline',
  'solar:rocket-outline',
  'solar:planet-outline',
  'solar:shield-check-outline',
  'solar:lock-keyhole-outline',
  'solar:key-minimalistic-outline',
  'solar:settings-outline',
  'solar:magic-stick-3-outline',
  'solar:bolt-outline',
  'solar:star-outline',
  'solar:bookmark-outline',
  'solar:calendar-outline',
  'solar:document-text-outline',
  'solar:paperclip-outline',
  'solar:command-outline',
  'solar:hashtag-outline',
  'solar:graph-new-outline',
  'solar:chart-square-outline',
  'solar:tag-outline',
  'solar:palette-outline',
  'solar:layers-outline',
  'solar:box-outline',
  'solar:compass-outline'
] as const

const PROJECT_COLOR_PRESETS = [
  '#111111',
  '#0f172a',
  '#0b3b70',
  '#0a6b5c',
  '#1f7a1f',
  '#8a5a00',
  '#b42318',
  '#7a2e8d',
  '#1b3a57',
  '#334155',
  '#64748b',
  '#94a3b8'
] as const

export function ProjectModal({
  mode,
  onClose,
  onSubmit,
  open,
  parentProject = null,
  project = null
}: ProjectModalProps) {
  const [name, setName] = useState('')
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('#111111')
  const [hiddenInSidebar, setHiddenInSidebar] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [files, setFiles] = useState<OpenPortProjectFile[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [workspaceModels, setWorkspaceModels] = useState<OpenPortWorkspaceModel[]>([])
  const [accessGrants, setAccessGrants] = useState<OpenPortProjectGrant[]>([])
  const [groups, setGroups] = useState<OpenPortWorkspaceGroup[]>([])
  const [shareForm, setShareForm] = useState<ShareFormState>(DEFAULT_SHARE_FORM)
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false)
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false)
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false)
  const [isUploadingBackground, setIsUploadingBackground] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [iconQuery, setIconQuery] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [backgroundImageAssetId, setBackgroundImageAssetId] = useState<string | null>(null)
  const [defaultModelRoute, setDefaultModelRoute] = useState('')
  const [modelRoutes, setModelRoutes] = useState<string[]>([])
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const filesInputRef = useRef<HTMLInputElement | null>(null)
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const iconFieldRef = useRef<HTMLDivElement | null>(null)
  const colorFieldRef = useRef<HTMLDivElement | null>(null)
  const title = mode === 'edit' ? 'Edit Project' : 'Create Project'
  const selectedKnowledgeCount = useMemo(() => files.filter((file) => file.selected).length, [files])
  const selectedWorkspaceModels = useMemo(() => {
    const selected = new Set(modelRoutes)
    return workspaceModels.filter((model) => selected.has(model.route))
  }, [modelRoutes, workspaceModels])
  const knowledgeHint = useMemo(() => {
    if (files.length > 0) {
      return `Selected knowledge items are attached to this project and will flow into project-scoped chat context (${selectedKnowledgeCount}/${PROJECT_MAX_FILE_COUNT}).`
    }
    return `Upload files into workspace knowledge, then attach the items you want this project to use (max ${PROJECT_MAX_FILE_COUNT}).`
  }, [files.length, selectedKnowledgeCount])

  function updateModelRouteSelection(route: string, checked: boolean): void {
    setModelRoutes((current) => {
      const next = checked ? normalizeModelRoutes([...current, route]) : current.filter((item) => item !== route)
      setDefaultModelRoute((currentDefault) => {
        if (checked) {
          return currentDefault || route
        }
        if (currentDefault !== route) return currentDefault
        return next[0] || ''
      })
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const nextModelRoutes = normalizeModelRoutes([
      ...(Array.isArray(project?.data.modelRoutes) ? project?.data.modelRoutes : []),
      project?.data.defaultModelRoute || ''
    ])

    setName(project?.name || '')
    setBackgroundImageUrl(project?.meta.backgroundImageUrl || null)
    setBackgroundImageAssetId(project?.meta.backgroundImageAssetId || null)
    setDescription(project?.meta.description || '')
    setIcon(project?.meta.icon || '')
    setColor(project?.meta.color || '#111111')
    setHiddenInSidebar(project?.meta.hiddenInSidebar || false)
    setSystemPrompt(project?.data.systemPrompt || '')
    setModelRoutes(nextModelRoutes)
    setDefaultModelRoute(project?.data.defaultModelRoute || nextModelRoutes[0] || '')
    setFiles(project?.data.files || [])
    setShowIconPicker(false)
    setIconQuery('')
    setShowColorPicker(false)
    setShowKnowledgePicker(false)
    setIsSaving(false)
    setShareForm(DEFAULT_SHARE_FORM)
  }, [open, project])

  useEffect(() => {
    if (!open) return

    let isActive = true
    setIsLoadingKnowledge(true)
    void Promise.all([
      fetchProjectKnowledge(loadSession()),
      project?.id ? fetchProjectAccessGrants(project.id, loadSession()) : Promise.resolve({ items: [] }),
      fetchGroups(loadSession()),
      fetchWorkspaceModels(loadSession()).catch(() => ({ items: [] }))
    ])
      .then(([knowledgeResponse, grantsResponse, groupsResponse, modelsResponse]) => {
        if (!isActive) return
        setKnowledgeItems(knowledgeResponse.items)
        setAccessGrants(grantsResponse.items)
        setGroups(groupsResponse.items)
        setWorkspaceModels(modelsResponse.items)
      })
      .catch(() => {
        if (!isActive) return
        notify('error', 'Unable to load project settings.')
      })
      .finally(() => {
        if (!isActive) return
        setIsLoadingKnowledge(false)
      })

    return () => {
      isActive = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (showIconPicker) {
          setShowIconPicker(false)
          return
        }
        if (showColorPicker) {
          setShowColorPicker(false)
          return
        }
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, showColorPicker, showIconPicker])

  useEffect(() => {
    if (!open) return
    if (!showIconPicker && !showColorPicker) return

    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (showIconPicker && iconFieldRef.current && iconFieldRef.current.contains(target)) return
      if (showColorPicker && colorFieldRef.current && colorFieldRef.current.contains(target)) return
      setShowIconPicker(false)
      setShowColorPicker(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open, showColorPicker, showIconPicker])

  const filteredIcons = useMemo(() => {
    const query = iconQuery.trim().toLowerCase()
    if (!query) return PROJECT_ICON_CHOICES as readonly string[]
    return (PROJECT_ICON_CHOICES as readonly string[]).filter((entry) => entry.toLowerCase().includes(query))
  }, [iconQuery])

  return (
    <ModalShell closeLabel="Close project modal" dialogClassName="project-dialog project-modal" onClose={onClose} open={open} title={title}>
        <form
          className="project-modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            if (selectedKnowledgeCount > PROJECT_MAX_FILE_COUNT) {
              notify('error', `Maximum number of files per project is ${PROJECT_MAX_FILE_COUNT}.`)
              return
            }

            const normalizedModelRoutes = normalizeModelRoutes(modelRoutes)
            const resolvedDefaultModelRoute = (defaultModelRoute || normalizedModelRoutes[0] || '').trim() || null
            setIsSaving(true)

            void Promise.resolve(
              onSubmit({
                name,
                parentId: parentProject?.id ?? project?.parentId ?? null,
                meta: {
                  backgroundImageUrl,
                  backgroundImageAssetId,
                  description,
                  icon: icon || null,
                  color: color || null,
                  hiddenInSidebar
                },
                data: {
                  systemPrompt,
                  defaultModelRoute: resolvedDefaultModelRoute,
                  modelRoutes: normalizedModelRoutes,
                  files
                }
              })
            ).finally(() => {
              setIsSaving(false)
            })
          }}
        >
          <label className="project-modal-field">
            <span>Project Name</span>
            <input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter project name"
              value={name}
            />
          </label>

          <label className="project-modal-field">
            <span>Description</span>
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional project description"
              value={description}
            />
          </label>

          <div className="project-modal-meta-row">
            <label className="project-modal-field">
              <span>Icon</span>
              <div className="project-icon-field" ref={iconFieldRef}>
                <div className="project-icon-row">
                  <span className="project-icon-preview" aria-hidden="true">
                    <Iconify icon={icon || 'solar:folder-with-files-outline'} size={18} />
                  </span>
                  <TextButton
                    onClick={() => setShowIconPicker((current) => !current)}
                    size="sm"
                    type="button"
                    variant="inline"
                  >
                    <span>{icon ? 'Change icon' : 'Choose icon'}</span>
                  </TextButton>
                  {icon ? (
                    <TextButton
                      onClick={() => setIcon('')}
                      size="sm"
                      type="button"
                      variant="inline"
                    >
                      <span>Clear</span>
                    </TextButton>
                  ) : null}
                </div>

                {showIconPicker ? (
                  <div className="project-icon-picker" role="dialog" aria-label="Icon picker">
                    <div className="project-icon-picker-search">
                      <Iconify icon="solar:magnifer-outline" size={16} />
                      <input
                        onChange={(event) => setIconQuery(event.target.value)}
                        placeholder="Search icons"
                        value={iconQuery}
                      />
                      {iconQuery.trim() ? (
                        <button
                          aria-label="Clear icon search"
                          className="project-icon-picker-clear"
                          onClick={() => setIconQuery('')}
                          type="button"
                        >
                          <Iconify icon="solar:close-circle-outline" size={16} />
                        </button>
                      ) : null}
                    </div>

                    <div className="project-icon-picker-grid" role="listbox" aria-label="Project icon choices">
                      {filteredIcons.map((entry) => (
                        <button
                          aria-label={entry}
                          className={`project-icon-picker-item${entry === icon ? ' is-active' : ''}`}
                          key={entry}
                          onClick={() => {
                            setIcon(entry)
                            setShowIconPicker(false)
                          }}
                          type="button"
                        >
                          <Iconify icon={entry} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>

            <label className="project-modal-field">
              <span>Color</span>
              <div className="project-color-field" ref={colorFieldRef}>
                <button
                  aria-label="Choose project color"
                  className="project-color-dot"
                  onClick={() => setShowColorPicker((current) => !current)}
                  type="button"
                >
                  <span className="project-color-dot-fill" style={{ backgroundColor: color }} />
                </button>
                <input
                  ref={colorInputRef}
                  aria-label="Project color picker"
                  className="project-color-input"
                  onChange={(event) => setColor(event.target.value)}
                  type="color"
                  value={color}
                />

                {showColorPicker ? (
                  <div className="project-color-picker" role="dialog" aria-label="Color picker">
                    <div className="project-color-presets" role="listbox" aria-label="Preset colors">
                      {PROJECT_COLOR_PRESETS.map((preset) => (
                        <button
                          aria-label={`Set color ${preset}`}
                          className={`project-color-preset${preset.toLowerCase() === color.toLowerCase() ? ' is-active' : ''}`}
                          key={preset}
                          onClick={() => {
                            setColor(preset)
                            setShowColorPicker(false)
                          }}
                          type="button"
                        >
                          <span className="project-color-preset-fill" style={{ backgroundColor: preset }} />
                        </button>
                      ))}
                    </div>

                    <div className="project-color-picker-actions">
                      <TextButton
                        onClick={() => colorInputRef.current?.click()}
                        size="sm"
                        type="button"
                        variant="inline"
                      >
                        <span>Custom…</span>
                      </TextButton>
                      <TextButton
                        onClick={() => {
                          setColor('#111111')
                          setShowColorPicker(false)
                        }}
                        size="sm"
                        type="button"
                        variant="inline"
                      >
                        <span>Reset</span>
                      </TextButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
          </div>

          <label className="project-modal-checkbox">
            <input checked={hiddenInSidebar} onChange={(event) => setHiddenInSidebar(event.target.checked)} type="checkbox" />
            <span>Hide this project from the sidebar</span>
          </label>

          <input
            ref={backgroundInputRef}
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setIsUploadingBackground(true)
              void fileToBase64(file)
                .then((contentBase64) =>
                  uploadProjectAsset(
                    {
                      kind: 'background',
                      name: file.name,
                      type: file.type || 'application/octet-stream',
                      size: file.size,
                      contentBase64
                    },
                    loadSession()
                  )
                )
                .then(({ asset }) => {
                  setBackgroundImageUrl(asset.contentUrl)
                  setBackgroundImageAssetId(asset.id)
                  notify('success', 'Background image uploaded.')
                })
                .catch(() => {
                  notify('error', 'Unable to upload background image.')
                })
                .finally(() => {
                  setIsUploadingBackground(false)
                })
            }}
            type="file"
          />

          <div className="project-modal-field">
            <span>Project Background Image</span>
            <TextButton
              className="project-modal-subaction"
              onClick={() => {
                if (backgroundImageUrl) {
                  setBackgroundImageUrl(null)
                  setBackgroundImageAssetId(null)
                  return
                }
                backgroundInputRef.current?.click()
              }}
              size="sm"
              variant="inline"
              type="button"
            >
              {isUploadingBackground ? 'Uploading...' : backgroundImageUrl ? 'Reset' : 'Upload'}
            </TextButton>
          </div>

          {backgroundImageUrl ? (
            <div className="project-modal-image-preview">
              <img alt="Project background preview" src={backgroundImageUrl} />
            </div>
          ) : null}

          <label className="project-modal-field">
            <span>System Prompt</span>
            <textarea
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="Write your model system prompt content here."
              value={systemPrompt}
            />
          </label>

          <div className="project-modal-knowledge">
            <div className="project-modal-field">
              <span>Project Models</span>
            </div>

            <div className="project-modal-files">
              {workspaceModels.length > 0 ? (
                workspaceModels.map((model) => {
                  const checked = modelRoutes.includes(model.route)
                  return (
                    <label key={model.id} className="project-modal-file-row">
                      <input
                        checked={checked}
                        onChange={(event) => {
                          updateModelRouteSelection(model.route, event.target.checked)
                        }}
                        type="checkbox"
                      />
                      <span>{model.name}</span>
                      <small>{model.route}</small>
                    </label>
                  )
                })
              ) : (
                <div className="project-modal-empty">No workspace models yet.</div>
              )}
            </div>

            <p className="project-modal-hint">
              Projects can scope multiple models. The primary model is used when opening a new chat inside this project.
            </p>
          </div>

          <label className="project-modal-field">
            <span>Primary Model</span>
            <select
              disabled={selectedWorkspaceModels.length === 0}
              onChange={(event) => setDefaultModelRoute(event.target.value)}
              value={defaultModelRoute}
            >
              <option value="">Use workspace default</option>
              {selectedWorkspaceModels.map((model) => (
                <option key={model.id} value={model.route}>
                  {model.name} ({model.route})
                </option>
              ))}
            </select>
          </label>

          <input
            ref={filesInputRef}
            hidden
            multiple
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files || [])
              if (nextFiles.length === 0) return
              const availableSlots = PROJECT_MAX_FILE_COUNT - selectedKnowledgeCount
              if (availableSlots <= 0) {
                notify('error', `Maximum number of files per project is ${PROJECT_MAX_FILE_COUNT}.`)
                return
              }

              const filesForUpload = nextFiles.slice(0, availableSlots)
              if (filesForUpload.length < nextFiles.length) {
                notify('error', `Only ${filesForUpload.length} file(s) were added (max ${PROJECT_MAX_FILE_COUNT} per project).`)
              }

              setIsUploadingKnowledge(true)
              void Promise.all(
                filesForUpload.map((file) =>
                  fileToBase64(file).then((contentBase64) =>
                    uploadProjectKnowledge(
                      {
                        name: file.name,
                        type: file.type || 'application/octet-stream',
                        size: file.size,
                        contentBase64
                      },
                      loadSession()
                    )
                  )
                )
              )
                .then((responses) => {
                  const uploadedItems = responses.map((response) => response.item)
                  setKnowledgeItems((current) => [...uploadedItems, ...current])
                  setFiles((current) => [
                    ...current,
                    ...uploadedItems.map((item) => createFileRecordFromKnowledge(item))
                  ])
                  setShowKnowledgePicker(true)
                  notify('success', uploadedItems.length > 1 ? 'Knowledge items uploaded.' : 'Knowledge item uploaded.')
                })
                .catch(() => {
                  notify('error', 'Unable to upload project knowledge.')
                })
                .finally(() => {
                  setIsUploadingKnowledge(false)
                })
            }}
            type="file"
          />

          <div className="project-modal-knowledge">
            <div className="project-modal-field">
              <span>Knowledge</span>
            </div>

            <div className="project-modal-knowledge-actions">
              <CapsuleButton onClick={() => setShowKnowledgePicker((current) => !current)} type="button" variant="secondary">
                Select Knowledge
              </CapsuleButton>
              <CapsuleButton disabled={isUploadingKnowledge} onClick={() => filesInputRef.current?.click()} type="button" variant="secondary">
                {isUploadingKnowledge ? 'Uploading...' : 'Upload Files'}
              </CapsuleButton>
            </div>

            <p className="project-modal-hint">{knowledgeHint}</p>

            {showKnowledgePicker ? (
              <div className="project-modal-files">
                {isLoadingKnowledge ? (
                  <div className="project-modal-empty">Loading knowledge…</div>
                ) : knowledgeItems.length > 0 ? (
                  knowledgeItems.map((item) => {
                    const selected = files.some((file) => file.knowledgeItemId === item.id && file.selected)

                    return (
                      <label key={item.id} className="project-modal-file-row">
                        <input
                          checked={selected}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setFiles((current) => {
                                const selectedCount = current.filter((file) => file.selected).length
                                const existing = current.find((file) => file.knowledgeItemId === item.id)
                                if (existing) {
                                  if (!existing.selected && selectedCount >= PROJECT_MAX_FILE_COUNT) {
                                    notify('error', `Maximum number of files per project is ${PROJECT_MAX_FILE_COUNT}.`)
                                    return current
                                  }
                                  return current.map((file) =>
                                    file.knowledgeItemId === item.id ? { ...file, selected: true } : file
                                  )
                                }

                                if (selectedCount >= PROJECT_MAX_FILE_COUNT) {
                                  notify('error', `Maximum number of files per project is ${PROJECT_MAX_FILE_COUNT}.`)
                                  return current
                                }

                                return [...current, createFileRecordFromKnowledge(item)]
                              })
                              return
                            }

                            setFiles((current) =>
                              current.map((file) =>
                                file.knowledgeItemId === item.id ? { ...file, selected: false } : file
                              )
                            )
                          }}
                          type="checkbox"
                        />
                        <span>{item.name}</span>
                        <small>{item.retrievalState === 'indexed' ? `Indexed · ${item.chunkCount} chunks` : 'Binary only'}</small>
                        <TextButton
                          className="project-modal-file-remove"
                          onClick={() =>
                            setFiles((current) => current.filter((file) => file.knowledgeItemId !== item.id))
                          }
                          danger
                          variant="link"
                          type="button"
                        >
                          Remove
                        </TextButton>
                      </label>
                    )
                  })
                ) : (
                  <div className="project-modal-empty">No workspace knowledge yet.</div>
                )}
              </div>
            ) : null}
          </div>

          {mode === 'edit' && project ? (
            <div className="project-modal-knowledge">
              <div className="project-modal-field">
                <span>Access</span>
              </div>

              <div className="project-modal-files">
                {accessGrants.length > 0 ? (
                  accessGrants.map((grant) => (
                    <div key={grant.id} className="project-modal-file-row">
                      <span>
                        {grant.principalType === 'public'
                          ? 'Public'
                          : grant.principalType === 'group'
                            ? groups.find((group) => group.id === grant.principalId)?.name || grant.principalId
                            : grant.principalId}
                      </span>
                      <small>{grant.permission}</small>
                      <TextButton
                        className="project-modal-file-remove"
                        onClick={() => {
                          void revokeProjectGrant(project.id, grant.id, loadSession())
                            .then(async () => {
                              const response = await fetchProjectAccessGrants(project.id, loadSession())
                              setAccessGrants(response.items)
                              notify('success', 'Access grant removed.')
                            })
                            .catch(() => {
                              notify('error', 'Unable to remove access grant.')
                            })
                        }}
                        danger
                        variant="link"
                        type="button"
                      >
                        Remove
                      </TextButton>
                    </div>
                  ))
                ) : (
                  <div className="project-modal-empty">No extra access grants yet.</div>
                )}
              </div>

              <div className="note-share-form project-share-form">
                <select
                  aria-label="Project share principal type"
                  onChange={(event) =>
                    setShareForm((current) => ({
                      ...current,
                      principalType: event.target.value as OpenPortProjectPrincipalType
                    }))
                  }
                  value={shareForm.principalType}
                >
                  <option value="workspace">Workspace</option>
                  <option value="user">User</option>
                  <option value="group">Group</option>
                  <option value="public">Public</option>
                </select>
                {shareForm.principalType !== 'public' ? (
                  shareForm.principalType === 'group' ? (
                    <select
                      aria-label="Project share group id"
                      onChange={(event) =>
                        setShareForm((current) => ({
                          ...current,
                          principalId: event.target.value
                        }))
                      }
                      value={shareForm.principalId}
                    >
                      <option value="">Select group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label="Project share principal id"
                      onChange={(event) =>
                        setShareForm((current) => ({
                          ...current,
                          principalId: event.target.value
                        }))
                      }
                      placeholder={shareForm.principalType === 'workspace' ? project.workspaceId : 'User ID'}
                      type="text"
                      value={shareForm.principalId}
                    />
                  )
                ) : null}
                <select
                  aria-label="Project share permission"
                  onChange={(event) =>
                    setShareForm((current) => ({
                      ...current,
                      permission: event.target.value as OpenPortProjectPermission
                    }))
                  }
                  value={shareForm.permission}
                >
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="admin">Admin</option>
                </select>
                <CapsuleButton
                  onClick={() => {
                    void shareProject(
                      project.id,
                      {
                        principalType: shareForm.principalType,
                        principalId:
                          shareForm.principalType === 'workspace'
                            ? shareForm.principalId.trim() || project.workspaceId
                            : shareForm.principalType === 'public'
                              ? '*'
                              : shareForm.principalId.trim(),
                        permission: shareForm.permission
                      },
                      loadSession()
                    )
                      .then(async () => {
                        const response = await fetchProjectAccessGrants(project.id, loadSession())
                        setAccessGrants(response.items)
                        setShareForm(DEFAULT_SHARE_FORM)
                        notify('success', 'Access grant updated.')
                      })
                      .catch(() => {
                        notify('error', 'Unable to update access grant.')
                      })
                  }}
                  type="button"
                  variant="secondary"
                >
                  Add grant
                </CapsuleButton>
              </div>
            </div>
          ) : null}

          <div className="project-modal-actions">
            <CapsuleButton disabled={isSaving} type="submit" variant="primary">
              {isSaving ? 'Saving...' : 'Save'}
            </CapsuleButton>
          </div>
        </form>
    </ModalShell>
  )
}
