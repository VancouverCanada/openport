import { IntegrationsConsole } from '../../../components/integrations-console'

export default function IntegrationsPage() {
  return (
    <div className="dashboard-overview">
      <section className="dashboard-hero-copy">
        <div className="dashboard-kicker">Connections</div>
        <h1>Keep every route visible.</h1>
        <p>Models, keys, and provider links stay close to the main control surface instead of hiding in a setup wizard.</p>
      </section>

      <IntegrationsConsole />
    </div>
  )
}
