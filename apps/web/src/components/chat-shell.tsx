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
import { flushSync } from 'react-dom'
import type { OpenPortProjectCollaborationState, OpenPortProjectKnowledgeMatch } from '@openport/product-contracts'
import {
  buildProjectEventsUrl,
  clearSession,
  createChatSession,
  deleteChatSession,
  fetchChatSession,
  fetchChatTasksBySession,
  fetchChatSessions,
  fetchProjectCollaboration,
  fetchProjects,
  fetchOllamaTags,
  fetchWorkspaceModels,
  importChatSessions,
  loadSession,
  cancelChatTask,
  postChatMessageStream,
  searchProjectKnowledge,
  updateChatSessionMeta,
  updateChatSessionSettings,
  OpenPortApiError,
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
import { ChatMarkdown } from './chat-markdown'
import { ChatSettingsModal, type ChatSettingsSection } from './chat-settings-modal'
import { ChatStatusHistory } from './chat-status-history'
import { useAppShellState } from './app-shell-state'
import { Iconify } from './iconify'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

type OpenPortChatAttachment = NonNullable<OpenPortChatMessage['attachments']>[number]
type AssistantStatusEntry = NonNullable<OpenPortChatMessage['statusHistory']>[number]
type QueuedSubmission = {
  id: string
  content: string
  attachments: OpenPortChatMessage['attachments']
}

const RUNTIME_MODEL_ROUTE = 'openport/local'
const CHAT_ACTIVE_EVENT = 'chat:active'
const CHAT_TASKS_EVENT = 'chat:tasks'
const CHAT_TASKS_CANCEL_EVENT = 'chat:tasks:cancel'

function isRuntimeModelRoute(route: string | null | undefined): boolean {
  return (route || '').trim().toLowerCase() === RUNTIME_MODEL_ROUTE
}

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

type ChatErrorPresentation = {
  code: string
  title: string
  message: string
  statusAction: string
}

function toChatErrorPresentation(error: unknown): ChatErrorPresentation {
  const fallback = {
    code: 'GENERATION_FAILED',
    title: '生成失败',
    message: '当前无法完成回复，请稍后重试。',
    statusAction: 'error_generation_failed'
  }

  const fromCode = (code: string, fallbackMessage: string): ChatErrorPresentation => {
    switch (code) {
      case 'MODEL_UNAVAILABLE':
        return {
          code,
          title: '模型不可用',
          message: '当前模型离线或不可访问，请检查模型服务后重试。',
          statusAction: 'error_model_unavailable'
        }
      case 'MODEL_TIMEOUT':
        return {
          code,
          title: '模型响应超时',
          message: '模型响应超时，请稍后重试。',
          statusAction: 'error_model_timeout'
        }
      case 'MODEL_ROUTE_INVALID':
        return {
          code,
          title: '模型配置异常',
          message: '当前会话模型配置无效，请重新选择模型后重试。',
          statusAction: 'error_model_route_invalid'
        }
      case 'MODEL_EMPTY_RESPONSE':
        return {
          code,
          title: '模型返回为空',
          message: '模型未返回有效内容，请重试。',
          statusAction: 'error_model_empty_response'
        }
      case 'MODEL_REQUEST_FAILED':
        return {
          code,
          title: '请求被模型拒绝',
          message: fallbackMessage || '请求参数不被当前模型接受，请调整后重试。',
          statusAction: 'error_model_request_failed'
        }
      default:
        return {
          ...fallback,
          message: fallbackMessage || fallback.message
        }
    }
  }

  if (error instanceof OpenPortApiError) {
    return fromCode(error.code || fallback.code, error.message || fallback.message)
  }

  if (error instanceof Error) {
    const raw = error.message || ''
    if (!raw) return fallback
    try {
      const parsed = JSON.parse(raw) as { message?: string | string[]; code?: string }
      const parsedMessage =
        typeof parsed?.message === 'string'
          ? parsed.message.trim()
          : Array.isArray(parsed?.message)
            ? parsed.message.filter((value): value is string => typeof value === 'string').join('; ').trim()
            : ''
      return fromCode(parsed?.code || fallback.code, parsedMessage || raw)
    } catch {
      return fromCode(fallback.code, raw)
    }
  }

  return fallback
}

function mapOllamaTagsToModels(payload: any, workspaceId: string): OpenPortWorkspaceModel[] {
  const names = (payload?.models || [])
    .map((entry: any) =>
      typeof entry?.name === 'string' ? entry.name : typeof entry?.model === 'string' ? entry.model : ''
    )
    .map((name: string) => name.trim())
    .filter(Boolean)

  return names.map((name: string) => ({
    id: `runtime_ollama_${slugifyOllamaName(name)}`,
    workspaceId,
    name,
    route: `ollama/${name}`,
    provider: 'ollama' as const,
    source: 'runtime' as const,
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
  const [modelsBootstrapped, setModelsBootstrapped] = useState(false)
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [messageQueue, setMessageQueue] = useState<QueuedSubmission[]>([])
  const [taskSyncReady, setTaskSyncReady] = useState(false)
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([])
  const collaborationModeRef = useRef<'viewing' | 'editing'>('viewing')
  const isGeneratingRef = useRef(false)
  const activeGenerationAbortsRef = useRef<Set<AbortController>>(new Set())
  const pendingGenerationsRef = useRef(0)
  const activeTaskIdsRef = useRef<string[]>([])
  const messageQueueRef = useRef<QueuedSubmission[]>([])
  const activeQueueKeyRef = useRef<string | null>(null)
  const queueDrainInFlightRef = useRef(false)
  const priorityQueuedSubmissionRef = useRef<QueuedSubmission | null>(null)
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
  const isTemporaryChat = (() => {
    const value = searchParams.get('temporary-chat')
    return value === 'true' || value === '1'
  })()
  const temporaryChatKey = searchParams.get('tempKey') || 'default'
  const [speechMode, setSpeechMode] = useState<'dictation' | 'voice' | null>(null)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [expandedStatusHistory, setExpandedStatusHistory] = useState<Record<string, boolean>>({})
  const runtimeRouteUpgradeAttemptedRef = useRef<Record<string, true>>({})
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const autoScrollRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || null
  const messages: OpenPortChatMessage[] = activeThread?.messages || []
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ||
    projects.find((project) => project.id === activeThread?.settings.projectId) ||
    null
  const accountInitial = (session?.name || session?.email || 'O').trim().charAt(0).toUpperCase()
  const userDisplayName = (session?.name || session?.email || 'You').trim() || 'You'
  const mergedModels = useMemo(() => {
    const merged = new Map<string, OpenPortWorkspaceModel>()
    ;[...ollamaLiveModels, ...models].forEach((model) => {
      if (!model?.route) return
      const key = model.route.trim().toLowerCase()
      if (!merged.has(key)) merged.set(key, model)
    })
    return Array.from(merged.values())
  }, [models, ollamaLiveModels])
  const hasNonRuntimeModels = mergedModels.some((model) => model.route && !isRuntimeModelRoute(model.route))
  const defaultNonRuntimeRoute = mergedModels.find((model) => model.route && !isRuntimeModelRoute(model.route))?.route || null
  const currentModelRoute = activeThread?.settings.valves.modelRoute || pendingSettings.valves.modelRoute
  const normalizedCurrentModelRoute = (currentModelRoute || '').trim().toLowerCase()
  const currentModel =
    mergedModels.find((model) => (model.route || '').trim().toLowerCase() === normalizedCurrentModelRoute) || {
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
  const queueStorageKey =
    isTemporaryChat
      ? `openport:chat:queue:temporary:${temporaryChatKey}`
      : activeThreadId
        ? `openport:chat:queue:${activeThreadId}`
        : null
  const enableMessageQueue = uiPreferences.enableMessageQueue
  const projectBackgroundImage = selectedProject?.meta.backgroundImageUrl?.trim() || ''
  const chatMainStageStyle = !isTemporaryChat && projectBackgroundImage
    ? ({
        backgroundImage: `linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.88)), url("${projectBackgroundImage.replace(/"/g, '\\"')}")`
      } as CSSProperties)
    : undefined
  const availableModels = useMemo(() => {
    const next = hasNonRuntimeModels
      ? mergedModels.filter((model) => model.route && !isRuntimeModelRoute(model.route))
      : [...mergedModels]
    if (
      !next.some((model) => (model.route || '').trim().toLowerCase() === normalizedCurrentModelRoute) &&
      !(hasNonRuntimeModels && isRuntimeModelRoute(currentModelRoute))
    ) {
      next.unshift(currentModel)
    }
    return next
  }, [currentModel, currentModelRoute, hasNonRuntimeModels, mergedModels, normalizedCurrentModelRoute])

  const modelLabel = useMemo(() => {
    if (!modelsBootstrapped) return 'Loading models…'
    if (!hasNonRuntimeModels && isRuntimeModelRoute(currentModelRoute)) return 'OpenPort: No models available'
    if (hasNonRuntimeModels && isRuntimeModelRoute(currentModelRoute)) {
      return 'OpenPort: Selecting model…'
    }
    return currentModel?.name || currentModelRoute
  }, [currentModel?.name, currentModelRoute, hasNonRuntimeModels, modelsBootstrapped])

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

  function getLobeIconForModel(route: string, name: string, provider: string | null | undefined): string | null {
    const providerKey = (provider || '').trim().toLowerCase()
    const routeKey = (route || '').trim().toLowerCase()
    const label = `${name} ${routeKey} ${providerKey}`.toLowerCase()

    // Prefer model-specific icons when available.
    if (label.includes('qwen')) return '/vendor/lobe-icons/icons/qwen-color.svg'
    if (label.includes('deepseek')) return '/vendor/lobe-icons/icons/deepseek-color.svg'
    if (label.includes('mistral')) return '/vendor/lobe-icons/icons/mistral-color.svg'
    if (label.includes('gemini')) return '/vendor/lobe-icons/icons/gemini-color.svg'
    if (label.includes('gemma')) return '/vendor/lobe-icons/icons/gemma-color.svg'

    // Llama (Meta) family.
    if (label.includes('llama')) return '/vendor/lobe-icons/icons/meta-color.svg'

    // Provider-based fallbacks (prefer provider field, then route prefix).
    if (providerKey === 'openai') return '/vendor/lobe-icons/icons/openai.svg'
    if (providerKey === 'anthropic') return '/vendor/lobe-icons/icons/anthropic.svg'
    if (providerKey === 'google') return '/vendor/lobe-icons/icons/gemini-color.svg'
    if (providerKey === 'meta') return '/vendor/lobe-icons/icons/meta-color.svg'
    if (providerKey === 'xai') return '/vendor/lobe-icons/icons/xai.svg'
    if (providerKey === 'microsoft') return '/vendor/lobe-icons/icons/microsoft.svg'
    if (providerKey === 'azure') return '/vendor/lobe-icons/icons/azure.svg'
    if (providerKey === 'alibaba') return '/vendor/lobe-icons/icons/alibaba.svg'
    if (providerKey === 'ollama') return '/vendor/lobe-icons/icons/ollama.svg'

    const prefix = routeKey.split('/')[0] || ''
    if (prefix === 'openai') return '/vendor/lobe-icons/icons/openai.svg'
    if (prefix === 'anthropic') return '/vendor/lobe-icons/icons/anthropic.svg'
    if (prefix === 'google') return '/vendor/lobe-icons/icons/gemini-color.svg'
    if (prefix === 'ollama') return '/vendor/lobe-icons/icons/ollama.svg'
    if (prefix === 'xai') return '/vendor/lobe-icons/icons/xai.svg'
    if (prefix === 'microsoft') return '/vendor/lobe-icons/icons/microsoft.svg'
    if (prefix === 'azure') return '/vendor/lobe-icons/icons/azure.svg'
    if (prefix === 'alibaba') return '/vendor/lobe-icons/icons/alibaba.svg'

    return null
  }

  function getModelMonogram(route: string, name: string): { text: string; palette: { bg: string; fg: string } } {
    const label = `${name} ${route}`.toLowerCase()

    if (label.includes('qwen')) return { text: 'QW', palette: { bg: '#111111', fg: '#ffffff' } }
    if (label.includes('llama') || label.includes('lLaMA'.toLowerCase())) return { text: 'LL', palette: { bg: '#0f172a', fg: '#ffffff' } }
    if (label.includes('mistral')) return { text: 'MI', palette: { bg: '#111111', fg: '#ffffff' } }
    if (label.includes('deepseek')) return { text: 'DS', palette: { bg: '#111111', fg: '#ffffff' } }
    if (label.includes('gemma')) return { text: 'GE', palette: { bg: '#111111', fg: '#ffffff' } }
    if (label.includes('phi')) return { text: 'PH', palette: { bg: '#111111', fg: '#ffffff' } }

    if (route.startsWith('openai/')) return { text: 'OA', palette: { bg: '#111111', fg: '#ffffff' } }
    if (route.startsWith('anthropic/')) return { text: 'AN', palette: { bg: '#111111', fg: '#ffffff' } }
    if (route.startsWith('google/')) return { text: 'GG', palette: { bg: '#111111', fg: '#ffffff' } }
    if (route.startsWith('ollama/')) return { text: 'OL', palette: { bg: '#111111', fg: '#ffffff' } }

    return { text: 'AI', palette: { bg: '#111111', fg: '#ffffff' } }
  }

  function renderModelAvatar(model: OpenPortWorkspaceModel) {
    const iconSrc = getLobeIconForModel(model.route, model.name, model.provider)
    if (iconSrc) {
      return (
        <span className="owui-assistant-mark owui-assistant-mark--icon" aria-label={`${model.name} icon`}>
          <img alt="" aria-hidden="true" className="owui-assistant-icon" src={iconSrc} />
        </span>
      )
    }

    const { text, palette } = getModelMonogram(model.route, model.name)
    return (
      <span
        className="owui-assistant-mark owui-assistant-mark--avatar"
        style={
          {
            '--owui-avatar-bg': palette.bg,
            '--owui-avatar-fg': palette.fg
          } as CSSProperties
        }
        aria-label={`${model.name} avatar`}
      >
        {text}
      </span>
    )
  }

  function extractThinkBlocks(raw: string): { thought: string; visible: string } {
    const input = raw || ''
    const parts: string[] = []
    let visible = input.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
      const trimmed = typeof inner === 'string' ? inner.trim() : ''
      if (trimmed) parts.push(trimmed)
      return ''
    })

    // Some local model stacks emit a leading "Thinking..." line instead of <think> blocks.
    // Treat only a leading thinking line as thought, and keep the rest of the response intact.
    if (parts.length === 0) {
      const leadingThinking = visible.match(
        /^\s*(?:[-*•]\s*)?(?:thinking|思考中)(?:\s*\.\.\.)?\s*(?:\r?\n)+(.*)$/is
      )
      if (leadingThinking) {
        parts.push(visible.slice(0, visible.length - leadingThinking[1].length).trim())
        visible = leadingThinking[1]
      }
    }

    return {
      thought: parts.join('\n\n').trim(),
      visible: visible.trim()
    }
  }

  function stripDetailsMarkup(raw: string): string {
    const input = raw || ''
    // Best-effort: remove <details>/<summary> blocks that upstream UI hides from copies.
    return input
      .replace(/<details[\s\S]*?>[\s\S]*?<\/details>/gi, '')
      .replace(/<summary[\s\S]*?>[\s\S]*?<\/summary>/gi, '')
      .trim()
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

  function formatStatusDescription(entry: AssistantStatusEntry): string {
    const action = String(entry.action || '')
    const description = String(entry.description || '')
    const urls = Array.isArray(entry.urls) ? entry.urls : []
    const extra = entry as { items?: unknown[]; queries?: unknown[]; count?: unknown }
    const items = Array.isArray(extra.items) ? extra.items : []
    const queries = Array.isArray(extra.queries) ? extra.queries.filter((query): query is string => typeof query === 'string') : []
    const countValue = typeof extra.count === 'number' ? Number(extra.count) : null

    if (action === 'knowledge_search' && entry.query) {
      return `Searching Knowledge for "${entry.query}"`
    }
    if ((action === 'web_search_queries_generated' || action === 'queries_generated') && queries.length > 0) {
      return action === 'web_search_queries_generated' ? 'Searching' : 'Querying'
    }
    if (action === 'sources_retrieved' && countValue !== null) {
      if (countValue <= 0) return 'No sources found'
      if (countValue === 1) return 'Retrieved 1 source'
      return `Retrieved ${countValue} sources`
    }
    if (action === 'web_search' && description.includes('{{count}}')) {
      return description.replace('{{count}}', String(Math.max(urls.length, items.length)))
    }
    if (description === 'No search query generated') return 'No search query generated'
    if (description === 'Generating search query') return 'Generating search query'
    if (description === 'Searching the web') return 'Searching the web'
    if (description.includes('{{searchQuery}}')) {
      return description.replace('{{searchQuery}}', entry.query || '')
    }
    return description || 'Working…'
  }

  function isSameStatusEntry(left: AssistantStatusEntry, right: AssistantStatusEntry): boolean {
    return (
      left.done === right.done &&
      String(left.action || '') === String(right.action || '') &&
      String(left.description || '') === String(right.description || '') &&
      Boolean(left.hidden) === Boolean(right.hidden) &&
      String(left.query || '') === String(right.query || '') &&
      Number(left.count ?? -1) === Number(right.count ?? -1) &&
      JSON.stringify(Array.isArray(left.urls) ? left.urls : []) === JSON.stringify(Array.isArray(right.urls) ? right.urls : []) &&
      JSON.stringify(Array.isArray(left.queries) ? left.queries : []) ===
        JSON.stringify(Array.isArray(right.queries) ? right.queries : [])
    )
  }

  function dedupeStatusHistory(entries: AssistantStatusEntry[]): AssistantStatusEntry[] {
    if (entries.length <= 1) return entries
    const next: AssistantStatusEntry[] = []
    for (const entry of entries) {
      const previous = next.at(-1)
      if (previous && isSameStatusEntry(previous, entry)) continue
      next.push(entry)
    }
    return next
  }

  function extractStatusTags(entry: AssistantStatusEntry): string[] {
    const action = String(entry.action || '')
    if (action === 'web_search_queries_generated' || action === 'queries_generated') {
      return Array.isArray(entry.queries)
        ? entry.queries.filter((query): query is string => typeof query === 'string').slice(0, 6)
        : []
    }
    if (action === 'web_search') {
      const urls = Array.isArray(entry.urls) ? entry.urls : []
      const items = Array.isArray(entry.items) ? entry.items : []
      const itemUrls = items
        .map((item) => {
          const value = (item?.url || item?.link || item?.href || item?.source || '') as unknown
          return typeof value === 'string' ? value : ''
        })
        .filter(Boolean)
      return [...urls, ...itemUrls].slice(0, 6)
    }
    return []
  }

  function deriveReasoningFromStatuses(entries: AssistantStatusEntry[]): string {
    if (entries.length === 0) return ''
    const ignoredActions = new Set(['queued', 'response_stream_start', 'persisting', 'reasoning_complete'])
    const lines: string[] = []
    for (const entry of entries) {
      const action = String(entry.action || '')
      const description = String(entry.description || '').trim()
      if (!description || ignoredActions.has(action) || entry.hidden === true) continue
      if (lines.at(-1) === description) continue
      lines.push(description)
    }
    return lines.join('\n')
  }

  function mergeMessagesWithUiState(
    nextMessages: OpenPortChatMessage[],
    currentMessages: OpenPortChatMessage[]
  ): OpenPortChatMessage[] {
    if (currentMessages.length === 0) return nextMessages
    const currentById = new Map(currentMessages.map((message) => [message.id, message]))
    return nextMessages.map((message) => {
      const current = currentById.get(message.id)
      if (!current) return message
      return {
        ...message,
        streamState: message.streamState ?? current.streamState,
        thoughtSeconds: message.thoughtSeconds ?? current.thoughtSeconds,
        reasoningContent: message.reasoningContent ?? current.reasoningContent,
        statusHistory: message.statusHistory ?? current.statusHistory
      }
    })
  }

  function resolveSessionMessages(
    serverMessages: OpenPortChatMessage[],
    localMessages: OpenPortChatMessage[],
    responseMessages: OpenPortChatMessage[] = []
  ): OpenPortChatMessage[] {
    if (serverMessages.length >= localMessages.length) {
      return mergeMessagesWithUiState(serverMessages, localMessages)
    }
    if (responseMessages.length > 0) {
      return [...localMessages, ...responseMessages].filter(
        (message, index, all) => all.findIndex((item) => item.id === message.id) === index
      )
    }
    return localMessages
  }

  function scrollToLatest(behavior: ScrollBehavior = 'auto'): void {
    try {
      bottomSentinelRef.current?.scrollIntoView({ behavior, block: 'end' })
    } catch {
      // ignore
    }
  }

  function openSettings(section: ChatSettingsSection): void {
    setSettingsInitialSection(section)
    setShowSettingsModal(true)
  }

  async function copyToClipboard(text: string): Promise<void> {
    try {
      const { visible } = extractThinkBlocks(text)
      await navigator.clipboard.writeText(stripDetailsMarkup(visible))
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

  useEffect(() => {
    activeTaskIdsRef.current = activeTaskIds
    const nextGenerating = pendingGenerationsRef.current > 0 || activeTaskIds.length > 0
    setIsGenerating(nextGenerating)
    isGeneratingRef.current = nextGenerating
  }, [activeTaskIds])

  useEffect(() => {
    messageQueueRef.current = messageQueue
  }, [messageQueue])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const previousKey = activeQueueKeyRef.current
    if (previousKey && previousKey !== queueStorageKey) {
      const previousQueue = messageQueueRef.current
      if (previousQueue.length === 0) {
        window.sessionStorage.removeItem(previousKey)
      } else {
        window.sessionStorage.setItem(previousKey, JSON.stringify(previousQueue))
      }
    }

    activeQueueKeyRef.current = queueStorageKey

    if (!queueStorageKey) {
      setMessageQueue([])
      return
    }

    try {
      const raw = window.sessionStorage.getItem(queueStorageKey)
      if (!raw) {
        setMessageQueue([])
        return
      }
      const parsed = JSON.parse(raw) as QueuedSubmission[]
      if (!Array.isArray(parsed)) {
        setMessageQueue([])
        return
      }
      const normalized = parsed
        .filter((item) => item && typeof item.content === 'string')
        .map((item) => ({
          id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : createLocalId('queued'),
          content: item.content,
          attachments: Array.isArray(item.attachments) ? item.attachments : []
        }))
      setMessageQueue(normalized)
    } catch {
      setMessageQueue([])
    }
  }, [queueStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = activeQueueKeyRef.current
    if (!key) return
    if (messageQueue.length === 0) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, JSON.stringify(messageQueue))
  }, [messageQueue])

  useEffect(() => {
    if (enableMessageQueue) return
    setMessageQueue([])
    if (typeof window === 'undefined') return
    const key = activeQueueKeyRef.current
    if (!key) return
    window.sessionStorage.removeItem(key)
  }, [enableMessageQueue])

  useEffect(() => {
    if (isGenerating) return
    if (!taskSyncReady) return
    const target = priorityQueuedSubmissionRef.current
    if (!target) return
    priorityQueuedSubmissionRef.current = null
    submitMessage(target.content, target.attachments)
  }, [isGenerating, taskSyncReady])

  useEffect(() => {
    if (isGenerating) return
    if (!taskSyncReady) return
    if (priorityQueuedSubmissionRef.current) return
    if (messageQueue.length === 0) return
    if (queueDrainInFlightRef.current) return

    queueDrainInFlightRef.current = true
    const queueSnapshot = [...messageQueue]
    setMessageQueue([])

    const dedupedAttachments = queueSnapshot
      .flatMap((entry) => (Array.isArray(entry.attachments) ? entry.attachments : []))
      .filter(
        (attachment, index, all) =>
          all.findIndex((candidate) => (candidate?.id || '') === (attachment?.id || '')) === index
      )
    const combinedPrompt = queueSnapshot
      .map((entry) => entry.content.trim())
      .filter(Boolean)
      .join('\n\n')

    window.setTimeout(() => {
      queueDrainInFlightRef.current = false
      submitMessage(combinedPrompt, dedupedAttachments)
    }, 0)
  }, [isGenerating, messageQueue, taskSyncReady])

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
        const session = loadSession()
        const workspaceId = session?.workspaceId || ''
        const [projectsResponse, response, modelsResponse, ollamaResponse] = await Promise.all([
          fetchProjects(session),
          fetchChatSessions({ archived: isArchivedView }, session),
          fetchWorkspaceModels(session).catch(() => ({ items: [] })),
          fetchOllamaTags(null, session).catch(() => null)
        ])
        if (!isActive) return

        const nextThreads = response.items
        setThreads(nextThreads)
        saveProjectsToCache(projectsResponse.items)
        setProjects(projectsResponse.items)
        setModels(modelsResponse.items)
        if (ollamaResponse) setOllamaLiveModels(mapOllamaTagsToModels(ollamaResponse, workspaceId))
        setModelsBootstrapped(true)
      } catch (loadError) {
        if (!isActive) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load chat sessions')
        setProjects(loadProjects())
        setModelsBootstrapped(true)
      }
    }

    void load()
    return () => {
      isActive = false
    }
  }, [isArchivedView])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.openportTemporaryChat = isTemporaryChat ? 'true' : 'false'
    return () => {
      document.documentElement.dataset.openportTemporaryChat = 'false'
    }
  }, [isTemporaryChat])

  useEffect(() => {
    setTaskSyncReady(false)
    if (!activeThreadId) {
      setActiveTaskIds([])
      setTaskSyncReady(true)
      return
    }
    let cancelled = false
    const sessionSnapshot = loadSession()

    void fetchChatTasksBySession(activeThreadId, sessionSnapshot)
      .then((result) => {
        if (cancelled) return
        const taskIds = Array.isArray(result.task_ids)
          ? result.task_ids.filter((taskId): taskId is string => typeof taskId === 'string')
          : []
        setActiveTaskIds(taskIds)
        setTaskSyncReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setActiveTaskIds([])
        setTaskSyncReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId || activeTaskIds.length === 0) return
    let cancelled = false
    const sessionSnapshot = loadSession()
    const intervalId = window.setInterval(() => {
      void fetchChatTasksBySession(activeThreadId, sessionSnapshot)
        .then((result) => {
          if (cancelled) return
          const taskIds = Array.isArray(result.task_ids)
            ? result.task_ids.filter((taskId): taskId is string => typeof taskId === 'string')
            : []
          if (taskIds.length > 0) {
            setActiveTaskIds(taskIds)
            return
          }
          setActiveTaskIds([])
          void fetchChatSession(activeThreadId, sessionSnapshot)
            .then(({ session: nextSession }) => {
              if (cancelled) return
              setThreads((current) =>
                sortThreads(
                  current.map((thread) =>
                    thread.id === nextSession.id
                      ? {
                          ...nextSession,
                          messages: resolveSessionMessages(nextSession.messages, thread.messages)
                        }
                      : thread
                  )
                )
              )
            })
            .catch(() => {})
        })
        .catch(() => {})
    }, 1400)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeThreadId, activeTaskIds.length])

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
    if (activeThreadId) return
    if (!hasNonRuntimeModels) return
    if (!isRuntimeModelRoute(pendingSettings.valves.modelRoute)) return

    if (!defaultNonRuntimeRoute) return

    setPendingSettings((current) =>
      isRuntimeModelRoute(current.valves.modelRoute)
        ? {
            ...current,
            valves: {
              ...current.valves,
              modelRoute: defaultNonRuntimeRoute
            }
          }
        : current
    )
  }, [activeThreadId, defaultNonRuntimeRoute, hasNonRuntimeModels, pendingSettings.valves.modelRoute])

  useEffect(() => {
    if (!activeThreadId) return
    if (!activeThread) return
    if (!hasNonRuntimeModels) return
    if (!defaultNonRuntimeRoute) return

    const route = activeThread.settings?.valves?.modelRoute
    if (!isRuntimeModelRoute(route)) {
      delete runtimeRouteUpgradeAttemptedRef.current[activeThreadId]
      return
    }

    if (runtimeRouteUpgradeAttemptedRef.current[activeThreadId]) return
    runtimeRouteUpgradeAttemptedRef.current[activeThreadId] = true

    const nextSettings = {
      ...activeThread.settings,
      valves: {
        ...activeThread.settings.valves,
        modelRoute: defaultNonRuntimeRoute
      }
    }

    setThreads((current) =>
      sortThreads(
        current.map((thread) => (thread.id === activeThreadId ? { ...thread, settings: nextSettings } : thread))
      )
    )

    void updateChatSessionSettings(activeThreadId, nextSettings, loadSession())
      .then(({ session: nextSession }) => {
        setThreads((current) =>
          sortThreads(current.map((thread) => (thread.id === nextSession.id ? nextSession : thread)))
        )
      })
      .catch(() => {})
  }, [activeThread, activeThreadId, defaultNonRuntimeRoute, hasNonRuntimeModels])

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

    // In Temporary chat we keep the active thread in memory and do not require `thread=<id>` in the URL.
    // Avoid clobbering the in-memory `activeThreadId` after the first message creates a session.
    if (isTemporaryChat && !nextThreadId) return

    setActiveThreadId(nextThreadId)
  }, [isTemporaryChat, searchParams])

  useEffect(() => {
    if (!isTemporaryChat) return
    // Starting a new temporary chat (tempKey changes) should reset the in-memory thread.
    setActiveThreadId(null)
    setDraft('')
    setError(null)
    setComposerAttachments([])
    setKnowledgeMatches([])
    setIsSearchingKnowledge(false)
    activeGenerationAbortsRef.current.forEach((controller) => controller.abort())
    activeGenerationAbortsRef.current.clear()
    pendingGenerationsRef.current = 0
    queueDrainInFlightRef.current = false
    setIsGenerating(false)
    isGeneratingRef.current = false
    setTaskSyncReady(true)
    setActiveTaskIds([])
    setMessageQueue([])
    setExpandedStatusHistory({})
    setShowJumpToLatest(false)
    setShowToolsMenu(false)
    setShowAccountMenu(false)
    setShowModelMenu(false)
  }, [isTemporaryChat, temporaryChatKey])

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

          return current.map((thread) => {
            if (thread.id !== session.id) return thread
            const serverMessages = Array.isArray(session.messages) ? session.messages : []
            const localMessages = Array.isArray(thread.messages) ? thread.messages : []
            return {
              ...thread,
              ...session,
              // Avoid clobbering optimistic/local messages (especially right after creating a session).
              messages: resolveSessionMessages(serverMessages, localMessages)
            }
          })
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
    if (typeof window === 'undefined') return

    const threshold = 140
    const handleScroll = () => {
      const doc = document.documentElement
      const distance = doc.scrollHeight - (window.scrollY + window.innerHeight)
      const nearBottom = distance <= threshold

      if (nearBottom) {
        autoScrollRef.current = true
        setShowJumpToLatest(false)
        return
      }

      // User scrolled away from the bottom: stop auto-scrolling and show the jump affordance.
      autoScrollRef.current = false
      setShowJumpToLatest(true)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
                ? current.map((thread) =>
                    thread.id === nextSession.id
                      ? {
                          ...nextSession,
                          messages: resolveSessionMessages(nextSession.messages, thread.messages)
                        }
                      : thread
                  )
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
                  ? current.map((thread) =>
                      thread.id === nextSession.id
                        ? {
                            ...nextSession,
                            messages: resolveSessionMessages(nextSession.messages, thread.messages)
                          }
                        : thread
                    )
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
            // upstream UI-style behavior: build the list live from runtime sources (Ollama tags + workspace models).
            if (!showModelMenu) {
              void fetchOllamaTags(null, loadSession())
                .then((payload) => {
                  const session = loadSession()
                  const workspaceId = session?.workspaceId || ''
                  setOllamaLiveModels(mapOllamaTagsToModels(payload, workspaceId))
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
                <span>{modelLabel}</span>
              </span>
            ) : (
              <span>{modelLabel}</span>
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
                      setOllamaLiveModels(mapOllamaTagsToModels(payload, workspaceId))
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
                <div
                  className={`chat-model-menu-item-row${
                    (model.route || '').trim().toLowerCase() === normalizedCurrentModelRoute ? ' is-active' : ''
                  }`}
                  key={model.id}
                >
                  <TextButton
                    active={(model.route || '').trim().toLowerCase() === normalizedCurrentModelRoute}
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
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            if (event.shiftKey) return
            // Avoid breaking IME composition (e.g. Chinese/Japanese input)
            if ((event.nativeEvent as any)?.isComposing) return

            event.preventDefault()
            submitMessage(draft)
          }}
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

            {isGenerating ? (
              <CapsuleButton
                className="chat-send-button"
                onClick={stopGeneration}
                size="icon"
                type="button"
                variant="primary"
              >
                <Iconify icon="solar:stop-circle-outline" size={17} />
              </CapsuleButton>
            ) : !draft.trim() && composerAttachments.length === 0 ? (
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
                disabled={!draft.trim() && composerAttachments.length === 0}
                size="icon"
                type="submit"
                variant="primary"
              >
                <Iconify icon="solar:arrow-up-outline" size={17} />
              </CapsuleButton>
            )}
          </div>
        </div>
        </form>
        {messageQueue.length > 0 ? (
          <div className="chat-composer-queue-panel">
            <div className="chat-composer-queue-head">
              <span className="chat-composer-queue-note">Queued messages: {messageQueue.length}</span>
            </div>
            <ul className="chat-composer-queue-list">
              {messageQueue.map((item, index) => (
                <li className="chat-composer-queue-item" key={item.id}>
                  <p className="chat-composer-queue-content">{(item.content || '').trim() || 'Attachment-only message'}</p>
                  <div className="chat-composer-queue-actions">
                    <TextButton
                      onClick={() => prioritizeQueuedSubmission(item.id)}
                      size="sm"
                      type="button"
                      variant="inline"
                    >
                      {index === 0 ? 'Next' : 'Move next'}
                    </TextButton>
                    <TextButton onClick={() => sendQueuedSubmissionNow(item.id)} size="sm" type="button" variant="inline">
                      Send now
                    </TextButton>
                    <TextButton onClick={() => editQueuedSubmission(item.id)} size="sm" type="button" variant="inline">
                      Edit
                    </TextButton>
                    <TextButton
                      danger
                      onClick={() => removeQueuedSubmission(item.id)}
                      size="sm"
                      type="button"
                      variant="inline"
                    >
                      Remove
                    </TextButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

    setThreads((current) =>
      sortThreads(
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
    )

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

  function stopGeneration(): void {
    const taskIds = activeTaskIdsRef.current
    if (taskIds.length > 0) {
      void Promise.all(taskIds.map((taskId) => cancelChatTask(taskId, loadSession()).catch(() => ({ ok: false }))))
    }
    activeGenerationAbortsRef.current.forEach((controller) => controller.abort())
    activeGenerationAbortsRef.current.clear()
    pendingGenerationsRef.current = 0
    const nextGenerating = activeTaskIdsRef.current.length > 0
    setIsGenerating(nextGenerating)
    isGeneratingRef.current = nextGenerating
  }

  function removeQueuedSubmission(id: string): void {
    setMessageQueue((current) => current.filter((entry) => entry.id !== id))
  }

  function prioritizeQueuedSubmission(id: string): void {
    setMessageQueue((current) => {
      const index = current.findIndex((entry) => entry.id === id)
      if (index <= 0) return current
      const next = [...current]
      const [target] = next.splice(index, 1)
      next.unshift(target)
      return next
    })
  }

  function sendQueuedSubmissionNow(id: string): void {
    const target = messageQueueRef.current.find((entry) => entry.id === id) ?? null
    if (!target) return
    setMessageQueue((current) => current.filter((entry) => entry.id !== id))
    if (isGeneratingRef.current) {
      priorityQueuedSubmissionRef.current = target
      stopGeneration()
      return
    }
    submitMessage(target.content, target.attachments)
  }

  function editQueuedSubmission(id: string): void {
    const target = messageQueueRef.current.find((entry) => entry.id === id) ?? null
    if (!target) return
    setMessageQueue((current) => current.filter((entry) => entry.id !== id))
    const restoredAttachments: ComposerAttachment[] = (Array.isArray(target.attachments) ? target.attachments : []).map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      label: attachment.label,
      meta: attachment.meta,
      payload: attachment.payload,
      assetId: attachment.assetId ?? null,
      contentUrl: attachment.contentUrl ?? null
    }))
    setDraft(target.content)
    setComposerAttachments(restoredAttachments)
    setShowToolsMenu(false)
  }

  function emitLifecycleEvent(name: string, detail: Record<string, unknown>): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }

  function submitMessage(
    rawContent: string,
    prebuiltAttachments: OpenPortChatMessage['attachments'] | null = null
  ): void {
    const content = rawContent.trim() || 'Use the attached context.'
    const messageAttachments =
      prebuiltAttachments ??
      composerAttachments.map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        label: attachment.label,
        meta: attachment.meta,
        payload: attachment.payload,
        assetId: attachment.assetId ?? null,
        contentUrl: attachment.contentUrl ?? null
      }))

    if (!content.trim() && (messageAttachments?.length ?? 0) === 0) return

    const selectedRouteForSubmit = String(
      activeThread?.settings?.valves?.modelRoute || pendingSettings?.valves?.modelRoute || ''
    ).trim()
    if (isRuntimeModelRoute(selectedRouteForSubmit) && !defaultNonRuntimeRoute) {
      const message = '当前没有可用模型在线，请先启动模型服务后再发送。'
      setError(message)
      notify('error', message)
      return
    }

    if (isGeneratingRef.current) {
      const queued: QueuedSubmission = {
        id: createLocalId('queued'),
        content,
        attachments: messageAttachments
      }

      if (enableMessageQueue) {
        setMessageQueue((current) => [...current, queued])
        if (!prebuiltAttachments) {
          setDraft('')
          setComposerAttachments([])
          setShowToolsMenu(false)
        }
        return
      }

      stopGeneration()
      setMessageQueue((current) => [queued, ...current])
      if (!prebuiltAttachments) {
        setDraft('')
        setComposerAttachments([])
        setShowToolsMenu(false)
      }
      return
    }

    if (!prebuiltAttachments) {
      setDraft('')
      setComposerAttachments([])
      setShowToolsMenu(false)
    }
    setError(null)

    void (async () => {
      try {
        let sessionId = activeThreadId
        let createdSession: OpenPortChatSession | null = null

        // If we're starting a brand new chat, create the session and navigate first.
        // Avoid blocking the optimistic render on slow non-critical calls (like project refresh).
        if (!sessionId) {
          const sessionSettingsToCreate =
            hasNonRuntimeModels && isRuntimeModelRoute(pendingSettings.valves.modelRoute) && defaultNonRuntimeRoute
              ? {
                  ...pendingSettings,
                  valves: {
                    ...pendingSettings.valves,
                    modelRoute: defaultNonRuntimeRoute
                  }
                }
              : pendingSettings

          const created = await createChatSession(`New chat ${threads.length + 1}`, loadSession(), {
            settings: sessionSettingsToCreate
          })
          sessionId = created.session.id
          createdSession = created.session
          setActiveThreadId(sessionId)

          const params = new URLSearchParams()
          if (isTemporaryChat) {
            // Stay on the temporary chat URL. The active thread lives in memory.
          } else {
            params.set('thread', sessionId)
            if (selectedProjectId) params.set('project', selectedProjectId)
            if (isArchivedView) params.set('view', 'archived')
            router.push(buildChatHref(params))
          }

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

        if (sessionId && activeThread && activeThread.id === sessionId && defaultNonRuntimeRoute) {
          const currentRoute = activeThread.settings?.valves?.modelRoute
          if (isRuntimeModelRoute(currentRoute)) {
            const nextSettings = {
              ...activeThread.settings,
              valves: {
                ...activeThread.settings.valves,
                modelRoute: defaultNonRuntimeRoute
              }
            }

            try {
              const { session: upgradedSession } = await updateChatSessionSettings(sessionId, nextSettings, loadSession())
              setThreads((current) =>
                sortThreads(current.map((thread) => (thread.id === upgradedSession.id ? upgradedSession : thread)))
              )
            } catch {
              // Keep existing behavior if settings update fails.
            }
          }
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
          createdAt: new Date(Date.now() + 1).toISOString(),
          streamState: 'pending',
          reasoningContent: '',
          statusHistory: []
        }
        const optimisticUserId = optimisticUserMessage.id
        const optimisticAssistantId = optimisticAssistantMessage.id
        pendingGenerationsRef.current += 1
        setIsGenerating(true)
        isGeneratingRef.current = true

        // Optimistic render: show the user message immediately and a placeholder assistant bubble.
        flushSync(() => {
          if (createdSession) {
            setThreads((current) => [
              {
                ...createdSession,
                updatedAt: optimisticAssistantMessage.createdAt,
                messages: [...createdSession.messages, optimisticUserMessage, optimisticAssistantMessage]
              },
              ...current
            ])
            return
          }
          if (sessionId) {
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
        })

        if (autoScrollRef.current) {
          scrollToLatest('smooth')
        }

        const abort = new AbortController()
        activeGenerationAbortsRef.current.add(abort)
        let streamTaskIds: string[] = []
        const appendAssistantDelta = (delta: string) => {
          setThreads((current) => {
            const nextThreads = current.map((thread) => {
              if (thread.id !== sessionId) return thread
              const nextMessages = thread.messages.map((msg) =>
                msg.id === optimisticAssistantId
                  ? {
                      ...msg,
                      content: `${msg.content}${delta}`,
                      streamState: 'streaming' as OpenPortChatMessage['streamState']
                    }
                  : msg
              )
              return { ...thread, messages: nextMessages }
            })
            return sortThreads(nextThreads)
          })
          if (autoScrollRef.current) {
            scrollToLatest('auto')
          }
        }
        let streamUsesChatDelta = false
        const onEvent = (evt: any) => {
          if (!evt || !evt.event) return
          if (evt.event === 'tasks') {
            const taskIds = Array.isArray(evt.data?.taskIds)
              ? evt.data.taskIds.filter((taskId: unknown): taskId is string => typeof taskId === 'string')
              : []
            if (taskIds.length > 0) {
              streamTaskIds = taskIds
              setActiveTaskIds((current) => Array.from(new Set([...current, ...taskIds])))
            } else if (streamTaskIds.length > 0) {
              setActiveTaskIds((current) => current.filter((taskId) => !streamTaskIds.includes(taskId)))
              streamTaskIds = []
            }
            return
          }
          if (evt.event === 'chat:tasks:cancel') {
            if (streamTaskIds.length > 0) {
              setActiveTaskIds((current) => current.filter((taskId) => !streamTaskIds.includes(taskId)))
              streamTaskIds = []
            }
            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== sessionId) return thread
                const nextMessages = thread.messages.map((message) => {
                  if (message.id !== optimisticAssistantId) return message
                  return {
                    ...message,
                    streamState: 'done' as OpenPortChatMessage['streamState'],
                    statusHistory: [
                      ...(Array.isArray(message.statusHistory) ? message.statusHistory : []),
                      {
                        done: true,
                        action: 'cancel',
                        description: 'Request cancelled'
                      }
                    ]
                  }
                })
                return { ...thread, messages: nextMessages }
              })
              return sortThreads(nextThreads)
            })
            return
          }
          if (evt.event === 'active' && typeof evt.data?.active === 'boolean') {
            if (evt.data.active === false) {
              setThreads((current) => {
                const nextThreads = current.map((thread) => {
                  if (thread.id !== sessionId) return thread
                  const nextMessages = thread.messages.map((message) => {
                    if (message.id !== optimisticAssistantId) return message
                    if (message.streamState === 'done' || message.streamState === 'error') return message
                    return {
                      ...message,
                      streamState: 'done' as OpenPortChatMessage['streamState']
                    }
                  })
                  return { ...thread, messages: nextMessages }
                })
                return sortThreads(nextThreads)
              })
            }
            return
          }
          if (evt.event === 'chat:active' && typeof evt.data?.active === 'boolean') {
            if (evt.data.active === false) {
              if (streamTaskIds.length > 0) {
                setActiveTaskIds((current) => current.filter((taskId) => !streamTaskIds.includes(taskId)))
                streamTaskIds = []
              }
            }
            return
          }
          if (evt.event === 'cancel') {
            if (streamTaskIds.length > 0) {
              setActiveTaskIds((current) => current.filter((taskId) => !streamTaskIds.includes(taskId)))
              streamTaskIds = []
            }
            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== sessionId) return thread
                const nextMessages = thread.messages.map((message) => {
                  if (message.id !== optimisticAssistantId) return message
                  return {
                    ...message,
                    streamState: 'done' as OpenPortChatMessage['streamState'],
                    statusHistory: [
                      ...(Array.isArray(message.statusHistory) ? message.statusHistory : []),
                      {
                        done: true,
                        action: 'cancel',
                        description: 'Request cancelled'
                      }
                    ]
                  }
                })
                return { ...thread, messages: nextMessages }
              })
              return sortThreads(nextThreads)
            })
            return
          }
          if ((evt.event === 'status' || evt.event === 'chat:status') && typeof evt.data?.description === 'string') {
            const action = String(evt.data?.action || 'status')
            const entry: AssistantStatusEntry = {
              done: Boolean(evt.data?.done),
              action,
              description: String(evt.data.description || ''),
              hidden: Boolean(evt.data?.hidden) || action === 'reasoning_complete',
              urls: Array.isArray(evt.data?.urls) ? evt.data.urls : undefined,
              query: typeof evt.data?.query === 'string' ? evt.data.query : undefined,
              items: Array.isArray(evt.data?.items) ? evt.data.items : undefined,
              queries: Array.isArray(evt.data?.queries)
                ? evt.data.queries.filter((query: unknown): query is string => typeof query === 'string')
                : undefined,
              count: typeof evt.data?.count === 'number' ? evt.data.count : undefined
            }
            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== sessionId) return thread
                const nextMessages = thread.messages.map((message) => {
                  if (message.id !== optimisticAssistantId) return message
                  const existing = Array.isArray(message.statusHistory) ? message.statusHistory : []
                  const previous = existing.at(-1)
                  if (previous && isSameStatusEntry(previous, entry)) return message
                  return {
                    ...message,
                    streamState: (message.streamState || 'pending') as OpenPortChatMessage['streamState'],
                    statusHistory: [...existing, entry]
                  }
                })
                return { ...thread, messages: nextMessages }
              })
              return sortThreads(nextThreads)
            })
            return
          }
          if ((evt.event === 'reasoning' || evt.event === 'chat:reasoning') && typeof evt.data?.content === 'string') {
            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== sessionId) return thread
                const nextMessages = thread.messages.map((message) => {
                  if (message.id !== optimisticAssistantId) return message
                  return {
                    ...message,
                    reasoningContent: evt.data.content
                  }
                })
                return { ...thread, messages: nextMessages }
              })
              return sortThreads(nextThreads)
            })
            return
          }
          if (evt.event === 'delta' && typeof evt.data?.delta === 'string') {
            if (streamUsesChatDelta) return
            appendAssistantDelta(evt.data.delta)
            return
          }
          if (evt.event === 'chat:message:delta' && typeof evt.data?.content === 'string') {
            streamUsesChatDelta = true
            appendAssistantDelta(evt.data.content)
            return
          }
          if (evt.event === 'message' && typeof evt.data?.content === 'string') return
        }

        // Prefer streaming (upstream UI parity). Keep a single send path to avoid duplicate requests.
        void postChatMessageStream(sessionId!, content, messageAttachments, loadSession(), {
          signal: abort.signal,
          onEvent,
          messageIds: {
            userMessageId: optimisticUserId,
            assistantMessageId: optimisticAssistantId
          }
        })
          .then((response) => {
            const assistant = Array.isArray(response.messages)
              ? response.messages.find((message) => message.role === 'assistant')
              : null
            const seconds = assistant ? Math.max(1, Math.round((Date.now() - Date.parse(now)) / 1000)) : undefined

            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== response.session.id) return thread

                const serverMessages = Array.isArray(response.session.messages) ? response.session.messages : []
                const responseMessages = Array.isArray(response.messages) ? response.messages : []
                const mergedMessages = resolveSessionMessages(serverMessages, thread.messages, responseMessages)
                const finalizedMessages = mergedMessages.map((message) => {
                  if (message.role !== 'assistant') return message
                  if (message.id !== optimisticAssistantId) return message
                  return {
                    ...message,
                    streamState: 'done' as OpenPortChatMessage['streamState'],
                    thoughtSeconds: seconds
                  }
                })

                return {
                  ...thread,
                  ...response.session,
                  messages: finalizedMessages
                }
              })
              return sortThreads(nextThreads)
            })
            setComposerAttachments([])
          })
          .catch((submitError) => {
            const isAbortLike =
              (submitError instanceof DOMException && submitError.name === 'AbortError') ||
              (submitError instanceof Error && /aborted|cancelled|canceled/i.test(submitError.message))
            if (isAbortLike) {
              setThreads((current) => {
                const nextThreads = current.map((thread) => {
                  if (thread.id !== sessionId) return thread
                  const nextMessages = thread.messages.map((message) => {
                    if (message.id !== optimisticAssistantId) return message
                    const existing = Array.isArray(message.statusHistory) ? message.statusHistory : []
                    const alreadyCancelled = existing.some((entry) => entry.action === 'cancel')
                    return {
                      ...message,
                      streamState: 'done' as OpenPortChatMessage['streamState'],
                      statusHistory: alreadyCancelled
                        ? existing
                        : [
                            ...existing,
                            {
                              done: true,
                              action: 'cancel',
                              description: 'Request cancelled'
                            }
                          ]
                    }
                  })
                  return { ...thread, messages: nextMessages }
                })
                return sortThreads(nextThreads)
              })
              return
            }
            setDraft(content)
            const errorPresentation = toChatErrorPresentation(submitError)
            setError(errorPresentation.message)
            notify('error', errorPresentation.message)
            setThreads((current) => {
              const nextThreads = current.map((thread) => {
                if (thread.id !== sessionId) return thread
                const nextMessages = thread.messages.map((message) =>
                  message.id === optimisticAssistantId
                    ? {
                        ...message,
                        streamState: 'error' as OpenPortChatMessage['streamState'],
                        statusHistory: [
                          ...(Array.isArray(message.statusHistory) ? message.statusHistory : []),
                          {
                            done: true,
                            action: errorPresentation.statusAction,
                            description: errorPresentation.message
                          }
                        ]
                      }
                    : message
                )
                return { ...thread, messages: nextMessages }
              })
              return sortThreads(nextThreads)
            })
          })
          .finally(() => {
            activeGenerationAbortsRef.current.delete(abort)
            pendingGenerationsRef.current = Math.max(0, pendingGenerationsRef.current - 1)
            if (streamTaskIds.length > 0) {
              setActiveTaskIds((current) => current.filter((taskId) => !streamTaskIds.includes(taskId)))
              streamTaskIds = []
            }
            const nextGenerating = pendingGenerationsRef.current > 0 || activeTaskIdsRef.current.length > 0
            setIsGenerating(nextGenerating)
            isGeneratingRef.current = nextGenerating
            setExpandedStatusHistory((current) => {
              if (typeof current[optimisticAssistantId] === 'undefined') return current
              const next = { ...current }
              delete next[optimisticAssistantId]
              return next
            })
          })
      } catch (submitError) {
        setDraft(content)
        const errorPresentation = toChatErrorPresentation(submitError)
        setError(errorPresentation.message)
        notify('error', errorPresentation.message)
      }
    })()
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    submitMessage(draft)
  }

  useEffect(() => {
    const handler = () => stopGeneration()
    window.addEventListener(CHAT_TASKS_CANCEL_EVENT, handler as EventListener)
    return () => {
      window.removeEventListener(CHAT_TASKS_CANCEL_EVENT, handler as EventListener)
    }
  }, [])

  useEffect(() => {
    emitLifecycleEvent(CHAT_TASKS_EVENT, {
      active: isGenerating,
      queue: messageQueue.length,
      taskIds: activeTaskIds
    })
  }, [isGenerating, messageQueue.length, activeTaskIds])

  useEffect(() => {
    emitLifecycleEvent(CHAT_ACTIVE_EVENT, { active: isGenerating, taskIds: activeTaskIds })
  }, [isGenerating, activeTaskIds])

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
        className={`chat-main-stage${!isTemporaryChat && projectBackgroundImage ? ' has-project-background' : ''}${isTemporaryChat ? ' is-temporary-chat' : ''}`}
        style={chatMainStageStyle}
      >
        <div className={`chat-main-header${activeThread ? ' has-thread' : ''}`}>
          <div className="chat-main-header-inner">
            <div className="chat-main-header-copy">{renderModelSelector('header')}</div>
            <div className="chat-topbar">
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
              {isMobile ? (
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
            <div className="chat-thread-stage">
              <div className="chat-thread-scroll">
                <div className="chat-conversation-flow">
                  {messages.map((message, index) => {
                const isLast = index === messages.length - 1
                const attachments = Array.isArray(message.attachments) ? message.attachments : []
                const modelLabel = currentModel?.name || currentModelRoute
                const thoughtSeconds = message.role === 'assistant' ? message.thoughtSeconds : undefined
                const isAssistantPending =
                  message.role === 'assistant' &&
                  (message.streamState === 'pending' || message.streamState === 'streaming')
                const showAssistantThinkingPlaceholder = isAssistantPending && !message.content.trim()
                const statusHistoryRaw = message.role === 'assistant' ? message.statusHistory || [] : []
                const statusHistory = dedupeStatusHistory(statusHistoryRaw)
                const visibleStatusHistory = statusHistory.filter((entry) => entry.hidden !== true)
                const assistantThought =
                  message.role === 'assistant' && !isAssistantPending ? extractThinkBlocks(message.content) : null
                const assistantReasoningLive = message.role === 'assistant' ? (message.reasoningContent?.trim() || '') : ''
                const assistantReasoningRaw =
                  message.role === 'assistant' ? (assistantReasoningLive || assistantThought?.thought || '') : ''
                const assistantReasoning = assistantReasoningRaw || deriveReasoningFromStatuses(visibleStatusHistory)
                const assistantTimestamp =
                  message.role === 'assistant' && !isAssistantPending ? formatChatTimestamp(message.createdAt) : null
                const userTimestamp = message.role === 'user' ? formatChatTimestamp(message.createdAt) : null
                const latestStatus = statusHistory.at(-1)
                const latestStatusVisible = latestStatus && latestStatus.hidden !== true ? latestStatus : null
                const statusExpanded = message.role === 'assistant' ? Boolean(expandedStatusHistory[message.id]) : false
                const showAssistantSkeleton =
                  message.role === 'assistant' &&
                  showAssistantThinkingPlaceholder &&
                  (statusHistory.length === 0 || latestStatus?.hidden === true)
                const isAssistantError = message.role === 'assistant' && message.streamState === 'error'
                const assistantErrorEntry =
                  message.role === 'assistant'
                    ? [...statusHistory]
                        .reverse()
                        .find((entry) => entry.action.startsWith('error') && typeof entry.description === 'string')
                    : null
                const assistantErrorMessage =
                  assistantErrorEntry?.description?.trim() || '当前无法完成回复，请稍后重试。'
                const assistantErrorTitle = (() => {
                  const action = String(assistantErrorEntry?.action || '')
                  if (action === 'error_model_unavailable') return '模型不可用'
                  if (action === 'error_model_timeout') return '模型响应超时'
                  if (action === 'error_model_route_invalid') return '模型配置异常'
                  if (action === 'error_model_empty_response') return '模型返回为空'
                  if (action === 'error_model_request_failed') return '请求被模型拒绝'
                  return '生成失败'
                })()
                const retryPrompt =
                  message.role === 'assistant'
                    ? messages
                        .slice(0, index)
                        .reverse()
                        .find((entry) => entry.role === 'user')
                        ?.content?.trim() || ''
                    : ''

                    return (
                      <article
                        className={`owui-message owui-message--${message.role}`}
                        data-message-role={message.role}
                        key={message.id}
                        style={{ '--message-enter-delay': `${Math.min(index, 10) * 26}ms` } as CSSProperties}
                      >
                        <div className="owui-message-inner">
                      {message.role === 'user' ? (
                        <div className="owui-user-head">
                          {userTimestamp ? (
                            <span
                              className="owui-user-timestamp owui-tooltip-target"
                              data-tooltip={userTimestamp.full}
                              title={userTimestamp.full}
                            >
                              {userTimestamp.short}
                            </span>
                          ) : null}
                          <span className="owui-user-label">{userDisplayName}</span>
                        </div>
                      ) : null}

                      {message.role === 'assistant' ? (
                        <div className="owui-assistant-head">
                          <div className="owui-assistant-model">
                            {renderModelAvatar(currentModel)}
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
                            {message.role === 'assistant' && latestStatusVisible ? (
                              <ChatStatusHistory
                                entries={visibleStatusHistory}
                                expanded={statusExpanded}
                                formatStatusDescription={formatStatusDescription}
                                getStatusTags={extractStatusTags}
                                onToggle={() =>
                                  setExpandedStatusHistory((current) => ({
                                    ...current,
                                    [message.id]: !Boolean(current[message.id])
                                  }))
                                }
                              />
                            ) : null}
                            {isAssistantPending && assistantReasoningLive ? (
                              <details className="owui-thoughts">
                                <summary>Thinking…</summary>
                                <div className="owui-thoughts-body">
                                  <ChatMarkdown content={assistantReasoningLive} />
                                </div>
                              </details>
                            ) : null}
                            {!isAssistantPending && thoughtSeconds ? (
                              assistantReasoning ? (
                                <details className="owui-thoughts">
                                  <summary>Thought for {thoughtSeconds} seconds</summary>
                                  <div className="owui-thoughts-body">
                                    <ChatMarkdown content={assistantReasoning} />
                                  </div>
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
                          {showAssistantSkeleton ? (
                            <span className="owui-skeleton-dot" aria-label="Generating response" />
                          ) : isAssistantError && !message.content.trim() ? (
                            <div className="owui-error-card" role="alert">
                              <span className="owui-error-card-title">{assistantErrorTitle}</span>
                              <p className="owui-error-card-copy">{assistantErrorMessage}</p>
                              {retryPrompt ? (
                                <button
                                  className="owui-error-card-retry"
                                  onClick={() => submitMessage(retryPrompt)}
                                  type="button"
                                >
                                  重试
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              {message.role === 'assistant' ? (
                                <ChatMarkdown content={assistantThought ? assistantThought.visible : message.content} />
                              ) : (
                                assistantThought ? assistantThought.visible : message.content
                              )}
                              {isAssistantPending && message.content.trim() ? (
                                <span className="owui-stream-cursor" aria-hidden="true" />
                              ) : null}
                            </>
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
                  <div aria-hidden="true" ref={bottomSentinelRef} />
                </div>

                {showJumpToLatest ? (
                  <button
                    className="owui-jump-latest"
                    onClick={() => {
                      autoScrollRef.current = true
                      setShowJumpToLatest(false)
                      scrollToLatest('smooth')
                    }}
                    type="button"
                  >
                    Jump to latest
                  </button>
                ) : null}
              </div>

              <div className="chat-main-composer">{renderComposer('thread')}</div>
            </div>
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
