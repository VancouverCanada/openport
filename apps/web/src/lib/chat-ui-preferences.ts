'use client'

export type OpenPortChatUiPreferences = {
  collapsedSidebarSections: {
    chats: boolean
    pinnedModels: boolean
    projects: boolean
  }
  chatDefaults: {
    functionCalling: boolean
    maxTokens: number
    modelRoute: string | null
    operatorMode: string
    reasoningEffort: 'low' | 'medium' | 'high'
    streamResponse: boolean
    systemPrompt: string
    temperature: number
    topP: number
  }
  pinnedModelRoutes: string[]
}

const STORAGE_KEY = 'openport.chat-ui-preferences'
const EVENT_NAME = 'openport:chat-ui-preferences'

function getDefaultPreferences(): OpenPortChatUiPreferences {
  return {
    collapsedSidebarSections: {
      chats: false,
      pinnedModels: false,
      projects: false
    },
    chatDefaults: {
      functionCalling: true,
      maxTokens: 2048,
      modelRoute: null,
      operatorMode: 'default',
      reasoningEffort: 'medium',
      streamResponse: true,
      systemPrompt: '',
      temperature: 0.7,
      topP: 0.9
    },
    pinnedModelRoutes: []
  }
}

export function getChatUiPreferencesEventName(): string {
  return EVENT_NAME
}

export function loadChatUiPreferences(): OpenPortChatUiPreferences {
  if (typeof window === 'undefined') return getDefaultPreferences()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return getDefaultPreferences()

  try {
    const parsed = JSON.parse(raw) as Partial<OpenPortChatUiPreferences>
    return {
      ...getDefaultPreferences(),
      ...parsed,
      pinnedModelRoutes: Array.isArray(parsed.pinnedModelRoutes)
        ? Array.from(new Set(parsed.pinnedModelRoutes.filter((value): value is string => typeof value === 'string')))
        : [],
      chatDefaults: {
        ...getDefaultPreferences().chatDefaults,
        ...(parsed.chatDefaults || {})
      },
      collapsedSidebarSections: {
        ...getDefaultPreferences().collapsedSidebarSections,
        ...(parsed.collapsedSidebarSections || {})
      }
    }
  } catch {
    return getDefaultPreferences()
  }
}

export function saveChatUiPreferences(input: OpenPortChatUiPreferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function togglePinnedModelRoute(route: string): OpenPortChatUiPreferences {
  const current = loadChatUiPreferences()
  const nextRoutes = current.pinnedModelRoutes.includes(route)
    ? current.pinnedModelRoutes.filter((value) => value !== route)
    : [...current.pinnedModelRoutes, route]

  const next = {
    ...current,
    pinnedModelRoutes: nextRoutes
  }

  saveChatUiPreferences(next)
  return next
}

export function reorderPinnedModelRoutes(routes: string[]): OpenPortChatUiPreferences {
  const next = {
    ...loadChatUiPreferences(),
    pinnedModelRoutes: Array.from(new Set(routes))
  }
  saveChatUiPreferences(next)
  return next
}

export function toggleSidebarSection(section: keyof OpenPortChatUiPreferences['collapsedSidebarSections']): OpenPortChatUiPreferences {
  const current = loadChatUiPreferences()
  const next = {
    ...current,
    collapsedSidebarSections: {
      ...current.collapsedSidebarSections,
      [section]: !current.collapsedSidebarSections[section]
    }
  }
  saveChatUiPreferences(next)
  return next
}

export function setSidebarSectionState(
  section: keyof OpenPortChatUiPreferences['collapsedSidebarSections'],
  collapsed: boolean
): OpenPortChatUiPreferences {
  const current = loadChatUiPreferences()
  const next = {
    ...current,
    collapsedSidebarSections: {
      ...current.collapsedSidebarSections,
      [section]: collapsed
    }
  }
  saveChatUiPreferences(next)
  return next
}

export function updateChatDefaults(
  input: Partial<OpenPortChatUiPreferences['chatDefaults']>
): OpenPortChatUiPreferences {
  const current = loadChatUiPreferences()
  const next = {
    ...current,
    chatDefaults: {
      ...current.chatDefaults,
      ...input
    }
  }
  saveChatUiPreferences(next)
  return next
}
