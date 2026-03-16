'use client'

import { useEffect, useState } from 'react'
import { fetchBootstrap, fetchCurrentUser, fetchWorkspaces, loadSession } from '../lib/openport-api'
import { FeedbackBanner } from './ui/feedback-banner'

type SummaryState = {
  userLabel: string
  workspaceCount: number
  bootstrapStatus: string
}

export function DashboardSummary() {
  const [summary, setSummary] = useState<SummaryState>({
    userLabel: 'Demo operator',
    workspaceCount: 0,
    bootstrapStatus: 'loading'
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function load(): Promise<void> {
      try {
        const session = loadSession()
        const [bootstrap, workspaces, me] = await Promise.all([
          fetchBootstrap(session),
          session ? fetchWorkspaces(session) : Promise.resolve({ items: [] }),
          session ? fetchCurrentUser(session) : Promise.resolve({ user: { email: 'demo@openport.local' } })
        ])

        if (!isActive) return

        setSummary({
          userLabel: me.user.email || 'demo@openport.local',
          workspaceCount: workspaces.items.length,
          bootstrapStatus: bootstrap.status || 'ready'
        })
      } catch (loadError) {
        if (!isActive) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data')
      }
    }

    void load()
    return () => {
      isActive = false
    }
  }, [])

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-heading">
        <div>
          <span className="dashboard-section-label">Runtime</span>
          <h2>Connected signals</h2>
        </div>
      </div>

      <div className="dashboard-data-list">
        <div className="dashboard-data-row dashboard-data-row-compact">
          <div className="dashboard-data-copy">
            <strong>Current actor</strong>
            <p>{summary.userLabel}</p>
          </div>
          <span className="status-pill">{summary.bootstrapStatus}</span>
        </div>

        <div className="dashboard-data-row dashboard-data-row-compact">
          <div className="dashboard-data-copy">
            <strong>Workspace count</strong>
            <p>Loaded from `/api/workspaces` when a session is present.</p>
          </div>
          <div className="dashboard-data-value dashboard-data-value-small">{summary.workspaceCount}</div>
        </div>
      </div>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
    </section>
  )
}
