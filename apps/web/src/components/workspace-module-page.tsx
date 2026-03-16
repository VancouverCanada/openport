'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  fetchBootstrap,
  fetchChatSessions,
  fetchIntegrations,
  fetchProjectKnowledge,
  fetchProjects,
  loadSession,
  type OpenPortBootstrapResponse,
  type OpenPortChatSession,
  type OpenPortIntegration,
  type OpenPortProject,
  type OpenPortProjectKnowledgeItem
} from '../lib/openport-api'
import { PageHeader } from './ui/page-header'
import { Tag } from './ui/tag'

type WorkspaceModuleSection = 'models' | 'knowledge' | 'prompts' | 'tools'

type WorkspaceModulePageProps = {
  section: WorkspaceModuleSection
}

function formatBytes(size: number): string {
  if (size <= 0) return '0 KB'
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function WorkspaceModulePage({ section }: WorkspaceModulePageProps) {
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [integrations, setIntegrations] = useState<OpenPortIntegration[]>([])
  const [sessions, setSessions] = useState<OpenPortChatSession[]>([])
  const [bootstrap, setBootstrap] = useState<OpenPortBootstrapResponse | null>(null)

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchProjects(loadSession()),
      fetchProjectKnowledge(loadSession()),
      fetchIntegrations(loadSession()),
      fetchChatSessions({}, loadSession()),
      fetchBootstrap(loadSession())
    ])
      .then(([projectsResponse, knowledgeResponse, integrationsResponse, sessionsResponse, bootstrapResponse]) => {
        if (!isActive) return
        setProjects(projectsResponse.items)
        setKnowledgeItems(knowledgeResponse.items)
        setIntegrations(integrationsResponse.items)
        setSessions(sessionsResponse.items)
        setBootstrap(bootstrapResponse)
      })
      .catch(() => {
        if (!isActive) return
        setProjects([])
        setKnowledgeItems([])
        setIntegrations([])
        setSessions([])
        setBootstrap(null)
      })

    return () => {
      isActive = false
    }
  }, [])

  const modelRoutes = useMemo(() => {
    const counts = new Map<string, number>()

    sessions.forEach((session) => {
      const route = session.settings.valves.modelRoute || 'openport/local'
      counts.set(route, (counts.get(route) ?? 0) + 1)
    })

    if (counts.size === 0) {
      counts.set('openport/local', 0)
    }

    return [...counts.entries()].map(([route, count]) => ({ route, count }))
  }, [sessions])

  const knowledgeById = useMemo(() => new Map(knowledgeItems.map((item) => [item.id, item] as const)), [knowledgeItems])

  const promptProjects = useMemo(
    () =>
      projects
        .filter((project) => project.data.systemPrompt.trim().length > 0)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [projects]
  )

  const activeIntegrations = useMemo(
    () => integrations.filter((integration) => integration.status === 'active'),
    [integrations]
  )

  if (section === 'models') {
    return (
      <div className="workspace-module-page">
        <PageHeader
          description="OpenPort exposes model routes from active chat sessions and current runtime availability."
          label="Workspace"
          title="Models"
        />

        <section className="workspace-module-section">
          <div className="workspace-module-grid">
            {modelRoutes.map((item) => (
              <article key={item.route} className="workspace-module-card">
                <strong>{item.route}</strong>
                <span>{item.count > 0 ? `${item.count} active chats` : 'Ready for new chats'}</span>
                <div className="workspace-module-meta-row">
                  <span className="status-pill">{bootstrap?.status || 'ready'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-module-section">
          <div className="workspace-module-section-heading">
            <div>
              <span className="dashboard-section-label">Runtime</span>
              <h2>Available modules</h2>
            </div>
          </div>

          <div className="workspace-module-chip-row">
            {(bootstrap?.modules || []).map((module) => (
              <Tag key={module}>{module}</Tag>
            ))}
            {bootstrap?.modules?.length ? null : <p className="workspace-module-empty">No runtime modules reported.</p>}
          </div>
        </section>
      </div>
    )
  }

  if (section === 'knowledge') {
    return (
      <div className="workspace-module-page">
        <PageHeader
          description="Shared knowledge items uploaded into OpenPort and attached to project context."
          label="Workspace"
          title="Knowledge"
        />

        <section className="workspace-module-section">
          <div className="workspace-module-list">
            {knowledgeItems.length > 0 ? (
              knowledgeItems
                .slice()
                .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime())
                .map((item) => {
                  const attachedProjects = projects.filter((project) =>
                    project.data.files.some((file) => file.selected && file.knowledgeItemId === item.id)
                  )

                  return (
                    <article key={item.id} className="workspace-module-row">
                      <div className="workspace-module-row-copy">
                        <strong>{item.name}</strong>
                        <p>
                          {item.type} · {formatBytes(item.size)} · {item.chunkCount > 0 ? `${item.chunkCount} chunks` : 'Not indexed'}
                        </p>
                      </div>
                      <div className="workspace-module-row-meta">
                        <span>{attachedProjects.length} projects</span>
                      </div>
                    </article>
                  )
                })
            ) : (
              <p className="workspace-module-empty">No knowledge items uploaded yet.</p>
            )}
          </div>
        </section>
      </div>
    )
  }

  if (section === 'prompts') {
    return (
      <div className="workspace-module-page">
        <PageHeader
          description="OpenPort currently sources reusable prompt context from project-level system prompts."
          label="Workspace"
          title="Prompts"
        />

        <section className="workspace-module-section">
          <div className="workspace-module-list">
            {promptProjects.length > 0 ? (
              promptProjects.map((project) => (
                <article key={project.id} className="workspace-module-row workspace-module-row-stack">
                  <div className="workspace-module-row-copy">
                    <strong>{project.name}</strong>
                    <p>
                      {project.data.files.filter((file) => file.selected).length} attached knowledge items · {project.chatIds.length} chats
                    </p>
                  </div>
                  <pre className="workspace-module-prompt-preview">{project.data.systemPrompt.trim()}</pre>
                </article>
              ))
            ) : (
              <p className="workspace-module-empty">No project prompts configured yet.</p>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="workspace-module-page">
      <PageHeader
        description="Connected providers, runtime modules, and integration surfaces exposed to the chat layer."
        label="Workspace"
        title="Tools"
      />

      <section className="workspace-module-section">
        <div className="workspace-module-list">
          {activeIntegrations.length > 0 ? (
            activeIntegrations.map((integration) => (
              <article key={integration.id} className="workspace-module-row">
                <div className="workspace-module-row-copy">
                  <strong>{integration.name}</strong>
                  <p>{integration.description || integration.scopes.join(', ') || 'No scopes configured'}</p>
                </div>
                <div className="workspace-module-row-meta">
                  <span className="status-pill">{integration.status}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="workspace-module-empty">No active tools or integrations connected.</p>
          )}
        </div>
      </section>

      <section className="workspace-module-section">
        <div className="workspace-module-section-heading">
          <div>
            <span className="dashboard-section-label">Runtime</span>
            <h2>Mounted modules</h2>
          </div>
        </div>

        <div className="workspace-module-chip-row">
          {(bootstrap?.modules || []).map((module) => (
            <Tag key={module}>{module}</Tag>
          ))}
          {bootstrap?.modules?.length ? null : <p className="workspace-module-empty">No runtime modules reported.</p>}
        </div>
      </section>

      <section className="workspace-module-section">
        <div className="workspace-module-section-heading">
          <div>
            <span className="dashboard-section-label">Project use</span>
            <h2>Tool-backed projects</h2>
          </div>
        </div>

        <div className="workspace-module-list">
          {projects.length > 0 ? (
            projects.map((project) => (
              <article key={project.id} className="workspace-module-row">
                <div className="workspace-module-row-copy">
                  <strong>{project.name}</strong>
                  <p>
                    {project.data.files.filter((file) => file.selected && knowledgeById.has(file.knowledgeItemId || '')).length} knowledge attachments
                  </p>
                </div>
                <div className="workspace-module-row-meta">
                  <span>{project.chatIds.length} chats</span>
                </div>
              </article>
            ))
          ) : (
            <p className="workspace-module-empty">No projects created yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
