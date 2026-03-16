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
  const [backgroundImageAssetId, setBackgroundImageAssetId] = useState<string | null>(null)
  const [defaultModelRoute, setDefaultModelRoute] = useState('')
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const filesInputRef = useRef<HTMLInputElement | null>(null)
  const title = mode === 'edit' ? 'Edit Project' : 'Create Project'
  const knowledgeHint = useMemo(() => {
    if (files.length > 0) {
      return 'Selected knowledge items are attached to this project and will flow into project-scoped chat context.'
    }
    return 'Upload files into workspace knowledge, then attach the items you want this project to use.'
  }, [files.length])

  useEffect(() => {
    if (!open) return
    setName(project?.name || '')
    setBackgroundImageUrl(project?.meta.backgroundImageUrl || null)
    setBackgroundImageAssetId(project?.meta.backgroundImageAssetId || null)
    setDescription(project?.meta.description || '')
    setIcon(project?.meta.icon || '')
    setColor(project?.meta.color || '#111111')
    setHiddenInSidebar(project?.meta.hiddenInSidebar || false)
    setSystemPrompt(project?.data.systemPrompt || '')
    setDefaultModelRoute(project?.data.defaultModelRoute || '')
    setFiles(project?.data.files || [])
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
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  return (
    <ModalShell closeLabel="Close project modal" dialogClassName="project-dialog project-modal" onClose={onClose} open={open} title={title}>
        <form
          className="project-modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
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
                  defaultModelRoute: defaultModelRoute || null,
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
              placeholder="Optional folder description"
              value={description}
            />
          </label>

          <div className="project-modal-meta-row">
            <label className="project-modal-field">
              <span>Icon</span>
              <input
                onChange={(event) => setIcon(event.target.value)}
                placeholder="solar:folder-with-files-outline"
                value={icon}
              />
            </label>

            <label className="project-modal-field">
              <span>Color</span>
              <input onChange={(event) => setColor(event.target.value)} type="color" value={color} />
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
              className="project-modal-inline-action"
              onClick={() => {
                if (backgroundImageUrl) {
                  setBackgroundImageUrl(null)
                  setBackgroundImageAssetId(null)
                  return
                }
                backgroundInputRef.current?.click()
              }}
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

          <label className="project-modal-field">
            <span>Default Model</span>
            <select onChange={(event) => setDefaultModelRoute(event.target.value)} value={defaultModelRoute}>
              <option value="">Use workspace default</option>
              {workspaceModels.map((model) => (
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

              setIsUploadingKnowledge(true)
              void Promise.all(
                nextFiles.map((file) =>
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
                                const existing = current.find((file) => file.knowledgeItemId === item.id)
                                if (existing) {
                                  return current.map((file) =>
                                    file.knowledgeItemId === item.id ? { ...file, selected: true } : file
                                  )
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
