'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const SIDEBAR_WIDTH_KEY = 'openport.app-shell.sidebar-width'
const SIDEBAR_OPEN_KEY = 'openport.app-shell.sidebar-open'
const SIDEBAR_VARIANT_KEY = 'openport.app-shell.sidebar-variant'
const SIDEBAR_MINI_KEY = 'openport.app-shell.sidebar-mini'
const CONTROLS_WIDTH_KEY = 'openport.app-shell.controls-width'
const CONTROLS_OPEN_KEY = 'openport.app-shell.controls-open'

const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 380
const DEFAULT_SIDEBAR_WIDTH = 252
const MINI_SIDEBAR_WIDTH = 96

const MIN_CONTROLS_WIDTH = 280
const MAX_CONTROLS_WIDTH = 420
const DEFAULT_CONTROLS_WIDTH = 300

type SidebarVariant = 'classic' | 'minimal'

type AppShellStateValue = {
  controlsWidth: number
  isHydrated: boolean
  isMobile: boolean
  isSidebarMini: boolean
  sidebarVariant: SidebarVariant
  setControlsWidth: (width: number) => void
  setShowControls: (open: boolean) => void
  setShowSidebar: (open: boolean) => void
  setSidebarVariant: (variant: SidebarVariant) => void
  setSidebarMini: (mini: boolean) => void
  setSidebarWidth: (width: number) => void
  showControls: boolean
  showSidebar: boolean
  sidebarWidth: number
  toggleControls: () => void
  toggleSidebar: () => void
  toggleSidebarMini: () => void
  toggleSidebarVariant: () => void
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

function readSidebarVariant(fallback: SidebarVariant): SidebarVariant {
  if (typeof window === 'undefined') return fallback
  const value = (window.localStorage.getItem(SIDEBAR_VARIANT_KEY) || '').trim().toLowerCase()
  return value === 'minimal' ? 'minimal' : value === 'classic' ? 'classic' : fallback
}

const ENV_SIDEBAR_VARIANT = (process.env.NEXT_PUBLIC_OPENPORT_SIDEBAR_VARIANT || '').trim().toLowerCase()
const DEFAULT_SIDEBAR_VARIANT: SidebarVariant = ENV_SIDEBAR_VARIANT === 'minimal' ? 'minimal' : 'classic'

export function AppShellStateProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [controlsWidth, setControlsWidthState] = useState(DEFAULT_CONTROLS_WIDTH)
  const [sidebarVariant, setSidebarVariantState] = useState<SidebarVariant>(DEFAULT_SIDEBAR_VARIANT)
  const [isSidebarMini, setIsSidebarMiniState] = useState(false)

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
      setSidebarVariantState(readSidebarVariant(DEFAULT_SIDEBAR_VARIANT))
      setIsSidebarMiniState(readBoolean(SIDEBAR_MINI_KEY, false))
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
    window.localStorage.setItem(SIDEBAR_VARIANT_KEY, sidebarVariant)
  }, [isHydrated, sidebarVariant])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(SIDEBAR_MINI_KEY, String(isSidebarMini))
  }, [isHydrated, isSidebarMini])

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
      isSidebarMini: !isMobile && sidebarVariant === 'minimal' ? isSidebarMini : false,
      sidebarVariant,
      setControlsWidth: (width: number) =>
        setControlsWidthState(clamp(width, MIN_CONTROLS_WIDTH, MAX_CONTROLS_WIDTH)),
      setShowControls,
      setShowSidebar,
      setSidebarMini: (mini: boolean) => {
        // Mini sidebar is a desktop-only feature for the minimal variant.
        if (isMobile) {
          setIsSidebarMiniState(false)
          return
        }
        if (sidebarVariant !== 'minimal') {
          setIsSidebarMiniState(false)
          return
        }
        setIsSidebarMiniState(Boolean(mini))
        setShowSidebar(true)
      },
      setSidebarVariant: (variant: SidebarVariant) => {
        setSidebarVariantState(variant)
        // Mini mode only applies to the minimal variant.
        if (variant !== 'minimal') setIsSidebarMiniState(false)
      },
      setSidebarWidth: (width: number) =>
        setSidebarWidthState(clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)),
      showControls,
      showSidebar,
      sidebarWidth: !isMobile && sidebarVariant === 'minimal' && isSidebarMini ? MINI_SIDEBAR_WIDTH : sidebarWidth,
      toggleControls: () => setShowControls((current) => !current),
      toggleSidebar: () => setShowSidebar((current) => !current),
      toggleSidebarMini: () => {
        if (isMobile) return
        if (sidebarVariant !== 'minimal') return
        setIsSidebarMiniState((current) => !current)
        setShowSidebar(true)
      },
      toggleSidebarVariant: () =>
        setSidebarVariantState((current) => {
          const next = current === 'minimal' ? 'classic' : 'minimal'
          if (next !== 'minimal') setIsSidebarMiniState(false)
          return next
        })
    }),
    [controlsWidth, isHydrated, isMobile, isSidebarMini, showControls, showSidebar, sidebarVariant, sidebarWidth]
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
