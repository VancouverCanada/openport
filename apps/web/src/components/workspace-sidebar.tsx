'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { DragEvent } from 'react'
import { useEffect, useState, useTransition } from 'react'
import {
  buildProjectEventsUrl,
  createChatSession,
  createProject as createProjectRemote,
  deleteProject as deleteProjectRemote,
  exportProject as exportProjectRemote,
  fetchChatSessions,
  fetchProjects,
  fetchWorkspaces,
  fetchWorkspaceModels,
  importProjectBundle,
  loadSession,
  moveProject as moveProjectRemote,
  switchSessionWorkspace,
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
  saveProjectKnowledgeToCache,
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
import type { OpenPortWorkspace } from '@openport/product-contracts'

const appLinks = [
  { href: '/dashboard/notes', label: 'Notes', icon: 'solar:notebook-outline' },
  { href: '/workspace', label: 'Workspace', icon: 'solar:widget-5-outline' }
]

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
  const [workspaces, setWorkspaces] = useState<OpenPortWorkspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('')
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false)
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
      if (session?.workspaceId && isActive) {
        setActiveWorkspaceId(session.workspaceId)
      }
      setCollapsedGroups(loadCollapsedHistoryGroups())
      setUiPreferences(loadChatUiPreferences())
      const workspaceLoad = session
        ? fetchWorkspaces(session)
            .then((response) => {
              if (!isActive) return
              setWorkspaces(response.items)
            })
            .catch(() => {
              if (!isActive) return
              setWorkspaces([])
            })
        : Promise.resolve().then(() => {
            if (!isActive) return
            setWorkspaces([])
          })

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
          }),
        workspaceLoad
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
  }, [activeWorkspaceId, isArchivedView])

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
  }, [activeWorkspaceId, isArchivedView])

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
          router.push('/chat')
          if (isMobile) toggleSidebar()
        }
      })()
    })
  }

  function onWorkspaceSwitch(nextWorkspaceId: string): void {
    const targetWorkspaceId = nextWorkspaceId.trim()
    if (!targetWorkspaceId || targetWorkspaceId === activeWorkspaceId || isSwitchingWorkspace) return

    setIsSwitchingWorkspace(true)
    const nextSession = switchSessionWorkspace(targetWorkspaceId)
    if (!nextSession) {
      setIsSwitchingWorkspace(false)
      notify('error', 'Unable to switch workspace.')
      return
    }

    setActiveWorkspaceId(targetWorkspaceId)
    saveProjectsToCache([])
    saveProjectKnowledgeToCache([])
    window.dispatchEvent(new CustomEvent(getWorkspaceEventName()))
    router.push('/chat')
    router.refresh()
    notify('success', 'Workspace switched.')
    setIsSwitchingWorkspace(false)
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
        router.push('/chat')
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
      const bundle = JSON.parse(raw) as OpenPortProjectExportBundle
      await importProjectBundle(bundle, parentId, loadSession())
      await refreshProjects()
      notify('success', 'Project imported.')
    } catch {
      notify('error', 'Unable to import project bundle.')
    }
  }

  const projectIds = new Set(projects.map((project) => project.id))
  const pinnedModels = uiPreferences.pinnedModelRoutes
    .map((route) => models.find((model) => model.route === route))
    .filter((model): model is OpenPortWorkspaceModel => Boolean(model))
  const activeModelRoute = selectedModelRoute || activeThread?.settings.valves.modelRoute || null
  const workspaceOptions = workspaces.length > 0
    ? workspaces
    : activeWorkspaceId
      ? [{ id: activeWorkspaceId, name: 'Current workspace' }]
      : []
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
            <span>{isPending ? 'Creating chat...' : 'New Chat'}</span>
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
              variant="toolbar"
            >
              <Iconify icon="solar:add-circle-outline" size={15} />
            </IconButton>
          </>
        }
        className="workspace-sidebar-projects"
        title="Projects"
      >
        {uiPreferences.collapsedSidebarSections.projects ? null : (
          <>
            <div className="workspace-sidebar-project-list">
              {projects.some((project) => project.parentId === null && !project.meta.hiddenInSidebar) ? (
                projects
                  .filter((project) => project.parentId === null && !project.meta.hiddenInSidebar)
                  .sort((left, right) =>
                    left.name.localeCompare(right.name, undefined, {
                      numeric: true,
                      sensitivity: 'base'
                    })
                  )
                  .map((project) => (
                    <ProjectTreeItem
                      key={project.id}
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
                  ))
              ) : (
                <p className="workspace-sidebar-empty">{isProjectsLoading ? 'Loading projects…' : 'No projects yet.'}</p>
              )}
            </div>
          </>
        )}
      </SidebarSection>

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
              groupedThreads.map((group) => (
                <div key={group.label} className="workspace-sidebar-history-group">
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
                    <div className="workspace-sidebar-history-list">
                      {group.items.slice(0, 10).map((thread) => (
                        <TextButton
                          active={activeThreadId === thread.id}
                          key={thread.id}
                          href={getThreadHref(thread.id)}
                          onClick={() => {
                            if (isMobile) toggleSidebar()
                          }}
                          variant="sidebar"
                        >
                          <Iconify icon="solar:chat-round-line-outline" size={16} />
                          <span>{thread.title}</span>
                        </TextButton>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="workspace-sidebar-empty">
                {isArchivedView ? 'No archived chats yet.' : 'No recent chats yet.'}
              </p>
            )}
          </div>
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
          title="Pinned Models"
        >
          {uiPreferences.collapsedSidebarSections.pinnedModels ? null : (
            <div className="workspace-sidebar-pinned-list">
              {pinnedModels.map((model) => (
                <div
                  className={`workspace-sidebar-pinned-row${draggedPinnedModelRoute === model.route ? ' is-dragging' : ''}`}
                  draggable
                  key={model.id}
                  onDragEnd={() => setDraggedPinnedModelRoute(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', model.route)
                    setDraggedPinnedModelRoute(model.route)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const route = event.dataTransfer.getData('text/plain')
                    movePinnedModelRoute(route, model.route)
                    setDraggedPinnedModelRoute(null)
                  }}
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
                      <span>{model.route}</span>
                    </span>
                  </TextButton>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>
      ) : null}

      <div className="workspace-sidebar-account">
        {workspaceOptions.length > 1 ? (
          <div className="workspace-sidebar-workspace-switcher">
            <label htmlFor="workspace-sidebar-switcher">Active workspace</label>
            <select
              className="workspace-sidebar-workspace-select"
              disabled={isSwitchingWorkspace}
              id="workspace-sidebar-switcher"
              onChange={(event) => onWorkspaceSwitch(event.target.value)}
              value={activeWorkspaceId || workspaceOptions[0]?.id || ''}
            >
              {workspaceOptions.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
