'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { DragEvent } from 'react'
import { useEffect, useState, useTransition } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  buildProjectEventsUrl,
  createChatSession,
  createProject as createProjectRemote,
  deleteProject as deleteProjectRemote,
  exportProject as exportProjectRemote,
  fetchChatSessions,
  fetchProjects,
  fetchWorkspaceModels,
  importChatSessions,
  importProjectBundle,
  loadSession,
  moveProject as moveProjectRemote,
  type OpenPortProjectExportBundle,
  updateChatSessionSettings,
  updateProject as updateProjectRemote,
  type OpenPortChatSession,
  type OpenPortWorkspaceModel
} from '../lib/openport-api'
import {
  assignThreadToProject,
  getProjectDescendantIds,
  getProjectChatSettings,
  getWorkspaceEventName,
  groupChatSessionsByTimeRange,
  loadProjects,
  loadCollapsedHistoryGroups,
  saveProjectsToCache,
  saveCollapsedHistoryGroups,
  toggleProjectExpanded,
  type OpenPortProjectInput,
  type OpenPortProject
} from '../lib/chat-workspace'
import {
  getChatUiPreferencesEventName,
  loadChatUiPreferences,
  reorderPinnedModelRoutes,
  toggleSidebarSection,
  type OpenPortChatUiPreferences
} from '../lib/chat-ui-preferences'
import { getSearchTimeLabel } from '../lib/workspace-search'
import { notify } from '../lib/toast'
import { ConfirmDialog } from './confirm-dialog'
import { useAppShellState } from './app-shell-state'
import { Iconify } from './iconify'
import { IconButton } from './ui/icon-button'
import { LandingWordmark } from './landing-wordmark'
import { ProjectModal } from './project-modal'
import { ProjectTreeItem } from './project-tree-item'
import { SidebarSection } from './ui/sidebar-section'
import { TextButton } from './ui/text-button'

const appLinks = [
  { href: '/dashboard/notes', label: 'Notes', icon: 'solar:notebook-outline' },
  { href: '/workspace', label: 'Workspace', icon: 'solar:widget-5-outline' }
]

const layoutMotion = {
  layout: { type: 'spring', damping: 46, stiffness: 420 }
} as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === href
  }

  return pathname.startsWith(href)
}

type WorkspaceSidebarProps = {
  onOpenSearch?: () => void
}

export function WorkspaceSidebar({ onOpenSearch }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [threads, setThreads] = useState<OpenPortChatSession[]>([])
  const [models, setModels] = useState<OpenPortWorkspaceModel[]>([])
  const [accountLabel, setAccountLabel] = useState('local operator')
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [uiPreferences, setUiPreferences] = useState<OpenPortChatUiPreferences>(loadChatUiPreferences())
  const [isProjectsLoading, setIsProjectsLoading] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [projectModalState, setProjectModalState] = useState<{
    mode: 'create' | 'edit'
    open: boolean
    parentProjectId: string | null
    projectId: string | null
  }>({
    mode: 'create',
    open: false,
    parentProjectId: null,
    projectId: null
  })
  const [deleteState, setDeleteState] = useState<{
    clearAssignments: boolean
    projectId: string | null
    open: boolean
  }>({
    clearAssignments: true,
    projectId: null,
    open: false
  })
  const [isPending, startTransition] = useTransition()
  const [draggedPinnedModelRoute, setDraggedPinnedModelRoute] = useState<string | null>(null)
  const [isRootDropTarget, setIsRootDropTarget] = useState(false)
  const { isMobile, toggleSidebar } = useAppShellState()
  const activeThreadId = searchParams.get('thread')
  const selectedProjectId = searchParams.get('project')
  const selectedModelRoute = searchParams.get('model')
  const view = searchParams.get('view')
  const isArchivedView = view === 'archived'
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || null
  const modalProject =
    projectModalState.projectId ? projects.find((project) => project.id === projectModalState.projectId) || null : null
  const modalParentProject =
    projectModalState.parentProjectId
      ? projects.find((project) => project.id === projectModalState.parentProjectId) || null
      : null
  const deleteProjectTarget =
    deleteState.projectId ? projects.find((project) => project.id === deleteState.projectId) || null : null

  async function refreshProjects(): Promise<void> {
    setIsProjectsLoading(true)

    try {
      const response = await fetchProjects(loadSession())
      saveProjectsToCache(response.items)
      setProjects(response.items)
    } catch {
      setProjects(loadProjects())
    } finally {
      setIsProjectsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    async function load(): Promise<void> {
      const session = loadSession()
      if (session?.email && isActive) {
        setAccountLabel(session.email)
      }
      setCollapsedGroups(loadCollapsedHistoryGroups())
      setUiPreferences(loadChatUiPreferences())

      await Promise.all([
        refreshProjects(),
        fetchWorkspaceModels(loadSession())
          .then((response) => {
            if (!isActive) return
            setModels(response.items)
          })
          .catch(() => {
            if (!isActive) return
            setModels([])
          })
      ])

      try {
        const response = await fetchChatSessions({ archived: isArchivedView }, session)
        if (!isActive) return
        setThreads(response.items)
      } catch {
        if (!isActive) return
        setThreads([])
      }
    }

    void load()
    return () => {
      isActive = false
    }
  }, [isArchivedView])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleWorkspaceUpdate = () => {
      setProjects(loadProjects())
      setCollapsedGroups(loadCollapsedHistoryGroups())
    }

    const handlePreferencesUpdate = () => {
      setUiPreferences(loadChatUiPreferences())
    }

    window.addEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
    window.addEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
    return () => {
      window.removeEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
      window.removeEventListener(getChatUiPreferencesEventName(), handlePreferencesUpdate)
    }
  }, [])

  useEffect(() => {
    const session = loadSession()
    if (!session || typeof window === 'undefined') return

    const source = new EventSource(buildProjectEventsUrl(session))
    source.onmessage = () => {
      void refreshProjects()
      void fetchChatSessions({ archived: isArchivedView }, loadSession())
        .then((response) => {
          setThreads(response.items)
        })
        .catch(() => undefined)
    }

    return () => {
      source.close()
    }
  }, [isArchivedView])

  async function assignThreadProject(threadId: string, projectId: string | null): Promise<void> {
    const thread = threads.find((entry) => entry.id === threadId)
    if (!thread) return

    try {
      const { session } = await updateChatSessionSettings(
        threadId,
        {
          ...thread.settings,
          projectId
        },
        loadSession()
      )
      setThreads((current) => current.map((entry) => (entry.id === session.id ? session : entry)))
      assignThreadToProject(threadId, projectId)
      await refreshProjects()
    } catch {
      notify('error', 'Unable to update project assignment.')
      return
    }
  }

  function onNewChat(): void {
    startTransition(() => {
      void (async () => {
        try {
          const baseSettings = getProjectChatSettings(projects, selectedProjectId, {
            models,
            preferences: uiPreferences
          })
          const { session } = await createChatSession(`New chat ${threads.length + 1}`, loadSession(), {
            settings: selectedModelRoute
              ? {
                  ...baseSettings,
                  valves: {
                    ...baseSettings.valves,
                    modelRoute: selectedModelRoute
                  }
                }
              : baseSettings
          })
          assignThreadToProject(session.id, selectedProjectId)
          await refreshProjects()
          setThreads((current) => [session, ...current])
          const params = new URLSearchParams()
          params.set('thread', session.id)
          if (selectedProjectId) {
            params.set('project', selectedProjectId)
          }
          router.push(buildChatHref(params))
          if (isMobile) toggleSidebar()
        } catch {
          notify('error', 'Unable to create chat.')
          router.push('/')
          if (isMobile) toggleSidebar()
        }
      })()
    })
  }

  function openCreateProjectModal(parentProjectId: string | null = null): void {
    setProjectModalState({
      mode: 'create',
      open: true,
      parentProjectId,
      projectId: null
    })
  }

  function openEditProjectModal(project: OpenPortProject): void {
    setProjectModalState({
      mode: 'edit',
      open: true,
      parentProjectId: project.parentId,
      projectId: project.id
    })
  }

  function closeProjectModal(): void {
    setProjectModalState({
      mode: 'create',
      open: false,
      parentProjectId: null,
      projectId: null
    })
  }

  async function handleProjectModalSubmit(input: OpenPortProjectInput): Promise<void> {
    try {
      if (projectModalState.mode === 'edit' && modalProject) {
        const { project } = await updateProjectRemote(modalProject.id, input, loadSession())
        await refreshProjects()
        closeProjectModal()
        notify('success', 'Project updated.')
        if (selectedProjectId === project.id) {
          router.refresh()
        }
        return
      }

      const { project } = await createProjectRemote(input, loadSession())
      await refreshProjects()
      closeProjectModal()
      notify('success', 'Project created.')
      router.push(`/chat?project=${project.id}`)
    } catch {
      notify('error', projectModalState.mode === 'edit' ? 'Unable to update project.' : 'Unable to create project.')
    }
  }

  function onMoveProject(projectId: string, parentId: string | null): void {
    void moveProjectRemote(projectId, parentId, loadSession())
      .then(() => refreshProjects())
      .then(() => {
        notify('success', 'Project moved.')
      })
      .catch(() => {
        notify('error', 'Unable to move project.')
      })
  }

  function onToggleProject(projectId: string, nextValue?: boolean): void {
    const currentProject = projects.find((project) => project.id === projectId)
    if (!currentProject) return

    const resolvedValue = typeof nextValue === 'boolean' ? nextValue : !currentProject.isExpanded
    toggleProjectExpanded(projectId, resolvedValue)
    setProjects(loadProjects())

    void updateProjectRemote(
      projectId,
      {
        isExpanded: resolvedValue
      },
      loadSession()
    ).catch(() => {
      toggleProjectExpanded(projectId, currentProject.isExpanded)
      setProjects(loadProjects())
      notify('error', 'Unable to update project state.')
    })
  }

  function requestDeleteProject(project: OpenPortProject): void {
    setDeleteState({
      clearAssignments: true,
      projectId: project.id,
      open: true
    })
  }

  function closeDeleteDialog(): void {
    setDeleteState({
      clearAssignments: true,
      projectId: null,
      open: false
    })
  }

  async function confirmDeleteProject(): Promise<void> {
    if (!deleteProjectTarget) {
      closeDeleteDialog()
      return
    }

    const descendantIds = new Set([
      deleteProjectTarget.id,
      ...getProjectDescendantIds(projects, deleteProjectTarget.id)
    ])

    try {
      const response = await deleteProjectRemote(deleteProjectTarget.id, deleteState.clearAssignments, loadSession())
      await refreshProjects()
      if (response.deletedChatIds.length > 0) {
        setThreads((current) => current.filter((thread) => !response.deletedChatIds.includes(thread.id)))
      } else if (!deleteState.clearAssignments) {
        setThreads((current) =>
          current.map((thread) =>
            thread.settings.projectId && descendantIds.has(thread.settings.projectId)
              ? {
                  ...thread,
                  settings: {
                    ...thread.settings,
                    projectId: null
                  }
                }
              : thread
          )
        )
      }

      if (selectedProjectId && descendantIds.has(selectedProjectId)) {
        router.push('/')
      }

      notify('success', deleteState.clearAssignments ? 'Project and contents deleted.' : 'Project deleted.')
      closeDeleteDialog()
    } catch {
      notify('error', 'Unable to delete project.')
    }
  }

  function onSelectProject(projectId: string | null): void {
    const params = new URLSearchParams()
    if (isArchivedView) {
      params.set('view', 'archived')
    }
    if (selectedModelRoute) {
      params.set('model', selectedModelRoute)
    }

    if (!projectId) {
      router.push(buildChatHref(params))
      if (isMobile) toggleSidebar()
      return
    }

    params.set('project', projectId)
    router.push(buildChatHref(params))
    if (isMobile) toggleSidebar()
  }

  function readDragPayload(event: DragEvent<HTMLElement>): { type: 'project' | 'chat'; id: string } | null {
    const raw = event.dataTransfer.getData('text/plain')
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as { type?: 'project' | 'chat'; id?: string }
      if ((parsed.type === 'project' || parsed.type === 'chat') && typeof parsed.id === 'string') {
        return { type: parsed.type, id: parsed.id }
      }
    } catch {
      return null
    }

    return null
  }

  function isProjectExportBundle(value: unknown): value is OpenPortProjectExportBundle {
    if (!value || typeof value !== 'object') return false
    const candidate = value as {
      project?: { id?: unknown; name?: unknown }
      descendants?: unknown
      chats?: unknown
    }
    return Boolean(
      candidate.project &&
        typeof candidate.project.id === 'string' &&
        typeof candidate.project.name === 'string' &&
        Array.isArray(candidate.descendants) &&
        Array.isArray(candidate.chats)
    )
  }

  function extractChatImportItems(value: unknown): unknown[] | null {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return null

    const candidate = value as {
      items?: unknown
      chats?: unknown
    }
    if (Array.isArray(candidate.items)) return candidate.items
    if (Array.isArray(candidate.chats)) return candidate.chats
    return null
  }

  function getThreadHref(threadId: string): string {
    const project = selectedProjectId || threads.find((thread) => thread.id === threadId)?.settings.projectId
    const params = new URLSearchParams()
    params.set('thread', threadId)
    if (project) {
      params.set('project', project)
    }
    if (isArchivedView) {
      params.set('view', 'archived')
    }
    return buildChatHref(params)
  }

  async function exportProject(project: OpenPortProject): Promise<void> {
    try {
      const bundle = await exportProjectRemote(project.id, loadSession())
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `project-${project.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      notify('success', 'Project exported.')
    } catch {
      notify('error', 'Unable to export project.')
    }
  }

  async function importProject(file: File, parentId: string | null = null): Promise<void> {
    try {
      const raw = await file.text()
      const payload = JSON.parse(raw) as unknown
      if (isProjectExportBundle(payload)) {
        await importProjectBundle(payload, parentId, loadSession())
        await refreshProjects()
        notify('success', 'Project imported.')
        return
      }

      const items = extractChatImportItems(payload)
      if (!items || items.length === 0) {
        notify('error', 'Unsupported JSON import payload.')
        return
      }

      const beforeResponse = await fetchChatSessions({ archived: isArchivedView }, loadSession())
      const beforeIds = new Set(beforeResponse.items.map((item) => item.id))
      const importResponse = await importChatSessions(items, loadSession())
      const importedSessionIds = importResponse.items
        .filter((item) => !beforeIds.has(item.id))
        .map((item) => item.id)

      if (parentId && importedSessionIds.length > 0) {
        const importedById = new Map(importResponse.items.map((item) => [item.id, item]))
        await Promise.all(
          importedSessionIds.map((sessionId) => {
            const session = importedById.get(sessionId)
            if (!session) return Promise.resolve()
            return updateChatSessionSettings(
              sessionId,
              {
                ...session.settings,
                projectId: parentId
              },
              loadSession()
            )
          })
        )
      }

      const afterResponse = await fetchChatSessions({ archived: isArchivedView }, loadSession())
      setThreads(afterResponse.items)
      await refreshProjects()
      notify('success', importResponse.imported > 0 ? `Imported ${importResponse.imported} chat(s).` : 'No new chats imported.')
    } catch {
      notify('error', 'Unable to import JSON data.')
    }
  }

  const projectIds = new Set(projects.map((project) => project.id))
  const pinnedModels = uiPreferences.pinnedModelRoutes
    .map((route) => models.find((model) => model.route === route))
    .filter((model): model is OpenPortWorkspaceModel => Boolean(model))
  const activeModelRoute = selectedModelRoute || activeThread?.settings.valves.modelRoute || null
  const filteredThreads = threads.filter((thread) => {
    const projectId = thread.settings.projectId
    return !projectId || !projectIds.has(projectId)
  })

  const groupedThreads = groupChatSessionsByTimeRange(filteredThreads, getSearchTimeLabel)

  function buildChatHref(params?: URLSearchParams): string {
    const suffix = params?.toString()
    return suffix ? `/chat?${suffix}` : '/chat'
  }

  function toggleHistoryGroup(label: string): void {
    setCollapsedGroups((current) => {
      const nextValue = { ...current, [label]: !current[label] }
      saveCollapsedHistoryGroups(nextValue)
      return nextValue
    })
  }

  function getModelHref(route: string): string {
    const params = new URLSearchParams()
    params.set('model', route)
    if (selectedProjectId) {
      params.set('project', selectedProjectId)
    }
    if (isArchivedView) {
      params.set('view', 'archived')
    }
    return buildChatHref(params)
  }

  function movePinnedModelRoute(route: string, targetRoute: string): void {
    if (route === targetRoute) return

    const nextRoutes = [...uiPreferences.pinnedModelRoutes]
    const fromIndex = nextRoutes.indexOf(route)
    const toIndex = nextRoutes.indexOf(targetRoute)

    if (fromIndex === -1 || toIndex === -1) return

    nextRoutes.splice(fromIndex, 1)
    nextRoutes.splice(toIndex, 0, route)
    setUiPreferences(reorderPinnedModelRoutes(nextRoutes))
  }

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <div className="workspace-sidebar-brand">
        <a
          className="workspace-sidebar-wordmark"
          href="/chat"
          onClick={() => {
            if (isMobile) toggleSidebar()
          }}
        >
          <LandingWordmark />
        </a>
        <IconButton
          aria-label={isMobile ? 'Close sidebar' : 'Collapse sidebar'}
          className="workspace-sidebar-collapse"
          onClick={toggleSidebar}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Iconify icon="solar:sidebar-minimalistic-outline" size={17} />
        </IconButton>
      </div>

      <div className="workspace-sidebar-utility-group">
        <TextButton
          className="workspace-sidebar-utility workspace-sidebar-new-chat"
          disabled={isPending}
          id="sidebar-new-chat-button"
          onClick={onNewChat}
          variant="sidebar"
          type="button"
        >
          <span className="workspace-sidebar-utility-copy">
            <Iconify icon={isPending ? 'solar:refresh-outline' : 'solar:pen-new-square-outline'} size={18} />
            <span>{isPending ? 'Creating chat...' : 'New chat'}</span>
          </span>
        </TextButton>

        <TextButton
          id="workspace-search-toggle"
          onClick={() => {
            onOpenSearch?.()
            if (isMobile) toggleSidebar()
          }}
          variant="sidebar"
          type="button"
        >
          <span className="workspace-sidebar-utility-copy">
            <Iconify icon="solar:magnifer-outline" size={18} />
            <span>Search</span>
          </span>
        </TextButton>

        {appLinks.map((link) => (
          <TextButton
            active={isActive(pathname, link.href)}
            key={link.href}
            href={link.href}
            onClick={() => {
              if (isMobile) toggleSidebar()
            }}
            variant="sidebar"
          >
            <span className="workspace-sidebar-utility-copy">
              <Iconify icon={link.icon} size={18} />
              <span>{link.label}</span>
            </span>
          </TextButton>
        ))}
      </div>

      <SidebarSection
        actions={
          <IconButton
            aria-label={uiPreferences.collapsedSidebarSections.chats ? 'Expand chats' : 'Collapse chats'}
            onClick={() => setUiPreferences(toggleSidebarSection('chats'))}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Iconify
              icon={
                uiPreferences.collapsedSidebarSections.chats
                  ? 'solar:alt-arrow-down-outline'
                  : 'solar:alt-arrow-up-outline'
              }
              size={14}
            />
          </IconButton>
        }
        className="workspace-sidebar-history"
        title="Chats"
      >
        {uiPreferences.collapsedSidebarSections.chats ? null : (
          <div className="workspace-sidebar-history-groups">
            <TextButton
              active={!selectedProjectId && !isArchivedView}
              className={`workspace-sidebar-root-link${isRootDropTarget ? ' is-dragged-over' : ''}`}
              href={selectedModelRoute ? `/chat?model=${encodeURIComponent(selectedModelRoute)}` : '/chat'}
              onClick={() => {
                if (isMobile) toggleSidebar()
              }}
              onDragLeave={() => setIsRootDropTarget(false)}
              onDragOver={(event: DragEvent<HTMLAnchorElement>) => {
                event.preventDefault()
                setIsRootDropTarget(true)
              }}
              onDrop={(event: DragEvent<HTMLAnchorElement>) => {
                event.preventDefault()
                setIsRootDropTarget(false)
                const payload = readDragPayload(event)
                if (!payload) return

                if (payload.type === 'project') {
                  onMoveProject(payload.id, null)
                  return
                }

                void assignThreadProject(payload.id, null)
              }}
              variant="sidebar"
            >
              <Iconify icon="solar:chat-round-line-outline" size={16} />
              <span>All chats</span>
            </TextButton>

            {groupedThreads.length > 0 ? (
              <AnimatePresence initial={false}>
                {groupedThreads.map((group) => (
                <m.div key={group.label} className="workspace-sidebar-history-group" layout transition={layoutMotion}>
                  <TextButton
                    onClick={() => toggleHistoryGroup(group.label)}
                    variant="sidebar"
                    type="button"
                  >
                    <span>{group.label}</span>
                    <Iconify
                      icon={collapsedGroups[group.label] ? 'solar:alt-arrow-down-outline' : 'solar:alt-arrow-up-outline'}
                      size={14}
                    />
                  </TextButton>

                  {collapsedGroups[group.label] ? null : (
                    <m.div className="workspace-sidebar-history-list" layout transition={layoutMotion}>
                      <AnimatePresence initial={false}>
                        {group.items.slice(0, 10).map((thread) => (
                        <m.div
                          key={thread.id}
                          layout="position"
                          layoutId={`sidebar-thread-${thread.id}`}
                          transition={layoutMotion}
                        >
                          <TextButton
                          active={activeThreadId === thread.id}
                          href={getThreadHref(thread.id)}
                          onClick={() => {
                            if (isMobile) toggleSidebar()
                          }}
                          variant="sidebar"
                        >
                          <Iconify icon="solar:chat-round-line-outline" size={16} />
                          <span>{thread.title}</span>
                        </TextButton>
                        </m.div>
                      ))}
                      </AnimatePresence>
                    </m.div>
                  )}
                </m.div>
              ))}
              </AnimatePresence>
            ) : (
              <p className="workspace-sidebar-empty">
                {isArchivedView ? 'No archived chats yet.' : 'No recent chats yet.'}
              </p>
            )}
          </div>
        )}
      </SidebarSection>

      <SidebarSection
        actions={
          <>
            <IconButton
              aria-label={uiPreferences.collapsedSidebarSections.projects ? 'Expand projects' : 'Collapse projects'}
              disabled={isProjectsLoading}
              onClick={() => setUiPreferences(toggleSidebarSection('projects'))}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Iconify
                icon={
                  uiPreferences.collapsedSidebarSections.projects
                    ? 'solar:alt-arrow-down-outline'
                    : 'solar:alt-arrow-up-outline'
                }
                size={14}
              />
            </IconButton>
            <IconButton
              aria-label="Create project"
              disabled={isProjectsLoading}
              onClick={() => openCreateProjectModal(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Iconify icon="solar:add-circle-outline" size={15} />
            </IconButton>
          </>
        }
        className="workspace-sidebar-projects"
        title="Projects"
      >
        {uiPreferences.collapsedSidebarSections.projects ? null : (
          <m.div className="workspace-sidebar-project-list" layout transition={layoutMotion}>
            {projects.some((project) => project.parentId === null && !project.meta.hiddenInSidebar) ? (
              <AnimatePresence initial={false}>
                {projects
                  .filter((project) => project.parentId === null && !project.meta.hiddenInSidebar)
                  .sort((left, right) =>
                    left.name.localeCompare(right.name, undefined, {
                      numeric: true,
                      sensitivity: 'base'
                    })
                  )
                  .map((project) => (
                  <m.div key={project.id} layout="position" layoutId={`sidebar-project-root-${project.id}`} transition={layoutMotion}>
                  <ProjectTreeItem
                    activeThreadId={activeThreadId}
                    getThreadHref={getThreadHref}
                    onAssignThreadToProject={(threadId, projectId) => {
                      void assignThreadProject(threadId, projectId)
                    }}
                    onCreateChildProject={(parentProject) => openCreateProjectModal(parentProject.id)}
                    onDeleteProject={requestDeleteProject}
                    onImportProject={(file, parentProjectId) => {
                      void importProject(file, parentProjectId)
                    }}
                    onExportProject={exportProject}
                    onMoveProject={onMoveProject}
                    onOpenEditProject={openEditProjectModal}
                    onSelectProject={onSelectProject}
                    onToggleProject={onToggleProject}
                    project={project}
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    threads={threads}
                  />
                  </m.div>
                ))}
              </AnimatePresence>
            ) : (
              <p className="workspace-sidebar-empty">{isProjectsLoading ? 'Loading projects…' : 'No projects yet.'}</p>
            )}
          </m.div>
        )}
      </SidebarSection>

      {pinnedModels.length > 0 ? (
        <SidebarSection
          actions={
            <IconButton
              aria-label={uiPreferences.collapsedSidebarSections.pinnedModels ? 'Expand pinned models' : 'Collapse pinned models'}
              onClick={() => setUiPreferences(toggleSidebarSection('pinnedModels'))}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Iconify
                icon={
                  uiPreferences.collapsedSidebarSections.pinnedModels
                    ? 'solar:alt-arrow-down-outline'
                    : 'solar:alt-arrow-up-outline'
                }
                size={14}
              />
            </IconButton>
          }
          className="workspace-sidebar-pinned"
          title="Pinned"
        >
          {uiPreferences.collapsedSidebarSections.pinnedModels ? null : (
            <m.div className="workspace-sidebar-pinned-list" layout transition={layoutMotion}>
              {pinnedModels.map((model) => (
                <m.div
                  className={`workspace-sidebar-pinned-row${draggedPinnedModelRoute === model.route ? ' is-dragging' : ''}`}
                  draggable
                  key={model.id}
                  layout="position"
                  layoutId={`sidebar-pinned-model-${model.route}`}
                  onDragEnd={() => setDraggedPinnedModelRoute(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) => {
                    const dataTransfer = (event as { dataTransfer?: DataTransfer }).dataTransfer
                    if (!dataTransfer) return
                    dataTransfer.setData('text/plain', model.route)
                    setDraggedPinnedModelRoute(model.route)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const dataTransfer = (event as { dataTransfer?: DataTransfer }).dataTransfer
                    if (!dataTransfer) return
                    const route = dataTransfer.getData('text/plain')
                    movePinnedModelRoute(route, model.route)
                    setDraggedPinnedModelRoute(null)
                  }}
                  transition={layoutMotion}
                >
                  <TextButton
                    active={activeModelRoute === model.route && !activeThreadId}
                    className="workspace-sidebar-pinned-item"
                    href={getModelHref(model.route)}
                    onClick={() => {
                      if (isMobile) toggleSidebar()
                    }}
                    variant="sidebar"
                  >
                    <Iconify icon="solar:bookmark-bold" size={15} />
                    <span className="workspace-sidebar-pinned-copy">
                      <strong>{model.name}</strong>
                    </span>
                  </TextButton>
                </m.div>
              ))}
            </m.div>
          )}
        </SidebarSection>
      ) : null}

      <div className="workspace-sidebar-account">
        <div className="workspace-sidebar-account-row">
          <Iconify icon="solar:user-circle-outline" size={18} />
          <span>{accountLabel}</span>
        </div>
      </div>

      <ProjectModal
        mode={projectModalState.mode}
        onClose={closeProjectModal}
        onSubmit={handleProjectModalSubmit}
        open={projectModalState.open}
        parentProject={modalParentProject}
        project={modalProject}
      />

      <ConfirmDialog
        confirmLabel="Confirm"
        onCancel={closeDeleteDialog}
        onConfirm={() => {
          void confirmDeleteProject()
        }}
        open={deleteState.open}
        title="Delete project?"
      >
        <div className="project-delete-copy">
          Are you sure you want to delete "{deleteProjectTarget?.name || 'this project'}"?
        </div>
        <label className="project-delete-checkbox">
          <input
            checked={deleteState.clearAssignments}
            onChange={(event) =>
              setDeleteState((current) => ({
                ...current,
                clearAssignments: event.target.checked
              }))
            }
            type="checkbox"
          />
          <span>Delete all contents inside this project</span>
        </label>
      </ConfirmDialog>
    </aside>
  )
}
