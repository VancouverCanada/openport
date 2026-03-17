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
  deleteChatSession,
  fetchChatSession,
  fetchChatSessions,
  fetchProjectCollaboration,
  fetchProjects,
  fetchOllamaTags,
  fetchWorkspaceModels,
  importChatSessions,
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
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

type OpenPortChatAttachment = NonNullable<OpenPortChatMessage['attachments']>[number]

function slugifyOllamaName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'model'
}

function createLocalId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
      ? (crypto as any).randomUUID()
      : Math.random().toString(16).slice(2)
  return `${prefix}_${uuid}_${Date.now()}`
}

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
  const [ollamaLiveModels, setOllamaLiveModels] = useState<OpenPortWorkspaceModel[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [pendingSettings, setPendingSettings] = useState(getDefaultChatSettings(null))
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
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
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [assistantThoughtSeconds, setAssistantThoughtSeconds] = useState<Record<string, number>>({})

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || null
  const messages: OpenPortChatMessage[] = activeThread?.messages || []
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ||
    projects.find((project) => project.id === activeThread?.settings.projectId) ||
    null
  const accountInitial = (session?.name || session?.email || 'O').trim().charAt(0).toUpperCase()
  const mergedModels = useMemo(() => {
    const merged = new Map<string, OpenPortWorkspaceModel>()
    ;[...ollamaLiveModels, ...models].forEach((model) => {
      if (!model?.route) return
      if (!merged.has(model.route)) merged.set(model.route, model)
    })
    return Array.from(merged.values())
  }, [models, ollamaLiveModels])
  const currentModelRoute = activeThread?.settings.valves.modelRoute || pendingSettings.valves.modelRoute
  const currentModel =
    mergedModels.find((model) => model.route === currentModelRoute) || {
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
    const next = [...mergedModels]
    if (!next.some((model) => model.route === currentModelRoute)) {
      next.unshift(currentModel)
    }
    return next
  }, [currentModel, currentModelRoute, mergedModels])

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    if (!q) return availableModels
    return availableModels.filter((model) => `${model.name} ${model.route}`.toLowerCase().includes(q))
  }, [availableModels, modelSearch])
  function buildChatHref(params?: URLSearchParams): string {
    const chatHomePath = pathname === '/' ? '/' : '/chat'
    const suffix = params?.toString()
    return suffix ? `${chatHomePath}?${suffix}` : chatHomePath
  }

  const currentModelDescription = currentModel?.description?.trim() || 'How can I help you today?'

  function extractThinkBlocks(raw: string): { thought: string; visible: string } {
    const input = raw || ''
    const parts: string[] = []
    const visible = input.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
      const trimmed = typeof inner === 'string' ? inner.trim() : ''
      if (trimmed) parts.push(trimmed)
      return ''
    })

    return {
      thought: parts.join('\n\n').trim(),
      visible: visible.trim()
    }
  }

  function formatChatTimestamp(iso: string): { short: string; full: string } {
    const date = new Date(iso)
    const now = new Date()
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)

    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const shortPrefix = sameDay(date, now) ? 'Today' : sameDay(date, yesterday) ? 'Yesterday' : ''
    const shortDate = shortPrefix
      ? `${shortPrefix} at ${time}`
      : `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} at ${time}`
    const full = date.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })

    return { short: shortDate, full }
  }

  function openSettings(section: ChatSettingsSection): void {
    setSettingsInitialSection(section)
    setShowSettingsModal(true)
  }

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      notify('success', 'Copied.')
    } catch {
      notify('error', 'Unable to copy.')
    }
  }

  function stopSpeaking(): void {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // ignore
    }
    setSpeakingMessageId(null)
  }

  function speakMessage(messageId: string, text: string): void {
    if (typeof window === 'undefined') return
    if (!text.trim()) return

    if (speakingMessageId === messageId) {
      stopSpeaking()
      return
    }

    stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current))
    }
    utterance.onerror = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current))
    }

    setSpeakingMessageId(messageId)
    window.speechSynthesis?.speak(utterance)
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

  useEffect(() => {
    return () => stopSpeaking()
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
      setModelSearch('')
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

  async function shareThread(threadId: string): Promise<void> {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/c/${threadId}`
    try {
      await updateChatSessionMeta(threadId, { shared: true }, loadSession()).catch(() => undefined)
      await navigator.clipboard.writeText(url)
      notify('success', 'Share link copied.')
    } catch {
      notify('error', 'Unable to copy share link.')
    }
  }

  async function downloadThread(threadId: string): Promise<void> {
    try {
      const { session } = await fetchChatSession(threadId, loadSession())
      const payload = {
        exportedAt: new Date().toISOString(),
        items: [session]
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `chat-${(session.title || 'chat').replace(/\\s+/g, '-').toLowerCase()}-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      notify('success', 'Chat downloaded.')
    } catch {
      notify('error', 'Unable to download chat.')
    }
  }

  async function cloneThread(threadId: string): Promise<void> {
    const beforeIds = new Set(threads.map((thread) => thread.id))
    try {
      const { session } = await fetchChatSession(threadId, loadSession())
      const now = new Date().toISOString()
      const clonePayload = {
        ...session,
        id: '',
        title: `Copy of ${session.title || 'Chat'}`,
        createdAt: now,
        updatedAt: now,
        archived: false,
        pinned: false,
        shared: false
      }

      await importChatSessions([clonePayload], loadSession())
      const after = await fetchChatSessions({ archived: isArchivedView }, loadSession())
      setThreads(sortThreads(after.items))

      const created = after.items.find((thread) => !beforeIds.has(thread.id))
      if (created) {
        onSelectThread(created.id)
      }

      notify('success', 'Chat cloned.')
    } catch {
      notify('error', 'Unable to clone chat.')
    }
  }

  function getThreadMenuItems(thread: OpenPortChatSession): WorkspaceResourceMenuItem[] {
    return [
      {
        icon: 'solar:share-outline',
        label: 'Share',
        onClick: () => {
          void shareThread(thread.id)
        }
      },
      {
        icon: 'solar:download-minimalistic-outline',
        label: 'Download',
        onClick: () => {
          void downloadThread(thread.id)
        }
      },
      {
        icon: 'solar:pen-outline',
        label: 'Rename',
        onClick: () => {
          const next = window.prompt('Rename chat', thread.title || '')
          if (!next?.trim()) return
          void updateChatSessionMeta(thread.id, { title: next.trim() }, loadSession())
            .then(({ session }) => {
              setThreads((current) => sortThreads(current.map((t) => (t.id === session.id ? session : t))))
              notify('success', 'Chat renamed.')
            })
            .catch(() => notify('error', 'Unable to rename chat.'))
        }
      },
      { type: 'divider', icon: '', label: '' },
      {
        icon: thread.pinned ? 'solar:pin-bold' : 'solar:pin-outline',
        label: thread.pinned ? 'Unpin' : 'Pin',
        onClick: () => updateThreadMeta({ pinned: !(thread.pinned ?? false) })
      },
      {
        icon: 'solar:copy-outline',
        label: 'Clone',
        onClick: () => {
          void cloneThread(thread.id)
        }
      },
      { type: 'divider', icon: '', label: '' },
      {
        icon: thread.archived ? 'solar:archive-up-outline' : 'solar:archive-outline',
        label: thread.archived ? 'Restore' : 'Archive',
        onClick: () => updateThreadMeta({ archived: !(thread.archived ?? false) })
      },
      {
        danger: true,
        icon: 'solar:trash-bin-trash-outline',
        label: 'Delete',
        onClick: () => {
          if (!window.confirm('Delete this chat?')) return
          void deleteChatSession(thread.id, loadSession())
            .then(() => {
              setThreads((current) => current.filter((t) => t.id !== thread.id))
              setActiveThreadId(null)
              router.push(buildChatHref())
              notify('success', 'Chat deleted.')
            })
            .catch(() => notify('error', 'Unable to delete chat.'))
        }
      }
    ]
  }

  function renderModelSelector(placement: 'header' | 'hero') {
    return (
      <div className={`chat-model-menu-wrap${placement === 'hero' ? ' is-hero' : ''}`} ref={modelMenuRef}>
        <div className={`owui-model-selector${placement === 'hero' ? ' is-hero' : ''}`}>
          <TextButton
            className={`chat-model-trigger${placement === 'hero' ? ' is-hero' : ''}`}
            onClick={() => {
            // OpenWebUI-style behavior: build the list live from runtime sources (Ollama tags + workspace models).
            if (!showModelMenu) {
              void fetchOllamaTags(null, loadSession())
                .then((payload) => {
                  const session = loadSession()
                  const workspaceId = session?.workspaceId || ''
                  const mapped = (payload.models || [])
                    .map((entry) =>
                      typeof entry?.name === 'string'
                        ? entry.name
                        : typeof entry?.model === 'string'
                          ? entry.model
                          : ''
                    )
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({
                      id: `runtime_ollama_${slugifyOllamaName(name)}`,
                      workspaceId,
                      name,
                      route: `ollama/${name}`,
                      provider: 'ollama' as const,
                      description: '',
                      tags: ['local'],
                      status: 'active' as const,
                      isDefault: false,
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
                    }))

                  setOllamaLiveModels(mapped)
                })
                .catch(() => undefined)
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

          {placement === 'header' ? (
            <IconButton
              aria-label="Add model"
              className="owui-model-add"
              onClick={() => {
                if (!showModelMenu) {
                  void fetchOllamaTags(null, loadSession())
                    .then((payload) => {
                      const session = loadSession()
                      const workspaceId = session?.workspaceId || ''
                      const mapped = (payload.models || [])
                        .map((entry) =>
                          typeof entry?.name === 'string'
                            ? entry.name
                            : typeof entry?.model === 'string'
                              ? entry.model
                              : ''
                        )
                        .map((name) => name.trim())
                        .filter(Boolean)
                        .map((name) => ({
                          id: `runtime_ollama_${slugifyOllamaName(name)}`,
                          workspaceId,
                          name,
                          route: `ollama/${name}`,
                          provider: 'ollama' as const,
                          description: '',
                          tags: ['local'],
                          status: 'active' as const,
                          isDefault: false,
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
                        }))

                      setOllamaLiveModels(mapped)
                    })
                    .catch(() => undefined)
                  void fetchWorkspaceModels(loadSession())
                    .then((response) => setModels(response.items))
                    .catch(() => undefined)
                }
                setShowModelMenu(true)
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Iconify icon="solar:add-circle-outline" size={18} />
            </IconButton>
          ) : null}
        </div>

        {placement === 'hero' ? (
          <span className={`chat-model-trigger-subtitle${placement === 'hero' ? ' is-hero' : ''}`}>
            {currentModelDescription}
          </span>
        ) : null}

        {modelMenuMounted ? (
          <div
            className={`chat-model-menu${placement === 'hero' ? ' is-hero' : ''}${modelMenuVisible ? ' is-open' : ' is-closing'}`}
          >
            <div className="owui-model-menu-search">
              <Iconify icon="solar:magnifer-outline" size={16} />
              <input
                aria-label="Search a model"
                className="owui-model-menu-search-input"
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="Search a model"
                value={modelSearch}
              />
            </div>
            <div className="chat-model-menu-list">
              {filteredModels.map((model) => (
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

    void (async () => {
      try {
        let sessionId = activeThreadId
        let createdSession: OpenPortChatSession | null = null

        // If we're starting a brand new chat, create the session and navigate first.
        // Avoid blocking the optimistic render on slow non-critical calls (like project refresh).
        if (!sessionId) {
          const created = await createChatSession(`New chat ${threads.length + 1}`, loadSession(), {
            settings: pendingSettings
          })
          sessionId = created.session.id
          createdSession = created.session
          setActiveThreadId(sessionId)

          const params = new URLSearchParams()
          params.set('thread', sessionId)
          if (selectedProjectId) params.set('project', selectedProjectId)
          if (isArchivedView) params.set('view', 'archived')
          router.push(buildChatHref(params))

          // Best-effort: assign and refresh projects in the background.
          void (async () => {
            try {
              assignThreadToProject(sessionId, selectedProjectId)
              const nextProjects = await fetchProjects(loadSession())
                .then((response) => response.items)
                .catch(() => loadProjects())
              saveProjectsToCache(nextProjects)
              setProjects(nextProjects)
            } catch {
              // ignore
            }
          })()
        }

        const optimisticBaseId = createLocalId('local_msg')
        const now = new Date().toISOString()
        const optimisticUserMessage: OpenPortChatMessage = {
          id: `${optimisticBaseId}_user`,
          role: 'user',
          content,
          createdAt: now,
          attachments: messageAttachments
        }
        const optimisticAssistantMessage: OpenPortChatMessage = {
          id: `${optimisticBaseId}_assistant`,
          role: 'assistant',
          content: '',
          createdAt: new Date(Date.now() + 1).toISOString()
        }

        // Optimistic render: show the user message immediately and a placeholder assistant "Thinking..." bubble.
        if (createdSession) {
          setThreads((current) => [
            {
              ...createdSession,
              updatedAt: optimisticAssistantMessage.createdAt,
              messages: [...createdSession.messages, optimisticUserMessage, optimisticAssistantMessage]
            },
            ...current
          ])
        } else if (sessionId) {
          setThreads((current) => {
            const nextThreads = current.map((thread) =>
              thread.id === sessionId
                ? {
                    ...thread,
                    updatedAt: optimisticAssistantMessage.createdAt,
                    messages: [...thread.messages, optimisticUserMessage, optimisticAssistantMessage]
                  }
                : thread
            )
            return sortThreads(nextThreads)
          })
        }

        startTransition(() => {
          void postChatMessage(sessionId!, content, messageAttachments, loadSession())
            .then((response) => {
              const assistant = Array.isArray(response.messages)
                ? response.messages.find((message) => message.role === 'assistant')
                : null
              if (assistant) {
                const seconds = Math.max(1, Math.round((Date.now() - Date.parse(now)) / 1000))
                setAssistantThoughtSeconds((current) => ({ ...current, [assistant.id]: seconds }))
              }
              setThreads((current) => {
                const nextThreads = current.map((thread) => {
                  if (thread.id !== response.session.id) return thread

                  const serverMessages = Array.isArray(response.session.messages) ? response.session.messages : []
                  const responseMessages = Array.isArray(response.messages) ? response.messages : []

                  // Some backends return session metadata quickly and stream messages later.
                  // Never replace a fuller local thread with a shorter server payload.
                  const mergedMessages =
                    serverMessages.length >= thread.messages.length
                      ? serverMessages
                      : responseMessages.length > 0
                        ? [...thread.messages, ...responseMessages].filter((msg, idx, all) => all.findIndex((m) => m.id === msg.id) === idx)
                        : thread.messages

                  return {
                    ...thread,
                    ...response.session,
                    messages: mergedMessages
                  }
                })
                return sortThreads(nextThreads)
              })
              setComposerAttachments([])
            })
            .catch((submitError) => {
              setDraft(content)
              setError(submitError instanceof Error ? submitError.message : 'Unable to send message')
              notify('error', 'Unable to send message.')
            })
        })
      } catch (submitError) {
        setDraft(content)
        setError(submitError instanceof Error ? submitError.message : 'Unable to send message')
        notify('error', 'Unable to send message.')
      }
    })()
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
        <div className={`chat-main-header${activeThread ? ' has-thread' : ''}`}>
          <div className="chat-main-header-copy">{renderModelSelector('header')}</div>
          <div className="chat-topbar">
            <IconButton
              aria-label="New chat"
              className="chat-topbar-icon"
              onClick={() => {
                // Mirror OpenWebUI's top-right quick action: start a new chat from anywhere.
                setActiveThreadId(null)
                const params = new URLSearchParams()
                if (selectedProjectId) params.set('project', selectedProjectId)
                if (isArchivedView) params.set('view', 'archived')
                router.push(buildChatHref(params))
              }}
              size="md"
              variant="topbar"
            >
              <Iconify icon="solar:chat-round-line-outline" size={19} />
            </IconButton>

            {activeThread ? (
              <WorkspaceResourceMenu
                ariaLabel="Open chat menu"
                items={getThreadMenuItems(activeThread)}
              />
            ) : null}
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
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1
                const attachments = Array.isArray(message.attachments) ? message.attachments : []
                const modelLabel = currentModel?.name || currentModelRoute
                const thoughtSeconds = message.role === 'assistant' ? assistantThoughtSeconds[message.id] : undefined
                const isAssistantPending = message.role === 'assistant' && !message.content.trim()
                const assistantThought =
                  message.role === 'assistant' && !isAssistantPending ? extractThinkBlocks(message.content) : null
                const assistantTimestamp =
                  message.role === 'assistant' && !isAssistantPending ? formatChatTimestamp(message.createdAt) : null

                return (
                  <article
                    className={`owui-message owui-message--${message.role}`}
                    data-message-role={message.role}
                    key={message.id}
                    style={{ '--message-enter-delay': `${Math.min(index, 10) * 26}ms` } as CSSProperties}
                  >
                    <div className="owui-message-inner">
                      {message.role === 'assistant' ? (
                        <div className="owui-assistant-head">
                          <div className="owui-assistant-model">
                            <span className="owui-assistant-mark">OI</span>
                            <span className="owui-assistant-model-name">{modelLabel}</span>
                            {assistantTimestamp ? (
                              <span
                                className="owui-assistant-timestamp owui-tooltip-target"
                                data-tooltip={assistantTimestamp.full}
                                title={assistantTimestamp.full}
                              >
                                {assistantTimestamp.short}
                              </span>
                            ) : null}
                          </div>
                          <div className="owui-assistant-meta">
                            {isAssistantPending ? (
                              <span className="owui-assistant-status">
                                <span className="owui-assistant-live-dot" aria-hidden="true" />
                                <span>Thinking...</span>
                              </span>
                            ) : thoughtSeconds ? (
                              assistantThought?.thought ? (
                                <details className="owui-thoughts">
                                  <summary>Thought for {thoughtSeconds} seconds</summary>
                                  <pre className="owui-thoughts-body">{assistantThought.thought}</pre>
                                </details>
                              ) : (
                                <span className="owui-thoughts-label">Thought for {thoughtSeconds} seconds</span>
                              )
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className={`owui-message-card${message.role === 'assistant' ? ' is-assistant' : ' is-user'}`}>
                        {attachments.length > 0 ? (
                          <div className="owui-message-attachments">
                            {attachments.map((attachment: OpenPortChatAttachment) =>
                              attachment.contentUrl ? (
                                <a
                                  className="owui-message-attachment"
                                  href={attachment.contentUrl}
                                  key={attachment.id}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <Iconify
                                    icon={attachment.type === 'web' ? 'solar:global-outline' : 'solar:folder-with-files-outline'}
                                    size={13}
                                  />
                                  <span>{attachment.label}</span>
                                </a>
                              ) : (
                                <span className="owui-message-attachment" key={attachment.id}>
                                  <Iconify
                                    icon={attachment.type === 'web' ? 'solar:global-outline' : 'solar:folder-with-files-outline'}
                                    size={13}
                                  />
                                  <span>{attachment.label}</span>
                                </span>
                              )
                            )}
                          </div>
                        ) : null}

                        <div className="owui-message-content" data-copy-response-source>
                          {isAssistantPending ? (
                            <span className="owui-thinking">
                              <span className="owui-thinking-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                              </span>
                              <span className="owui-thinking-label">Thinking...</span>
                            </span>
                          ) : (
                            assistantThought ? assistantThought.visible : message.content
                          )}
                        </div>
                      </div>

                      {message.role === 'assistant' ? (
                        <div className={`owui-assistant-actions${isLast ? ' is-visible' : ''}`}>
                          <button className="owui-assistant-action" disabled type="button">
                            <Iconify icon="solar:pen-outline" size={16} />
                          </button>
                          <button
                            className="owui-assistant-action"
                            onClick={() => {
                              void copyToClipboard(message.content)
                            }}
                            type="button"
                          >
                            <Iconify icon="solar:copy-outline" size={16} />
                          </button>
                          <button
                            className={`owui-assistant-action${speakingMessageId === message.id ? ' is-active' : ''}`}
                            onClick={() => speakMessage(message.id, message.content)}
                            type="button"
                          >
                            <Iconify icon={speakingMessageId === message.id ? 'solar:stop-outline' : 'solar:volume-loud-outline'} size={16} />
                          </button>
                          <button className="owui-assistant-action" disabled type="button">
                            <Iconify icon="solar:info-circle-outline" size={16} />
                          </button>
                          <button className="owui-assistant-action" disabled type="button">
                            <Iconify icon="solar:like-outline" size={16} />
                          </button>
                          <button className="owui-assistant-action" disabled type="button">
                            <Iconify icon="solar:dislike-outline" size={16} />
                          </button>
                          <button
                            className="owui-assistant-action"
                            onClick={() => {
                              const messageIndex = messages.findIndex((entry) => entry.id === message.id)
                              const prompt = messages
                                .slice(0, messageIndex)
                                .reverse()
                                .find((entry) => entry.role === 'user')?.content
                              if (prompt) submitMessage(prompt)
                            }}
                            type="button"
                          >
                            <Iconify icon="solar:refresh-outline" size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
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
