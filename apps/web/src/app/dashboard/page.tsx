import { DashboardSummary } from '../../components/dashboard-summary'
import { CapsuleButton } from '../../components/ui/capsule-button'

const metrics = [
  { label: 'Live integrations', value: '4', note: 'Connected adapters currently available to the local workspace.' },
  { label: 'Pending drafts', value: '7', note: 'Changes waiting for review, publish, or operator approval.' },
  { label: 'Policy alerts', value: '1', note: 'One runtime path still needs a production persistence adapter.' }
]

const implementationTrack = [
  {
    label: 'Access layer',
    detail: 'Login, registration, session storage, and workspace bootstrap are live inside the same product shell.',
    status: 'Ready'
  },
  {
    label: 'Control surface',
    detail: 'Status, connections, and chat now share one navigation model instead of separate demos.',
    status: 'Aligned'
  },
  {
    label: 'Deployment path',
    detail: 'The same stack can run locally with Node or through Docker without changing the product routes.',
    status: 'Stable'
  }
]

export default function DashboardPage() {
  return (
    <div className="dashboard-overview">
      <section className="dashboard-hero-copy">
        <div className="dashboard-kicker">Status</div>
        <h1>Keep the stack in reach.</h1>
        <p>Access, integrations, and AI operations stay inside one local control surface.</p>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-label">Overview</span>
            <h2>Live signals</h2>
          </div>
          <CapsuleButton className="dashboard-inline-action" href="/" variant="secondary">Open chat</CapsuleButton>
        </div>

        <div className="dashboard-data-list">
          {metrics.map((metric) => (
            <article key={metric.label} className="dashboard-data-row">
              <div className="dashboard-data-copy">
                <strong>{metric.label}</strong>
                <p>{metric.note}</p>
              </div>
              <div className="dashboard-data-value" aria-label={`${metric.label}: ${metric.value}`}>
                {metric.value}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-label">Status</span>
            <h2>Current implementation track</h2>
          </div>
        </div>

        <div className="dashboard-data-list">
          {implementationTrack.map((item) => (
            <article key={item.label} className="dashboard-data-row dashboard-data-row-compact">
              <div className="dashboard-data-copy">
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <span className="status-pill">{item.status}</span>
            </article>
          ))}
        </div>
      </section>

      <DashboardSummary />
    </div>
  )
}
