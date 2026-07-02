import { IntegrationsConsole } from '../../../components/integrations-console'
import { PageHeader } from '../../../components/ui/page-header'

export default function IntegrationsPage() {
  return (
    <div className="dashboard-overview">
      <PageHeader title="Integrations" />
      <IntegrationsConsole />
    </div>
  )
}
