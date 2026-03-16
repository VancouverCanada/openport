'use client'

import { useEffect, useState } from 'react'
import { fetchBootstrap, fetchIntegrations, loadSession, type OpenPortIntegration } from '../lib/openport-api'
import { FeedbackBanner } from './ui/feedback-banner'

export function IntegrationsConsole() {
  const [items, setItems] = useState<OpenPortIntegration[]>([])
  const [bootstrapStatus, setBootstrapStatus] = useState('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function load(): Promise<void> {
      try {
        const session = loadSession()
        const [bootstrap, integrations] = await Promise.all([
          fetchBootstrap(session),
          fetchIntegrations(session)
        ])

        if (!isActive) return
        setBootstrapStatus(bootstrap.status || 'ready')
        setItems(integrations.items)
      } catch (loadError) {
        if (!isActive) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load integrations')
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
          <span className="dashboard-section-label">Linked routes</span>
          <h2>Connections from `/api/openport-admin/integrations`</h2>
        </div>
        <span className="status-pill">{bootstrapStatus}</span>
      </div>

      <div className="dashboard-data-list">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id || item.name} className="dashboard-data-row dashboard-data-row-compact">
              <div className="dashboard-data-copy">
                <strong>{item.name}</strong>
                <p>{Array.isArray(item.keys) ? `${item.keys.length} linked key(s)` : 'No key data returned yet.'}</p>
              </div>
              <div className="dashboard-data-meta">
                <strong>{item.scope || 'unknown'}</strong>
                <span>{item.status || 'active'}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>No connections returned yet.</strong>
            <p>This view is wired to the live API contract and will populate once providers are available.</p>
          </div>
        )}
      </div>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
    </section>
  )
}
