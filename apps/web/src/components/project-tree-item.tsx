'use client'

import type { CSSProperties, DragEvent } from 'react'
import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import type { OpenPortChatSession } from '../lib/openport-api'
import { getProjectChildren, type OpenPortProject } from '../lib/chat-workspace'
import { Iconify } from './iconify'
import { ProjectMenu } from './project-menu'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

type ProjectTreeItemProps = {
  activeThreadId: string | null
  onAssignThreadToProject: (threadId: string, projectId: string | null) => void
  depth?: number
  getThreadHref: (threadId: string) => string
  onCreateChildProject: (parentProject: OpenPortProject) => void
  onDeleteProject: (project: OpenPortProject) => void
  onImportProject: (file: File, parentProjectId: string) => void
  onMoveProject: (projectId: string, parentId: string | null) => void
  onOpenEditProject: (project: OpenPortProject) => void
  onExportProject: (project: OpenPortProject) => void
  onSelectProject: (projectId: string) => void
  onToggleProject: (projectId: string, nextValue?: boolean) => void
  project: OpenPortProject
  projects: OpenPortProject[]
  selectedProjectId: string | null
  threads: OpenPortChatSession[]
}

const layoutMotion = {
  layout: { type: 'spring', damping: 44, stiffness: 400 }
} as const

type DragPayload =
  | {
      type: 'project'
      id: string
    }
  | {
      type: 'chat'
      id: string
    }

function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
  const raw = event.dataTransfer.getData('text/plain')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as DragPayload
    if (!parsed || typeof parsed !== 'object') return null
    if ((parsed.type === 'project' || parsed.type === 'chat') && typeof parsed.id === 'string') {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

export function ProjectTreeItem({
  activeThreadId,
  onAssignThreadToProject,
  depth = 0,
  getThreadHref,
  onCreateChildProject,
  onDeleteProject,
  onImportProject,
  onExportProject,
  onMoveProject,
  onOpenEditProject,
  onSelectProject,
  onToggleProject,
  project,
  projects,
  selectedProjectId,
  threads
}: ProjectTreeItemProps) {
  const [draggedOver, setDraggedOver] = useState(false)

  const childProjects = useMemo(() => getProjectChildren(projects, project.id), [project.id, projects])
  const visibleChildProjects = useMemo(
    () => childProjects.filter((entry) => !entry.meta.hiddenInSidebar),
    [childProjects]
  )
  const projectChats = useMemo(
    () =>
      threads
        .filter((thread) => thread.settings.projectId === project.id && !thread.archived)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [project.id, threads]
  )
  const hasChildren = visibleChildProjects.length > 0 || projectChats.length > 0

  function handleDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault()
    setDraggedOver(false)

    const file = event.dataTransfer.files?.[0]
    if (file && file.type.includes('json')) {
      onImportProject(file, project.id)
      onToggleProject(project.id, true)
      return
    }

    const payload = readDragPayload(event)
    if (!payload) return

    if (payload.type === 'project') {
      onMoveProject(payload.id, project.id)
      return
    }

    onAssignThreadToProject(payload.id, project.id)
    onSelectProject(project.id)
    onToggleProject(project.id, true)
  }

  function handleDropOnTarget(event: DragEvent<HTMLElement>): void {
    event.preventDefault()
    setDraggedOver(false)

    const file = event.dataTransfer.files?.[0]
    if (file && file.type.includes('json')) {
      onImportProject(file, project.id)
      onToggleProject(project.id, true)
      return
    }

    const payload = readDragPayload(event)
    if (!payload) return

    if (payload.type === 'project') {
      onMoveProject(payload.id, project.id)
      onToggleProject(project.id, true)
      return
    }

    onAssignThreadToProject(payload.id, project.id)
    onSelectProject(project.id)
    onToggleProject(project.id, true)
  }

  return (
    <m.div
      className={`project-tree-item${draggedOver ? ' is-dragged-over' : ''}`}
      layout="position"
      layoutId={`project-tree-item-${project.id}`}
      style={{ '--project-depth': depth } as CSSProperties}
      transition={layoutMotion}
    >
      <div
        className={`project-tree-row${selectedProjectId === project.id ? ' is-active' : ''}`}
        draggable
        onDragOver={(event) => {
          event.preventDefault()
          setDraggedOver(true)
        }}
        onDragLeave={() => setDraggedOver(false)}
        onDragStart={(event) => {
          event.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'project',
              id: project.id
            })
          )
        }}
        onDrop={handleDropOnTarget}
      >
        <div className="project-tree-row-main">
          <IconButton
            aria-label={project.isExpanded ? 'Collapse project' : 'Expand project'}
            className="project-tree-toggle"
            onClick={() => onToggleProject(project.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {hasChildren ? (
              <Iconify
                icon={project.isExpanded ? 'solar:alt-arrow-down-outline' : 'solar:alt-arrow-right-outline'}
                size={14}
              />
            ) : (
              <span className="project-tree-toggle-spacer" />
            )}
          </IconButton>

          <TextButton className="project-tree-link" onClick={() => onSelectProject(project.id)} variant="sidebar" type="button">
            <Iconify
              icon={project.meta.icon || 'solar:folder-with-files-outline'}
              size={16}
              style={project.meta.color ? { color: project.meta.color } : undefined}
            />
            <span>{project.name}</span>
          </TextButton>
        </div>

        <div className="project-tree-actions">
          <ProjectMenu
            onCreateSubproject={() => {
              onCreateChildProject(project)
              onToggleProject(project.id, true)
            }}
            onDelete={() => onDeleteProject(project)}
            onEdit={() => onOpenEditProject(project)}
            onExport={() => onExportProject(project)}
            onMoveToRoot={project.parentId ? () => onMoveProject(project.id, null) : null}
          />
        </div>
      </div>

      {project.isExpanded ? (
        <m.div
          className="project-tree-children"
          layout
          onDragLeave={() => setDraggedOver(false)}
          onDragOver={(event) => {
            event.preventDefault()
            setDraggedOver(true)
          }}
          onDrop={handleDrop}
        >
          <AnimatePresence initial={false}>
            {visibleChildProjects.map((childProject) => (
              <ProjectTreeItem
                key={childProject.id}
                activeThreadId={activeThreadId}
                onAssignThreadToProject={onAssignThreadToProject}
                depth={depth + 1}
                getThreadHref={getThreadHref}
                onCreateChildProject={onCreateChildProject}
                onDeleteProject={onDeleteProject}
                onExportProject={onExportProject}
                onImportProject={onImportProject}
                onMoveProject={onMoveProject}
                onOpenEditProject={onOpenEditProject}
                onSelectProject={onSelectProject}
                onToggleProject={onToggleProject}
                project={childProject}
                projects={projects}
                selectedProjectId={selectedProjectId}
                threads={threads}
              />
            ))}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {projectChats.map((thread) => (
              <m.div key={thread.id} layout="position" layoutId={`project-tree-chat-${thread.id}`} transition={layoutMotion}>
                <a
                  className={`project-tree-chat-link${activeThreadId === thread.id ? ' is-active' : ''}`}
                  draggable
                  href={getThreadHref(thread.id)}
                  onDragStart={(event: DragEvent<HTMLAnchorElement>) => {
                    event.dataTransfer.setData(
                      'text/plain',
                      JSON.stringify({
                        type: 'chat',
                        id: thread.id
                      })
                    )
                  }}
                >
                  <Iconify icon="solar:chat-round-line-outline" size={14} />
                  <span>{thread.title}</span>
                </a>
              </m.div>
            ))}
          </AnimatePresence>
        </m.div>
      ) : null}
    </m.div>
  )
}
