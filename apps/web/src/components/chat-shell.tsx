'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import type { OpenPortProjectCollaborationState, OpenPortProjectKnowledgeMatch } from '@openport/product-contracts'
import {
  buildProjectEventsUrl,
  clearSession,
  createChatSession,
  fetchChatSession,
  fetchChatSessions,
  fetchProjectCollaboration,
  fetchProjects,
  fetchWorkspaceModels,
  loadSession,
  postChatMessage,
  searchProjectKnowledge,
  updateChatSessionMeta,
  updateChatSessionSettings,
  type OpenPortChatMessage,
  type OpenPortChatSession,
  type OpenPortWorkspaceModel
} from '../lib/openport-api'
import {
  assignThreadToProject,
  getDefaultChatSettings,
  getProjectChatSettings,
  getWorkspaceEventName,
  loadProjects,
  saveProjectsToCache,
  type OpenPortProject
} from '../lib/chat-workspace'
import { OpenPortProjectRealtime } from '../lib/project-realtime'
import { WORKSPACE_SHORTCUT_EVENT } from '../lib/shortcuts'
import { notify } from '../lib/toast'
import { getChatUiPreferencesEventName, loadChatUiPreferences, togglePinnedModelRoute } from '../lib/chat-ui-preferences'
import { getInheritedChatSettings } from '../lib/chat-defaults'
import { ChatComposerToolsMenu, type ComposerAttachment } from './chat-composer-tools-menu'
import { ChatControlsPanel } from './chat-controls-panel'
import { ChatSettingsModal, type ChatSettingsSection } from './chat-settings-modal'
import { useAppShellState } from './app-shell-state'
import { Iconify } from './iconify'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { IconButton } from './ui/icon-button'
import { MessageBubble } from './ui/message-bubble'
import { TextButton } from './ui/text-button'

const suggestions = [
  {
    title: 'Review recent changes',
    prompt: 'Review the latest workspace changes and summarize what needs attention.',
    description: 'Summarize recent updates and surface what needs review.'
  },
  {
    title: 'Inspect a draft',
    prompt: 'Inspect the current integration draft and suggest concrete improvements.',
    description: 'Check an integration draft before publish.'
  },
  {
    title: 'Plan next steps',
    prompt: 'Look at the current workspace context and propose the next three steps.',
    description: 'Turn the current state into a practical action plan.'
  }
] as const

type AccountMenuItem = {
  icon: string
  label: string
  href?: string
  external?: boolean
  action?: 'showSettings' | 'showShortcuts'
}

const accountMenuItems: AccountMenuItem[] = [
  { label: 'Settings', icon: 'solar:settings-outline', action: 'showSettings' },
  { href: '/?view=archived', label: 'Archived Chats', icon: 'solar:archive-outline' },
  { href: '/workspace/models', label: 'Playground', icon: 'solar:code-square-outline' },
  { href: '/dashboard', label: 'Admin Panel', icon: 'solar:user-id-outline' },
  { href: 'https://github.com/open-webui/open-webui#readme', label: 'Documentation', icon: 'solar:question-circle-outline', external: true },
  { href: 'https://github.com/open-webui/open-webui/releases', label: 'Releases', icon: 'solar:map-arrow-square-outline', external: true },
  { label: 'Keyboard shortcuts', icon: 'solar:keyboard-outline', action: 'showShortcuts' }
]

export function ChatShell() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useMemo(() => loadSession(), [])
  const [threads, setThreads] = useState<OpenPortChatSession[]>([])
  const [models, setModels] = useState<OpenPortWorkspaceModel[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [pendingSettings, setPendingSettings] = useState(getDefaultChatSettings(null))
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<ChatSettingsSection>('general')
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [modelMenuMounted, setModelMenuMounted] = useState(false)
  const [modelMenuVisible, setModelMenuVisible] = useState(false)
  const [accountMenuMounted, setAccountMenuMounted] = useState(false)
  const [accountMenuVisible, setAccountMenuVisible] = useState(false)
  const [uiPreferences, setUiPreferences] = useState(loadChatUiPreferences())
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([])
  const [collaboration, setCollaboration] = useState<OpenPortProjectCollaborationState | null>(null)
  const [knowledgeMatches, setKnowledgeMatches] = useState<OpenPortProjectKnowledgeMatch[]>([])
  const [isSearchingKnowledge, setIsSearchingKnowledge] = useState(false)
  const [isPending, startTransition] = useTransition()
  const collaborationModeRef = useRef<'viewing' | 'editing'>('viewing')
  const projectRealtimeRef = useRef<OpenPortProjectRealtime | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const speechRecognitionRef = useRef<any>(null)
  const speechBaseDraftRef = useRef('')
  const speechModeRef = useRef<'dictation' | 'voice' | null>(null)
  const { controlsWidth, isMobile, setControlsWidth, showControls, setShowControls, toggleControls } = useAppShellState()
  const [controlsMounted, setControlsMounted] = useState(showControls)
  const [controlsVisible, setControlsVisible] = useState(showControls)
  const selectedProjectId = searchParams.get('project')
  const requestedModelRoute = searchParams.get('model')
  const seededPrompt = searchParams.get('q')?.trim() || ''
  const view = searchParams.get('view')
  const isArchivedView = view === 'archived'
  const [speechMode, setSpeechMode] = useState<'dictation' | 'voice' | null>(null)

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || null
  const messages: OpenPortChatMessage[] = activeThread?.messages || []
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ||
    projects.find((project) => project.id === activeThread?.settings.projectId) ||
    null
  const accountInitial = (session?.name || session?.email || 'O').trim().charAt(0).toUpperCase()
  const currentModelRoute = activeThread?.settings.valves.modelRoute || pendingSettings.valves.modelRoute
  const currentModel =
    models.find((model) => model.route === currentModelRoute) || {
      id: currentModelRoute,
      name: currentModelRoute,
      route: currentModelRoute,
      description: '',
      tags: [],
      provider: 'local',
      workspaceId: '',
      status: 'active',
      isDefault: true,
      filterIds: [],
      defaultFilterIds: [],
      actionIds: [],
      defaultFeatureIds: [],
      capabilities: {
        vision: false,
        webSearch: false,
        imageGeneration: false,
        codeInterpreter: false
      },
      knowledgeItemIds: [],
      toolIds: [],
      builtinToolIds: [],
      skillIds: [],
      promptSuggestions: [],
      accessGrants: [],
      createdAt: '',
      updatedAt: ''
    }
  const showEmptyStage = !activeThread || messages.length === 0
  const activeProjectId = selectedProject?.id || null
  const projectBackgroundImage = selectedProject?.meta.backgroundImageUrl?.trim() || ''
  const chatMainStageStyle = projectBackgroundImage
    ? ({
        backgroundImage: `linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.88)), url("${projectBackgroundImage.replace(/"/g, '\\"')}")`
      } as CSSProperties)
    : undefined
  const availableModels = useMemo(() => {
    const next = [...models]
    if (!next.some((model) => model.route === currentModelRoute)) {
      next.unshift(currentModel)
    }
    return next
  }, [currentModel, currentModelRoute, models])
  function buildChatHref(params?: URLSearchParams): string {
    const chatHomePath = pathname === '/' ? '/' : '/chat'
    const suffix = params?.toString()
    return suffix ? `${chatHomePath}?${suffix}` : chatHomePath
  }

  const currentModelDescription = currentModel?.description?.trim() || 'How can I help you today?'

  function openSettings(section: ChatSettingsSection): void {
    setSettingsInitialSection(section)
    setShowSettingsModal(true)
  }

  function stopSpeechRecognition(): void {
    const recognition = speechRecognitionRef.current
    speechRecognitionRef.current = null
    speechModeRef.current = null
    setSpeechMode(null)
    if (!recognition) return
    try {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
    } catch {
      // ignore
    }
  }

  function startSpeechRecognition(mode: 'dictation' | 'voice'): void {
    if (typeof window === 'undefined') return

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setError('Dictation is not supported in this browser.')
      return
    }

    stopSpeechRecognition()
    speechBaseDraftRef.current = draft.trim()
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = mode === 'voice'

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (!transcript) return

      const base = speechBaseDraftRef.current
      const nextDraft = base ? `${base} ${transcript}` : transcript
      setDraft(nextDraft)

      if (mode === 'voice') {
        // For voice mode, send on a "final" result when possible.
        const last = event.results?.[event.results.length - 1]
        if (last?.isFinal) {
          stopSpeechRecognition()
          submitMessage(nextDraft)
        }
      }
    }

    recognition.onerror = () => {
      stopSpeechRecognition()
      setError(mode === 'voice' ? 'Voice mode failed to start.' : 'Dictation failed to start.')
    }

    recognition.onend = () => {
      if (speechModeRef.current !== mode) return
      stopSpeechRecognition()
    }

    try {
      recognition.start()
      speechRecognitionRef.current = recognition
      speechModeRef.current = mode
      setSpeechMode(mode)
    } catch {
      stopSpeechRecognition()
      setError(mode === 'voice' ? 'Voice mode failed to start.' : 'Dictation failed to start.')
    }
  }

  useEffect(() => {
    return () => stopSpeechRecognition()
  }, [])

  function onControlsResizeStart(startEvent: ReactMouseEvent<HTMLDivElement>): void {
    if (isMobile) return
    const startX = startEvent.clientX
    const startWidth = controlsWidth

    function onPointerMove(event: MouseEvent): void {
      setControlsWidth(startWidth - (event.clientX - startX))
    }

    function onPointerUp(): void {
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
    }

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  useEffect(() => {
    let isActive = true

    async function load(): Promise<void> {
      try {
        const [projectsResponse, response, modelsResponse] = await Promise.all([
          fetchProjects(loadSession()),
          fetchChatSessions({ archived: isArchivedView }, loadSession()),
          fetchWorkspaceModels(loadSession()).catch(() => ({ items: [] }))
        ])
        if (!isActive) return

        const nextThreads = response.items
        setThreads(nextThreads)
        saveProjectsToCache(projectsResponse.items)
        setProjects(projectsResponse.items)
        setModels(modelsResponse.items)
      } catch (loadError) {
        if (!isActive) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load chat sessions')
        setProjects(loadProjects())
      }
    }

    void load()
    return () => {
      isActive = false
    }
  }, [isArchivedView])

  useEffect(() => {
    if (activeThreadId) return

    setPendingSettings((current) => {
      const nextDefaults = getProjectChatSettings(projects, selectedProjectId, {
        models,
        preferences: uiPreferences
      })
      const preferredRoute = current.valves.modelRoute || nextDefaults.valves.modelRoute
      return {
        ...nextDefaults,
        valves: {
          ...nextDefaults.valves,
          modelRoute: preferredRoute
        }
      }
    })
  }, [activeThreadId, projects, selectedProjectId])

  useEffect(() => {
    if (activeThreadId) return

    const selectedProject = projects.find((project) => project.id === selectedProjectId) || null
    setPendingSettings((current) => getInheritedChatSettings(current, selectedProject, uiPreferences, models))
  }, [activeThreadId, models, projects, selectedProjectId, uiPreferences])

  useEffect(() => {
    if (activeThreadId || !requestedModelRoute) return

    setPendingSettings((current) =>
      current.valves.modelRoute === requestedModelRoute
        ? current
        : {
            ...current,
            valves: {
              ...current.valves,
              modelRoute: requestedModelRoute
            }
          }
    )
  }, [activeThreadId, requestedModelRoute])

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
    if (showModelMenu) {
      setModelMenuMounted(true)
      const id = window.requestAnimationFrame(() => setModelMenuVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    setModelMenuVisible(false)
    const timeout = window.setTimeout(() => setModelMenuMounted(false), 160)
    return () => window.clearTimeout(timeout)
  }, [showModelMenu])

  useEffect(() => {
    if (showAccountMenu) {
      setAccountMenuMounted(true)
      const id = window.requestAnimationFrame(() => setAccountMenuVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    setAccountMenuVisible(false)
    const timeout = window.setTimeout(() => setAccountMenuMounted(false), 160)
    return () => window.clearTimeout(timeout)
  }, [showAccountMenu])

  useEffect(() => {
    if (showControls) {
      setControlsMounted(true)
      const id = window.requestAnimationFrame(() => setControlsVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    setControlsVisible(false)
    const timeout = window.setTimeout(() => setControlsMounted(false), 180)
    return () => window.clearTimeout(timeout)
  }, [showControls])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePreferencesUpdate = () => {
      setUiPreferences(loadChatUiPreferences())
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setShowModelMenu(false)
      }

      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setShowAccountMenu(false)
      }

      if (toolsMenuRef.current && !toolsMenuRef.current.contains(target)) {
        setShowToolsMenu(false)
      }
    }

    window.addEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
    window.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    collaborationModeRef.current = draft.trim() || showControls ? 'editing' : 'viewing'
    projectRealtimeRef.current?.setState(collaborationModeRef.current)
  }, [draft, showControls])

  useEffect(() => {
    const nextThreadId = searchParams.get('thread')
    setActiveThreadId(nextThreadId)
  }, [searchParams])

  useEffect(() => {
    if (activeThreadId) return
    if (!seededPrompt) return

    setDraft((current) => (current.trim().length > 0 ? current : seededPrompt))
  }, [activeThreadId, seededPrompt])

  useEffect(() => {
    if (!activeThreadId) return
    const selectedThreadId = activeThreadId

    let isActive = true

    async function loadSelectedThread(): Promise<void> {
      try {
        const { session } = await fetchChatSession(selectedThreadId, loadSession())
        if (!isActive) return
        setThreads((current) => {
          const exists = current.some((thread) => thread.id === session.id)
          if (!exists) {
            return [session, ...current]
          }

          return current.map((thread) => (thread.id === session.id ? session : thread))
        })
      } catch (loadError) {
        if (!isActive) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to open chat')
      }
    }

    void loadSelectedThread()
    return () => {
      isActive = false
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!session || typeof window === 'undefined') return

    const source = new EventSource(buildProjectEventsUrl(session))
    source.onmessage = () => {
      void fetchProjects(loadSession())
        .then((response) => {
          saveProjectsToCache(response.items)
          setProjects(response.items)
        })
        .catch(() => undefined)

      if (activeThreadId) {
        void fetchChatSession(activeThreadId, loadSession())
          .then(({ session: nextSession }) => {
            setThreads((current) => {
              const exists = current.some((thread) => thread.id === nextSession.id)
              const nextThreads = exists
                ? current.map((thread) => (thread.id === nextSession.id ? nextSession : thread))
                : [nextSession, ...current]
              return sortThreads(nextThreads)
            })
          })
          .catch(() => undefined)
      }
    }

    return () => {
      source.close()
    }
  }, [activeThreadId, session])

  useEffect(() => {
    if (!activeProjectId || !session) {
      setCollaboration(null)
      projectRealtimeRef.current?.disconnect()
      projectRealtimeRef.current = null
      return
    }

    let cancelled = false

    void fetchProjectCollaboration(activeProjectId, loadSession())
      .then((state) => {
        if (!cancelled) setCollaboration(state)
      })
      .catch(() => undefined)

    const realtime = new OpenPortProjectRealtime(activeProjectId, session, {
      onPresence: (state) => {
        if (!cancelled) setCollaboration(state)
      },
      onEvent: () => {
        void fetchProjects(loadSession())
          .then((response) => {
            saveProjectsToCache(response.items)
            setProjects(response.items)
          })
          .catch(() => undefined)

        if (activeThreadId) {
          void fetchChatSession(activeThreadId, loadSession())
            .then(({ session: nextSession }) => {
              if (cancelled) return
              setThreads((current) => {
                const exists = current.some((thread) => thread.id === nextSession.id)
                const nextThreads = exists
                  ? current.map((thread) => (thread.id === nextSession.id ? nextSession : thread))
                  : [nextSession, ...current]
                return sortThreads(nextThreads)
              })
            })
            .catch(() => undefined)
        }
      }
    })
    projectRealtimeRef.current = realtime
    realtime.connect()

    return () => {
      cancelled = true
      realtime.disconnect()
      if (projectRealtimeRef.current === realtime) {
        projectRealtimeRef.current = null
      }
    }
  }, [activeProjectId, session])

  useEffect(() => {
    if (!activeProjectId || !session) {
      setKnowledgeMatches([])
      setIsSearchingKnowledge(false)
      return
    }

    const query = draft.trim()
    if (!query) {
      setKnowledgeMatches([])
      setIsSearchingKnowledge(false)
      return
    }

    let cancelled = false
    setIsSearchingKnowledge(true)
    const timeout = window.setTimeout(() => {
      void searchProjectKnowledge(activeProjectId, query, 5, loadSession())
        .then((response) => {
          if (!cancelled) {
            setKnowledgeMatches(response.items)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setKnowledgeMatches([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearchingKnowledge(false)
          }
        })
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [activeProjectId, draft, session])

  function onCreateThread(): void {
    setError(null)
    setDraft('')
    setActiveThreadId(null)
    const params = new URLSearchParams()
    if (selectedProjectId) params.set('project', selectedProjectId)
    if (isArchivedView) params.set('view', 'archived')
    router.push(buildChatHref(params))
  }

  function onSignOut(): void {
    clearSession()
    setShowAccountMenu(false)
    router.push('/auth/login')
  }

  function onAccountMenuAction(item: AccountMenuItem): void {
    setShowAccountMenu(false)

    if (item.action === 'showSettings') {
      setShowSettingsModal(true)
      return
    }

    if (item.action === 'showShortcuts') {
      window.dispatchEvent(new Event(WORKSPACE_SHORTCUT_EVENT))
      return
    }
  }

  function onSelectThread(threadId: string): void {
    setActiveThreadId(threadId)
    const params = new URLSearchParams()
    params.set('thread', threadId)
    if (selectedProjectId) params.set('project', selectedProjectId)
    if (isArchivedView) params.set('view', 'archived')
    router.push(buildChatHref(params))
  }

  function sortThreads(nextThreads: OpenPortChatSession[]): OpenPortChatSession[] {
    return nextThreads.sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }

  function updateThreadMeta(input: { archived?: boolean; pinned?: boolean; tags?: string[] }): void {
    if (!activeThreadId) return
    setError(null)

    void updateChatSessionMeta(activeThreadId, input, loadSession())
      .then(({ session }) => {
        if (typeof input.archived === 'boolean') {
          if (input.archived !== isArchivedView) {
            setThreads((current) => current.filter((thread) => thread.id !== session.id))
            setActiveThreadId(null)
            const params = new URLSearchParams()
            if (selectedProjectId) params.set('project', selectedProjectId)
            if (input.archived) {
              params.set('view', 'archived')
            }
            router.push(buildChatHref(params))
            return
          }
        }

        setThreads((current) => sortThreads(current.map((thread) => (thread.id === session.id ? session : thread))))
      })
      .catch((metaError) => {
        setError(metaError instanceof Error ? metaError.message : 'Unable to update chat')
      })
  }

  function renderModelSelector(placement: 'header' | 'hero') {
    return (
      <div className={`chat-model-menu-wrap${placement === 'hero' ? ' is-hero' : ''}`} ref={modelMenuRef}>
        <TextButton
          className={`chat-model-trigger${placement === 'hero' ? ' is-hero' : ''}`}
          onClick={() => {
            // Keep the model menu in sync with runtime availability (e.g. Ollama models can appear after startup).
            if (!showModelMenu) {
              void fetchWorkspaceModels(loadSession())
                .then((response) => setModels(response.items))
                .catch(() => undefined)
            }
            setShowModelMenu((current) => !current)
          }}
          size="md"
          type="button"
          variant="inline"
        >
          {placement === 'hero' ? (
            <span className="chat-model-trigger-copy is-hero">
              <span>{currentModel?.name || currentModelRoute}</span>
            </span>
          ) : (
            <span>{currentModel?.name || currentModelRoute}</span>
          )}
          <Iconify icon="solar:alt-arrow-down-outline" size={15} />
        </TextButton>
        <span className={`chat-model-trigger-subtitle${placement === 'hero' ? ' is-hero' : ''}`}>
          {activeThread && placement !== 'hero' ? currentModelRoute : currentModelDescription}
        </span>

        {modelMenuMounted ? (
          <div
            className={`chat-model-menu${placement === 'hero' ? ' is-hero' : ''}${modelMenuVisible ? ' is-open' : ' is-closing'}`}
          >
            <div className="chat-model-menu-list">
              {availableModels.map((model) => (
                <div className={`chat-model-menu-item-row${model.route === currentModelRoute ? ' is-active' : ''}`} key={model.id}>
                  <TextButton
                    active={model.route === currentModelRoute}
                    className="chat-model-menu-item"
                    onClick={() => selectModelRoute(model.route)}
                    type="button"
                    variant="menu"
                  >
                    <span className="chat-model-menu-item-copy">
                      <strong>{model.name}</strong>
                      <span>{model.route}</span>
                    </span>
                  </TextButton>
                  <IconButton
                    active={uiPreferences.pinnedModelRoutes.includes(model.route)}
                    aria-label={
                      uiPreferences.pinnedModelRoutes.includes(model.route)
                        ? `Unpin ${model.name}`
                        : `Pin ${model.name}`
                    }
                    className="chat-model-menu-pin"
                    onClick={() => togglePinnedModel(model.route)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Iconify
                      icon={
                        uiPreferences.pinnedModelRoutes.includes(model.route)
                          ? 'solar:bookmark-bold'
                          : 'solar:bookmark-outline'
                      }
                      size={15}
                    />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderComposer(variant: 'empty' | 'thread') {
    return (
      <div className={`chat-composer-shell${variant === 'empty' ? ' is-hero' : ''}`}>
        {composerAttachments.length > 0 ? (
          <div className="chat-composer-attachments">
            {composerAttachments.map((attachment) => (
              <div className="chat-composer-attachment" key={`${attachment.type}-${attachment.id}`}>
                <span className="chat-composer-attachment-copy">
                  <strong>{attachment.label}</strong>
                  {attachment.meta ? <span>{attachment.meta}</span> : null}
                </span>
                <IconButton
                  aria-label={`Remove ${attachment.label}`}
                  className="chat-composer-attachment-remove"
                  onClick={() =>
                    setComposerAttachments((current) => current.filter((entry) => entry.id !== attachment.id))
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Iconify icon="solar:close-outline" size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : null}

        <form
          className={`chat-composer-card${variant === 'empty' ? ' is-hero' : ''}`}
          id="chat-composer-form"
          onSubmit={onSubmit}
        >
        <textarea
          aria-label="Message composer"
          className={`chat-composer-input${variant === 'empty' ? ' chat-hero-composer-input' : ''}`}
          id="chat-input"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            variant === 'empty'
              ? 'How can I help you today?'
              : 'Ask OpenPort to review, summarize, or act.'
          }
          value={draft}
        />
        <div className="chat-composer-toolbar">
          <div className="chat-composer-toolbar-start" ref={toolsMenuRef}>
            <IconButton
              active={showToolsMenu}
              aria-expanded={showToolsMenu}
              aria-label="Open attachment tools"
              className="chat-composer-tool"
              onClick={() => setShowToolsMenu((current) => !current)}
              size="md"
              type="button"
              variant="toolbar"
            >
              <Iconify icon="solar:add-circle-outline" size={17} />
            </IconButton>
            <ChatComposerToolsMenu
              currentThreadId={activeThreadId}
              onClose={() => setShowToolsMenu(false)}
              onSelect={(attachment) => {
                setComposerAttachments((current) =>
                  current.some((entry) => entry.id === attachment.id && entry.type === attachment.type)
                    ? current
                    : [...current, attachment]
                )
              }}
              open={showToolsMenu}
            />
            <span aria-hidden="true" className="chat-composer-divider" />
            <IconButton
              aria-label="Open integrations"
              className="chat-composer-tool"
              onClick={() => openSettings('integrations')}
              size="md"
              type="button"
              variant="toolbar"
            >
              <Iconify icon="solar:widget-5-outline" size={17} />
            </IconButton>
            <IconButton
              aria-label="More options"
              className="chat-composer-tool"
              onClick={() => openSettings('general')}
              size="md"
              type="button"
              variant="toolbar"
            >
              <Iconify icon="solar:menu-dots-outline" size={18} />
            </IconButton>
          </div>
          <div className="chat-composer-toolbar-end">
            <IconButton
              active={speechMode === 'dictation'}
              aria-label="Dictate"
              className="chat-composer-tool"
              onClick={() => (speechMode === 'dictation' ? stopSpeechRecognition() : startSpeechRecognition('dictation'))}
              size="md"
              type="button"
              variant="toolbar"
            >
              <Iconify icon="solar:microphone-3-outline" size={17} />
            </IconButton>

            {!draft.trim() && composerAttachments.length === 0 ? (
              <IconButton
                active={speechMode === 'voice'}
                aria-label="Voice mode"
                className="chat-voice-button"
                onClick={() => (speechMode === 'voice' ? stopSpeechRecognition() : startSpeechRecognition('voice'))}
                size="md"
                type="button"
                variant="toolbar"
              >
                <Iconify icon="solar:soundwave-outline" size={18} />
              </IconButton>
            ) : (
              <CapsuleButton
                className="chat-send-button"
                disabled={isPending || (!draft.trim() && composerAttachments.length === 0)}
                size="icon"
                type="submit"
                variant="primary"
              >
                <Iconify icon={isPending ? 'solar:refresh-outline' : 'solar:arrow-up-outline'} size={17} />
              </CapsuleButton>
            )}
          </div>
        </div>
        </form>
      </div>
    )
  }

  function selectModelRoute(route: string): void {
    setShowModelMenu(false)

    if (!activeThreadId) {
      setPendingSettings((current) => ({
        ...current,
        valves: {
          ...current.valves,
          modelRoute: route
        }
      }))
      return
    }

    const sourceSettings = activeThread?.settings ?? pendingSettings
    const nextSettings = {
      ...sourceSettings,
      valves: {
        ...sourceSettings.valves,
        modelRoute: route
      }
    }

    void updateChatSessionSettings(activeThreadId, nextSettings, loadSession())
      .then(({ session: nextSession }) => {
        setThreads((current) => sortThreads(current.map((thread) => (thread.id === nextSession.id ? nextSession : thread))))
      })
      .catch((modelError) => {
        setError(modelError instanceof Error ? modelError.message : 'Unable to switch model')
      })
  }

  function togglePinnedModel(route: string): void {
    setUiPreferences(togglePinnedModelRoute(route))
  }

  function submitMessage(rawContent: string): void {
    if (!rawContent.trim() && composerAttachments.length === 0) return

    const content = rawContent.trim() || 'Use the attached context.'
    const messageAttachments = composerAttachments.map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      label: attachment.label,
      meta: attachment.meta,
      payload: attachment.payload,
      assetId: attachment.assetId ?? null,
      contentUrl: attachment.contentUrl ?? null
    }))
    setDraft('')
    setError(null)
    setShowToolsMenu(false)

    startTransition(() => {
      void (async () => {
      try {
        let sessionId = activeThreadId

        if (!sessionId) {
          const created = await createChatSession(`New chat ${threads.length + 1}`, loadSession(), {
            settings: pendingSettings
          })
          assignThreadToProject(created.session.id, selectedProjectId)
          const nextProjects = await fetchProjects(loadSession()).then((response) => response.items).catch(() => loadProjects())
          saveProjectsToCache(nextProjects)
          setProjects(nextProjects)
          sessionId = created.session.id
          setThreads((current) => [created.session, ...current])
          setActiveThreadId(sessionId)
          const params = new URLSearchParams()
          params.set('thread', sessionId)
          if (selectedProjectId) {
            params.set('project', selectedProjectId)
          }
          if (isArchivedView) {
            params.set('view', 'archived')
          }
          router.push(buildChatHref(params))
        }

        const response = await postChatMessage(sessionId, content, messageAttachments, loadSession())
        setThreads((current) => {
          const nextThreads = current.map((thread) =>
            thread.id === response.session.id ? { ...response.session, messages: response.messages } : thread
          )
          return sortThreads(nextThreads)
        })
        setComposerAttachments([])
      } catch (submitError) {
        setDraft(content)
        setError(submitError instanceof Error ? submitError.message : 'Unable to send message')
        notify('error', 'Unable to send message.')
      }
      })()
    })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    submitMessage(draft)
  }

  return (
    <div
      className={`chat-app-shell${controlsMounted ? ' has-controls-open' : ''}${isMobile ? ' is-mobile' : ''}`}
      style={
        {
          '--openport-controls-width': `${controlsWidth}px`
        } as CSSProperties
      }
    >
      {isMobile && showControls ? (
        <button
          aria-label="Close controls"
          className="chat-controls-backdrop"
          onClick={() => setShowControls(false)}
          type="button"
        />
      ) : null}
      <section
        className={`chat-main-stage${projectBackgroundImage ? ' has-project-background' : ''}`}
        style={chatMainStageStyle}
      >
        <div className="chat-main-header">
          <div className="chat-main-header-copy">{showEmptyStage ? null : renderModelSelector('header')}</div>
          <div className="chat-topbar">
            <IconButton
              active={showControls}
              aria-label="Toggle controls"
              className="chat-topbar-icon"
              id="chat-controls-toggle-button"
              onClick={toggleControls}
              size="md"
              variant="topbar"
            >
              <Iconify icon="solar:tuning-4-outline" size={19} />
            </IconButton>
            <div className="chat-account-menu-wrap" ref={accountMenuRef}>
              <IconButton
                aria-expanded={showAccountMenu}
                aria-label="Open account menu"
                className={`chat-account-trigger${showAccountMenu ? ' is-active' : ''}`}
                onClick={() => setShowAccountMenu((current) => !current)}
                size="md"
                type="button"
                variant="topbar"
              >
                <span className="chat-account-trigger-badge">{accountInitial}</span>
              </IconButton>

              {accountMenuMounted ? (
                <div className={`chat-account-menu${accountMenuVisible ? ' is-open' : ' is-closing'}`}>
                  <div className="chat-account-menu-list">
                    {accountMenuItems.map((item) =>
                      item.action ? (
                        <TextButton
                          key={item.label}
                          onClick={() => onAccountMenuAction(item)}
                          variant="menu"
                          type="button"
                        >
                          <Iconify icon={item.icon} size={19} />
                          <span>{item.label}</span>
                        </TextButton>
                      ) : item.external ? (
                        <TextButton
                          key={item.label}
                          external
                          href={item.href}
                          rel="noreferrer"
                          target="_blank"
                          variant="menu"
                        >
                          <Iconify icon={item.icon} size={19} />
                          <span>{item.label}</span>
                        </TextButton>
                      ) : (
                        <TextButton key={item.label} href={item.href} onClick={() => setShowAccountMenu(false)} variant="menu">
                          <Iconify icon={item.icon} size={19} />
                          <span>{item.label}</span>
                        </TextButton>
                      )
                    )}

                    <TextButton onClick={onSignOut} variant="menu" type="button">
                      <Iconify icon="solar:logout-2-outline" size={19} />
                      <span>Sign Out</span>
                    </TextButton>
                  </div>

                  <div className="chat-account-menu-footer">
                    <span className="chat-account-menu-status-dot" />
                    <span>Active Users: 1</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {showEmptyStage ? (
          <div className="chat-empty-stage">
            <div className="chat-empty-frame">
              <div className="chat-empty-head chat-empty-stage-item chat-empty-stage-item--head">{renderModelSelector('hero')}</div>

              <div className="chat-empty-stage-item chat-empty-stage-item--composer">{renderComposer('empty')}</div>

              <div className="chat-suggestion-list chat-empty-stage-item chat-empty-stage-item--suggestions">
                <span className="chat-suggestion-label">
                  <Iconify icon="solar:bolt-outline" size={14} />
                  <span>Suggested</span>
                </span>
                {suggestions.map((suggestion) => (
                  <TextButton
                    key={suggestion.title}
                    className="chat-suggestion"
                    onClick={() => setDraft(suggestion.prompt)}
                    size="md"
                    type="button"
                    variant="inline"
                  >
                    <div className="chat-suggestion-copy">
                      <strong>{suggestion.title}</strong>
                      <span>{suggestion.description}</span>
                    </div>
                  </TextButton>
                ))}
              </div>
            </div>
          </div>
        ) : activeThread ? (
          <>
            <div className="chat-conversation-flow">
              {messages.map((message, index) => (
                <MessageBubble
                  attachments={message.attachments}
                  key={message.id}
                  role={message.role}
                  style={{ '--message-enter-delay': `${Math.min(index, 10) * 26}ms` } as CSSProperties}
                >
                  <p data-copy-response-source>{message.content}</p>
                </MessageBubble>
              ))}
            </div>

            <div className="chat-main-composer">{renderComposer('thread')}</div>
          </>
        ) : null}

        {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      </section>

      {controlsMounted ? (
        <>
          {!isMobile ? (
            <div
              aria-hidden="true"
              className={`chat-controls-resize-handle${controlsVisible ? ' is-open' : ' is-closing'}`}
              onMouseDown={onControlsResizeStart}
            />
          ) : null}
          <ChatControlsPanel
            className={controlsVisible ? 'is-open' : 'is-closing'}
            activeThreadId={activeThreadId}
            activeArchived={activeThread?.archived ?? false}
            activePinned={activeThread?.pinned ?? false}
            collaboration={collaboration}
            composerAttachments={composerAttachments}
            activeProject={selectedProject}
            initialSettings={activeThread?.settings ?? pendingSettings}
            knowledgeMatches={knowledgeMatches}
            isSearchingKnowledge={isSearchingKnowledge}
            initialTags={activeThread?.tags ?? []}
            models={models}
            onArchiveToggle={activeThreadId ? () => updateThreadMeta({ archived: !(activeThread?.archived ?? false) }) : undefined}
            onComposerAttachmentRemove={(attachmentId) =>
              setComposerAttachments((current) => current.filter((entry) => entry.id !== attachmentId))
            }
            onClose={() => setShowControls(false)}
            onPinToggle={activeThreadId ? () => updateThreadMeta({ pinned: !(activeThread?.pinned ?? false) }) : undefined}
            onSettingsChange={(nextSettings) => {
              if (!activeThreadId) {
                setPendingSettings(nextSettings)
                return
              }

              setThreads((current) =>
                current.map((thread) =>
                  thread.id === activeThreadId
                    ? {
                        ...thread,
                        settings: nextSettings,
                        updatedAt: new Date().toISOString()
                      }
                    : thread
                )
              )
            }}
            onTagsChange={(nextTags) => {
              if (!activeThreadId) return
              setThreads((current) =>
                current.map((thread) =>
                  thread.id === activeThreadId
                    ? {
                        ...thread,
                        tags: nextTags,
                        updatedAt: new Date().toISOString()
                      }
                    : thread
                )
              )
            }}
            selectedProjectId={selectedProjectId}
            uiPreferences={uiPreferences}
          />
        </>
      ) : null}

      <ChatSettingsModal
        initialSection={settingsInitialSection}
        onClose={() => setShowSettingsModal(false)}
        onOpenShortcuts={() => window.dispatchEvent(new Event(WORKSPACE_SHORTCUT_EVENT))}
        open={showSettingsModal}
        session={session}
      />
    </div>
  )
}
