export type ShortcutDefinition = {
  category: 'Chat' | 'Global' | 'Input' | 'Message'
  keys: string[]
  name: string
  tooltip?: string
}

export enum Shortcut {
  NEW_CHAT = 'newChat',
  OPEN_MODEL_SELECTOR = 'openModelSelector',
  SEARCH = 'search',
  OPEN_SETTINGS = 'openSettings',
  SHOW_SHORTCUTS = 'showShortcuts',
  TOGGLE_SIDEBAR = 'toggleSidebar',
  CLOSE_MODAL = 'closeModal',
  FOCUS_INPUT = 'focusInput',
  GENERATE_MESSAGE_PAIR = 'generateMessagePair',
  COPY_LAST_RESPONSE = 'copyLastResponse',
  COPY_LAST_CODE_BLOCK = 'copyLastCodeBlock'
}

export const shortcuts: Record<Shortcut, ShortcutDefinition> = {
  [Shortcut.NEW_CHAT]: {
    name: 'New Chat',
    keys: ['mod', 'shift', 'O'],
    category: 'Chat'
  },
  [Shortcut.OPEN_MODEL_SELECTOR]: {
    name: 'Open Model Selector',
    keys: ['mod', 'shift', 'M'],
    category: 'Chat'
  },
  [Shortcut.SEARCH]: {
    name: 'Search',
    keys: ['mod', 'K'],
    category: 'Global'
  },
  [Shortcut.OPEN_SETTINGS]: {
    name: 'Open Settings',
    keys: ['mod', '.'],
    category: 'Global'
  },
  [Shortcut.SHOW_SHORTCUTS]: {
    name: 'Show Shortcuts',
    keys: ['mod', '/'],
    category: 'Global'
  },
  [Shortcut.TOGGLE_SIDEBAR]: {
    name: 'Toggle Sidebar',
    keys: ['mod', 'shift', 'S'],
    category: 'Global'
  },
  [Shortcut.CLOSE_MODAL]: {
    name: 'Close Modal',
    keys: ['Escape'],
    category: 'Global'
  },
  [Shortcut.FOCUS_INPUT]: {
    name: 'Focus Chat Input',
    keys: ['shift', 'Escape'],
    category: 'Input'
  },
  [Shortcut.GENERATE_MESSAGE_PAIR]: {
    name: 'Generate Message Pair',
    keys: ['mod', 'shift', 'Enter'],
    category: 'Message',
    tooltip: 'Only active when the chat input is in focus.'
  },
  [Shortcut.COPY_LAST_RESPONSE]: {
    name: 'Copy Last Response',
    keys: ['mod', 'shift', 'C'],
    category: 'Message'
  },
  [Shortcut.COPY_LAST_CODE_BLOCK]: {
    name: 'Copy Last Code Block',
    keys: ['mod', 'shift', ';'],
    category: 'Message'
  }
}

export const shortcutsByCategory = Object.entries(shortcuts).reduce<
  Partial<Record<ShortcutDefinition['category'], ShortcutDefinition[]>>
>((accumulator, [, shortcut]) => {
  const existing = accumulator[shortcut.category] ?? []
  existing.push(shortcut)
  accumulator[shortcut.category] = existing
  return accumulator
}, {})

export function isShortcutMatch(event: KeyboardEvent, shortcut?: ShortcutDefinition): boolean {
  const keys = shortcut?.keys ?? []
  const normalized = keys.map((key) => key.toLowerCase())
  const needCtrl = normalized.includes('ctrl') || normalized.includes('mod')
  const needShift = normalized.includes('shift')
  const needAlt = normalized.includes('alt')
  const mainKeys = normalized.filter((key) => !['ctrl', 'shift', 'alt', 'mod'].includes(key))
  const keyPressed = event.key.toLowerCase()

  if (needShift && !event.shiftKey) return false
  if (!needShift && event.shiftKey && !mainKeys.includes('shift')) return false
  if (needCtrl && !(event.ctrlKey || event.metaKey)) return false
  if (!needCtrl && (event.ctrlKey || event.metaKey)) return false
  if (needAlt && !event.altKey) return false
  if (!needAlt && event.altKey) return false
  if (mainKeys.length && !mainKeys.includes(keyPressed)) return false

  return true
}

export function formatShortcutKey(key: string, isMac: boolean): string {
  switch (key.toLowerCase()) {
    case 'mod':
      return isMac ? '⌘' : 'Ctrl'
    case 'shift':
      return isMac ? '⇧' : 'Shift'
    case 'alt':
      return isMac ? '⌥' : 'Alt'
    case 'backspace':
    case 'delete':
      return isMac ? '⌫' : 'Delete'
    case 'escape':
      return 'Esc'
    case 'enter':
      return isMac ? '↩' : 'Enter'
    case 'tab':
      return isMac ? '⇥' : 'Tab'
    case 'arrowup':
      return '↑'
    case 'arrowdown':
      return '↓'
    case 'period':
      return '.'
    case 'slash':
      return '/'
    case 'semicolon':
      return ';'
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

export const WORKSPACE_SHORTCUT_EVENT = 'openport:show-shortcuts'
