'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const SIDEBAR_WIDTH_KEY = 'openport.app-shell.sidebar-width'
const SIDEBAR_OPEN_KEY = 'openport.app-shell.sidebar-open'
const CONTROLS_WIDTH_KEY = 'openport.app-shell.controls-width'
const CONTROLS_OPEN_KEY = 'openport.app-shell.controls-open'

const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 380
const DEFAULT_SIDEBAR_WIDTH = 252

const MIN_CONTROLS_WIDTH = 280
const MAX_CONTROLS_WIDTH = 420
const DEFAULT_CONTROLS_WIDTH = 300

type AppShellStateValue = {
  controlsWidth: number
  isHydrated: boolean
  isMobile: boolean
  setControlsWidth: (width: number) => void
  setShowControls: (open: boolean) => void
  setShowSidebar: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  showControls: boolean
  showSidebar: boolean
  sidebarWidth: number
  toggleControls: () => void
  toggleSidebar: () => void
}

const AppShellStateContext = createContext<AppShellStateValue | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback

  const parsed = Number(window.localStorage.getItem(key))
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}

function readBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback

  const value = window.localStorage.getItem(key)
  return value === null ? fallback : value === 'true'
}

export function AppShellStateProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [controlsWidth, setControlsWidthState] = useState(DEFAULT_CONTROLS_WIDTH)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(max-width: 980px)')

    const applyViewportState = (mobile: boolean) => {
      setIsMobile(mobile)
      setShowSidebar(mobile ? false : readBoolean(SIDEBAR_OPEN_KEY, true))
      setShowControls(mobile ? false : readBoolean(CONTROLS_OPEN_KEY, false))
    }

    const hydrate = () => {
      const mobile = media.matches
      setSidebarWidthState(readNumber(SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH))
      setControlsWidthState(
        readNumber(CONTROLS_WIDTH_KEY, DEFAULT_CONTROLS_WIDTH, MIN_CONTROLS_WIDTH, MAX_CONTROLS_WIDTH)
      )
      applyViewportState(mobile)
      setIsHydrated(true)
    }

    hydrate()

    const handleChange = (event: MediaQueryListEvent) => {
      applyViewportState(event.matches)
    }

    media.addEventListener('change', handleChange)
    return () => {
      media.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(showSidebar))
  }, [isHydrated, showSidebar])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(CONTROLS_OPEN_KEY, String(showControls))
  }, [isHydrated, showControls])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [isHydrated, sidebarWidth])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(CONTROLS_WIDTH_KEY, String(controlsWidth))
  }, [controlsWidth, isHydrated])

  const value = useMemo<AppShellStateValue>(
    () => ({
      controlsWidth,
      isHydrated,
      isMobile,
      setControlsWidth: (width: number) =>
        setControlsWidthState(clamp(width, MIN_CONTROLS_WIDTH, MAX_CONTROLS_WIDTH)),
      setShowControls,
      setShowSidebar,
      setSidebarWidth: (width: number) =>
        setSidebarWidthState(clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)),
      showControls,
      showSidebar,
      sidebarWidth,
      toggleControls: () => setShowControls((current) => !current),
      toggleSidebar: () => setShowSidebar((current) => !current)
    }),
    [controlsWidth, isHydrated, isMobile, showControls, showSidebar, sidebarWidth]
  )

  return <AppShellStateContext.Provider value={value}>{children}</AppShellStateContext.Provider>
}

export function useAppShellState(): AppShellStateValue {
  const context = useContext(AppShellStateContext)
  if (!context) {
    throw new Error('useAppShellState must be used inside AppShellStateProvider')
  }

  return context
}
