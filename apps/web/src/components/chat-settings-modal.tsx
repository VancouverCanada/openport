'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  archiveAllChatSessions,
  deleteAllChatSessions,
  exportChatSessions,
  fetchBootstrap,
  fetchChatSessions,
  fetchCurrentUser,
  fetchWorkspaceModels,
  importChatSessions,
  type OpenPortSession,
  type OpenPortWorkspaceModel
} from '../lib/openport-api'
import {
  getChatUiPreferencesEventName,
  loadChatUiPreferences,
  setSidebarSectionState,
  updateChatDefaults,
  type OpenPortChatUiPreferences
} from '../lib/chat-ui-preferences'
import { ConfirmDialog } from './confirm-dialog'
import { ChatFilesModal } from './chat-files-modal'
import { Iconify } from './iconify'
import { FeedbackBanner } from './ui/feedback-banner'
import { ModalShell } from './ui/modal-shell'
import { TextButton } from './ui/text-button'

type ChatSettingsModalProps = {
  onClose: () => void
  onOpenShortcuts?: () => void
  open: boolean
  session: OpenPortSession | null
}

type SettingsSection = 'general' | 'interface' | 'personalization' | 'connections' | 'integrations' | 'data' | 'about'

type SettingsTab = {
  id: SettingsSection
  icon: string
  title: string
  keywords: string[]
}

const settingsTabs: SettingsTab[] = [
  { id: 'general', icon: 'solar:user-circle-outline', title: 'General', keywords: ['general', 'account', 'access', 'user', 'shortcuts'] },
  { id: 'interface', icon: 'solar:settings-outline', title: 'Interface', keywords: ['interface', 'layout', 'sidebar', 'controls', 'models'] },
  { id: 'connections', icon: 'solar:link-outline', title: 'Connections', keywords: ['connections', 'providers', 'routing', 'runtime', 'models'] },
  { id: 'integrations', icon: 'solar:widget-5-outline', title: 'Integrations', keywords: ['integrations', 'tools', 'knowledge', 'prompts', 'workspace'] },
  { id: 'personalization', icon: 'solar:palette-outline', title: 'Personalization', keywords: ['personalization', 'sidebar', 'home', 'models', 'sections'] },
  { id: 'data', icon: 'solar:database-outline', title: 'Data', keywords: ['data', 'archive', 'export', 'sessions', 'history'] },
  { id: 'about', icon: 'solar:info-circle-outline', title: 'About', keywords: ['about', 'openwebui', 'reference', 'releases'] }
]

export function ChatSettingsModal({ onClose, onOpenShortcuts, open, session }: ChatSettingsModalProps) {
  const [section, setSection] = useState<SettingsSection>('general')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Loading runtime status…')
  const [moduleCount, setModuleCount] = useState(0)
  const [activeChatsCount, setActiveChatsCount] = useState(0)
  const [archivedChatsCount, setArchivedChatsCount] = useState(0)
  const [dataFeedback, setDataFeedback] = useState<{ message: string; variant: 'error' | 'success' | 'info' } | null>(null)
  const [pendingDataAction, setPendingDataAction] = useState<null | 'archive-all' | 'delete-all'>(null)
  const [isPerformingDataAction, setIsPerformingDataAction] = useState(false)
  const [displayName, setDisplayName] = useState(session?.name || 'OpenPort operator')
  const [displayEmail, setDisplayEmail] = useState(session?.email || 'No signed-in user')
  const [workspaceModels, setWorkspaceModels] = useState<OpenPortWorkspaceModel[]>([])
  const [uiPreferences, setUiPreferences] = useState<OpenPortChatUiPreferences>(loadChatUiPreferences())
  const [showFilesModal, setShowFilesModal] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  async function refreshChatDataSummary(activeSession: OpenPortSession): Promise<void> {
    const [activeResponse, archivedResponse] = await Promise.all([
      fetchChatSessions({ archived: false }, activeSession).catch(() => ({ items: [] })),
      fetchChatSessions({ archived: true }, activeSession).catch(() => ({ items: [] }))
    ])
    setActiveChatsCount(activeResponse.items.length)
    setArchivedChatsCount(archivedResponse.items.length)
  }

  useEffect(() => {
    if (!open || !session) return
    let cancelled = false

    void Promise.all([
      fetchBootstrap(session).catch(() => null),
      fetchCurrentUser(session).catch(() => null),
      fetchWorkspaceModels(session).catch(() => ({ items: [] })),
      Promise.all([
        fetchChatSessions({ archived: false }, session).catch(() => ({ items: [] })),
        fetchChatSessions({ archived: true }, session).catch(() => ({ items: [] }))
      ])
    ]).then(([bootstrap, currentUser, modelsResponse, chatResponses]) => {
      if (cancelled) return
      if (bootstrap) {
        setStatus(typeof bootstrap.runtime.status === 'string' ? bootstrap.runtime.status : 'Available')
        setModuleCount(bootstrap.modules.length)
      } else {
        setStatus('Unavailable')
        setModuleCount(0)
      }

      if (currentUser) {
        setDisplayName(currentUser.user.name)
        setDisplayEmail(currentUser.user.email)
      }

      setWorkspaceModels(modelsResponse.items)
      setActiveChatsCount(chatResponses[0].items.length)
      setArchivedChatsCount(chatResponses[1].items.length)
    })

    return () => {
      cancelled = true
    }
  }, [open, session])

  const filteredTabs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return settingsTabs
    return settingsTabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(normalizedQuery) ||
        tab.keywords.some((keyword) => keyword.includes(normalizedQuery))
    )
  }, [query])

  useEffect(() => {
    setUiPreferences(loadChatUiPreferences())
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePreferencesUpdate = () => setUiPreferences(loadChatUiPreferences())
    window.addEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
    return () => {
      window.removeEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
    }
  }, [])

  useEffect(() => {
    if (!filteredTabs.some((tab) => tab.id === section)) {
      setSection(filteredTabs[0]?.id ?? 'general')
    }
  }, [filteredTabs, section])

  useEffect(() => {
    if (!open) {
      setDataFeedback(null)
      setPendingDataAction(null)
      setIsPerformingDataAction(false)
    }
  }, [open])

  if (!open) return null

  async function handleExportChats(): Promise<void> {
    if (!session) return
    try {
      const payload = await exportChatSessions(session)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `openport-chat-export-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
      setDataFeedback({ message: `Exported ${payload.items.length} chats.`, variant: 'success' })
    } catch {
      setDataFeedback({ message: 'Failed to export chats.', variant: 'error' })
    }
  }

  async function handleImportChats(file: File | null): Promise<void> {
    if (!file || !session) return
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as { items?: unknown[] } | unknown[]
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : []
      const response = await importChatSessions(items, session)
      await refreshChatDataSummary(session)
      setDataFeedback({ message: `Imported ${response.imported} chats.`, variant: 'success' })
    } catch {
      setDataFeedback({ message: 'Failed to import chats.', variant: 'error' })
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  async function confirmDataAction(): Promise<void> {
    if (!session || !pendingDataAction) return
    setIsPerformingDataAction(true)
    try {
      if (pendingDataAction === 'archive-all') {
        const response = await archiveAllChatSessions(session)
        setDataFeedback({ message: `Archived ${response.items.length} chats.`, variant: 'success' })
      } else {
        await deleteAllChatSessions(session)
        setDataFeedback({ message: 'Deleted all chats.', variant: 'success' })
      }
      await refreshChatDataSummary(session)
      setPendingDataAction(null)
    } catch {
      setDataFeedback({
        message: pendingDataAction === 'archive-all' ? 'Failed to archive all chats.' : 'Failed to delete all chats.',
        variant: 'error'
      })
    } finally {
      setIsPerformingDataAction(false)
    }
  }

  return (
    <>
      <ModalShell
        bodyClassName="chat-settings-modal-body"
        closeLabel="Close settings"
        dialogClassName="project-dialog chat-settings-modal"
        onClose={onClose}
        open={open}
        title="Settings"
      >
        <div className="chat-settings-layout">
          <nav className="chat-settings-nav" aria-label="Settings sections">
            <div className="chat-settings-search">
              <Iconify icon="solar:magnifer-outline" size={15} />
              <input
                aria-label="Search settings"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search settings"
                value={query}
              />
            </div>

            {filteredTabs.map((tab) => (
              <TextButton
                active={section === tab.id}
                className="chat-settings-nav-item"
                key={tab.id}
                onClick={() => setSection(tab.id)}
                type="button"
                variant="menu"
              >
                <Iconify icon={tab.icon} size={16} />
                <span>{tab.title}</span>
              </TextButton>
            ))}
          </nav>

          <div className="chat-settings-panel">
          {section === 'general' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>{displayName}</strong>
                <span>{displayEmail}</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Status</span>
                  <strong>{status}</strong>
                </div>
                <div>
                  <span>Modules</span>
                  <strong>{moduleCount}</strong>
                </div>
              </div>

              <div className="chat-settings-actions">
                <TextButton href="/chat" variant="menu"><span>Chat home</span></TextButton>
                <TextButton onClick={onOpenShortcuts} type="button" variant="menu"><span>Keyboard shortcuts</span></TextButton>
              </div>
            </section>
          ) : null}

          {section === 'interface' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>Interface</strong>
                <span>Adjust the chat home, sidebar, composer, and default model behavior before a conversation overrides it.</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Pinned models</span>
                  <strong>{uiPreferences.pinnedModelRoutes.length}</strong>
                </div>
                <div>
                  <span>Collapsed sections</span>
                  <strong>
                    {Object.values(uiPreferences.collapsedSidebarSections).filter(Boolean).length}
                  </strong>
                </div>
              </div>

              <div className="chat-settings-form-grid">
                <label className="chat-settings-field">
                  <span>Default model</span>
                  <select
                    onChange={(event) =>
                      setUiPreferences(updateChatDefaults({ modelRoute: event.target.value || null }))
                    }
                    value={uiPreferences.chatDefaults.modelRoute || ''}
                  >
                    <option value="">Use workspace default</option>
                    {workspaceModels.map((model) => (
                      <option key={model.id} value={model.route}>
                        {model.name} ({model.route})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="chat-settings-field">
                  <span>Default operator mode</span>
                  <select
                    onChange={(event) =>
                      setUiPreferences(updateChatDefaults({ operatorMode: event.target.value }))
                    }
                    value={uiPreferences.chatDefaults.operatorMode}
                  >
                    <option value="default">Default</option>
                    <option value="review">Review</option>
                    <option value="strict">Strict</option>
                  </select>
                </label>

                <label className="chat-settings-field chat-settings-field-wide">
                  <span>Default system prompt</span>
                  <textarea
                    onChange={(event) =>
                      setUiPreferences(updateChatDefaults({ systemPrompt: event.target.value }))
                    }
                    placeholder="Leave empty to inherit runtime defaults."
                    value={uiPreferences.chatDefaults.systemPrompt}
                  />
                </label>

                <label className="chat-settings-field chat-settings-field-toggle">
                  <span>Collapse projects by default</span>
                  <input
                    checked={uiPreferences.collapsedSidebarSections.projects}
                    onChange={(event) => setUiPreferences(setSidebarSectionState('projects', event.target.checked))}
                    type="checkbox"
                  />
                </label>

                <label className="chat-settings-field chat-settings-field-toggle">
                  <span>Collapse chats by default</span>
                  <input
                    checked={uiPreferences.collapsedSidebarSections.chats}
                    onChange={(event) => setUiPreferences(setSidebarSectionState('chats', event.target.checked))}
                    type="checkbox"
                  />
                </label>

                <label className="chat-settings-field chat-settings-field-toggle">
                  <span>Collapse pinned models by default</span>
                  <input
                    checked={uiPreferences.collapsedSidebarSections.pinnedModels}
                    onChange={(event) => setUiPreferences(setSidebarSectionState('pinnedModels', event.target.checked))}
                    type="checkbox"
                  />
                </label>
              </div>

              <div className="chat-settings-actions">
                <TextButton href="/chat" variant="menu"><span>Open chat home</span></TextButton>
                <TextButton href="/chat?view=archived" variant="menu"><span>Archived chats</span></TextButton>
              </div>
            </section>
          ) : null}

          {section === 'connections' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>Connections</strong>
                <span>Review the models and runtime surfaces that power the active chat workspace.</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Models</span>
                  <strong>{workspaceModels.length}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{status}</strong>
                </div>
              </div>

              <div className="chat-settings-actions">
                <TextButton href="/workspace/models" variant="menu"><span>Models</span></TextButton>
                <TextButton href="/workspace" variant="menu"><span>Workspace overview</span></TextButton>
                <TextButton href="/dashboard/integrations" variant="menu"><span>Runtime status</span></TextButton>
              </div>
            </section>
          ) : null}

          {section === 'integrations' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>Integrations</strong>
                <span>Open the knowledge, prompts, tools, and skills used by chat attachments and actions.</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Knowledge</span>
                  <strong>Ready</strong>
                </div>
                <div>
                  <span>Prompt tools</span>
                  <strong>Available</strong>
                </div>
              </div>

              <div className="chat-settings-actions">
                <TextButton href="/workspace" variant="menu"><span>Workspace overview</span></TextButton>
                <TextButton href="/workspace/knowledge" variant="menu"><span>Knowledge</span></TextButton>
                <TextButton href="/workspace/prompts" variant="menu"><span>Prompts</span></TextButton>
                <TextButton href="/workspace/tools" variant="menu"><span>Tools</span></TextButton>
                <TextButton href="/workspace/skills" variant="menu"><span>Skills</span></TextButton>
              </div>
            </section>
          ) : null}

          {section === 'personalization' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>Personalization</strong>
                <span>Shape the chat-first shell around your account, pinned models, and reading density.</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Current account</span>
                  <strong>{displayName}</strong>
                </div>
                <div>
                  <span>Pinned models</span>
                  <strong>{uiPreferences.pinnedModelRoutes.length}</strong>
                </div>
              </div>

              <div className="chat-settings-actions">
                <TextButton href="/chat" variant="menu"><span>Open chat home</span></TextButton>
                <TextButton href="/dashboard/notes" variant="menu"><span>Notes</span></TextButton>
                <TextButton href="/workspace/models" variant="menu"><span>Pinned models</span></TextButton>
              </div>
            </section>
          ) : null}

          {section === 'data' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>Data controls</strong>
                <span>Import, export, archive, inspect, or remove persisted chat sessions and attached files.</span>
              </div>

              <div className="chat-settings-stats">
                <div>
                  <span>Active chats</span>
                  <strong>{activeChatsCount}</strong>
                </div>
                <div>
                  <span>Archived chats</span>
                  <strong>{archivedChatsCount}</strong>
                </div>
              </div>

              {dataFeedback ? (
                <FeedbackBanner variant={dataFeedback.variant}>{dataFeedback.message}</FeedbackBanner>
              ) : null}

              <input
                accept=".json,application/json"
                hidden
                onChange={(event) => void handleImportChats(event.target.files?.[0] ?? null)}
                ref={importInputRef}
                type="file"
              />

              <div className="chat-settings-data-grid">
                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Import chats</strong>
                    <span>Load a previous OpenPort chat export into this workspace.</span>
                  </div>
                  <TextButton onClick={() => importInputRef.current?.click()} type="button" variant="menu">
                    <span>Import</span>
                  </TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Export chats</strong>
                    <span>Download the current persisted chat sessions as JSON.</span>
                  </div>
                  <TextButton onClick={() => void handleExportChats()} type="button" variant="menu">
                    <span>Export</span>
                  </TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Archived chats</strong>
                    <span>Open the archived chat view in the main chat workspace.</span>
                  </div>
                  <TextButton href="/chat?view=archived" variant="menu"><span>Manage</span></TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Archive all chats</strong>
                    <span>Move every active chat into the archived view without deleting session data.</span>
                  </div>
                  <TextButton onClick={() => setPendingDataAction('archive-all')} type="button" variant="menu">
                    <span>Archive all</span>
                  </TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Delete all chats</strong>
                    <span>Remove every persisted chat session from the API data store.</span>
                  </div>
                  <TextButton onClick={() => setPendingDataAction('delete-all')} type="button" variant="menu">
                    <span>Delete all</span>
                  </TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Files</strong>
                    <span>Open the current workspace knowledge and file surfaces.</span>
                  </div>
                  <TextButton onClick={() => setShowFilesModal(true)} type="button" variant="menu"><span>Open files</span></TextButton>
                </div>

                <div className="chat-settings-data-row">
                  <div className="chat-settings-data-copy">
                    <strong>Raw session feed</strong>
                    <span>Inspect the API session JSON returned by the current backend.</span>
                  </div>
                  <TextButton external href="/api/openport/ai/sessions" rel="noreferrer" target="_blank" variant="menu">
                    <span>Open feed</span>
                  </TextButton>
                </div>
              </div>
            </section>
          ) : null}

          {section === 'about' ? (
            <section className="chat-settings-section">
              <div className="chat-settings-copy">
                <strong>OpenPort chat workspace</strong>
                <span>Chat-first self-hosted UI shaped by the Open WebUI application structure and interaction model.</span>
              </div>

              <div className="chat-settings-actions">
                <TextButton external href="https://github.com/open-webui/open-webui#readme" rel="noreferrer" target="_blank" variant="menu">
                  <span>Open WebUI reference</span>
                </TextButton>
                <TextButton external href="https://github.com/open-webui/open-webui/releases" rel="noreferrer" target="_blank" variant="menu">
                  <span>Open WebUI releases</span>
                </TextButton>
              </div>
            </section>
          ) : null}
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel={pendingDataAction === 'delete-all' ? 'Delete all chats' : 'Archive all chats'}
        onCancel={() => setPendingDataAction(null)}
        onConfirm={() => {
          if (!isPerformingDataAction) {
            void confirmDataAction()
          }
        }}
        open={pendingDataAction !== null}
        title={pendingDataAction === 'delete-all' ? 'Delete All Chats' : 'Archive All Chats'}
      >
        <p className="project-confirm-copy">
          {pendingDataAction === 'delete-all'
            ? 'This will permanently remove every persisted chat session from the current workspace.'
            : 'This will move every active chat into the archived view.'}
        </p>
      </ConfirmDialog>

      <ChatFilesModal onClose={() => setShowFilesModal(false)} open={showFilesModal} />
    </>
  )
}
