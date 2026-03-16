'use client'

import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Shortcut, WORKSPACE_SHORTCUT_EVENT, isShortcutMatch, shortcuts } from '../lib/shortcuts'
import { AppShellStateProvider, useAppShellState } from './app-shell-state'
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal'
import { WorkspaceSearchModal } from './workspace-search-modal'
import { WorkspaceSidebar } from './workspace-sidebar'
import { WorkspaceToastRegion } from './workspace-toast-region'

async function copyToClipboard(value: string): Promise<void> {
  if (!value.trim()) return
  await navigator.clipboard.writeText(value)
}

function getLastAssistantMessageElement(): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>('[data-message-role="assistant"] [data-copy-response-source]')
  return nodes.length ? nodes[nodes.length - 1] : null
}

function getLastAssistantCodeBlock(): string {
  const source = getLastAssistantMessageElement()?.textContent ?? ''
  const fencedMatch = source.match(/```(?:[\w-]+)?\n([\s\S]*?)```/m)
  return fencedMatch?.[1]?.trim() ?? ''
}

function WorkspaceAppShellInner({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const { isMobile, showSidebar, sidebarWidth, toggleSidebar, setSidebarWidth } = useAppShellState()

  useEffect(() => {
    const openShortcuts = () => setShowShortcuts(true)

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (isShortcutMatch(event, shortcuts[Shortcut.SEARCH])) {
        event.preventDefault()
        setShowSearch((current) => !current)
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.NEW_CHAT])) {
        event.preventDefault()
        document.getElementById('sidebar-new-chat-button')?.click()
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.FOCUS_INPUT])) {
        event.preventDefault()
        document.getElementById('chat-input')?.focus()
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_CODE_BLOCK])) {
        event.preventDefault()
        await copyToClipboard(getLastAssistantCodeBlock())
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_RESPONSE])) {
        event.preventDefault()
        await copyToClipboard(getLastAssistantMessageElement()?.textContent ?? '')
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.TOGGLE_SIDEBAR])) {
        event.preventDefault()
        toggleSidebar()
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.OPEN_SETTINGS])) {
        event.preventDefault()
        router.push('/settings/workspaces')
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.SHOW_SHORTCUTS])) {
        event.preventDefault()
        setShowShortcuts((current) => !current)
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.CLOSE_MODAL])) {
        if (showSearch || showShortcuts) {
          event.preventDefault()
          setShowSearch(false)
          setShowShortcuts(false)
        }
        return
      }

      if (isShortcutMatch(event, shortcuts[Shortcut.OPEN_MODEL_SELECTOR])) {
        event.preventDefault()
        document.getElementById('chat-controls-toggle-button')?.click()
        window.setTimeout(() => {
          document.getElementById('chat-model-route-input')?.focus()
        }, 0)
        return
      }

      if (
        isShortcutMatch(event, shortcuts[Shortcut.GENERATE_MESSAGE_PAIR]) &&
        document.activeElement?.id === 'chat-input'
      ) {
        event.preventDefault()
        ;(document.getElementById('chat-composer-form') as HTMLFormElement | null)?.requestSubmit()
      }
    }

    window.addEventListener(WORKSPACE_SHORTCUT_EVENT, openShortcuts)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener(WORKSPACE_SHORTCUT_EVENT, openShortcuts)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [router, showSearch, showShortcuts, toggleSidebar])

  function onSidebarResizeStart(startEvent: ReactMouseEvent<HTMLDivElement>): void {
    if (isMobile) return
    const startX = startEvent.clientX
    const startWidth = sidebarWidth

    function onPointerMove(event: MouseEvent): void {
      setSidebarWidth(startWidth + event.clientX - startX)
    }

    function onPointerUp(): void {
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
    }

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  return (
    <main
      className="workspace-app-shell"
      style={
        {
          '--openport-sidebar-width': `${sidebarWidth}px`
        } as CSSProperties
      }
    >
      {isMobile && showSidebar ? <button aria-label="Close sidebar" className="workspace-app-sidebar-backdrop" onClick={toggleSidebar} type="button" /> : null}
      <div className={`workspace-app-layout${showSidebar ? '' : ' is-sidebar-collapsed'}${isMobile ? ' is-mobile' : ''}`}>
        {showSidebar ? (
          <Suspense fallback={<aside className="workspace-sidebar" />}>
            <WorkspaceSidebar onOpenSearch={() => setShowSearch(true)} />
          </Suspense>
        ) : null}
        {showSidebar && !isMobile ? (
          <div
            aria-hidden="true"
            className="workspace-app-sidebar-resize-handle"
            onMouseDown={onSidebarResizeStart}
          />
        ) : null}
        <section className="workspace-app-content">{children}</section>
      </div>
      <WorkspaceToastRegion />
      <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} open={showShortcuts} />
      <WorkspaceSearchModal onClose={() => setShowSearch(false)} show={showSearch} />
    </main>
  )
}

export function WorkspaceAppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppShellStateProvider>
      <WorkspaceAppShellInner>{children}</WorkspaceAppShellInner>
    </AppShellStateProvider>
  )
}
