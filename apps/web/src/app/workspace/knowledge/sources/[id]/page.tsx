import { WorkspaceKnowledgeSourceDetail } from '../../../../../components/workspace-knowledge-source-detail'

export default async function WorkspaceKnowledgeSourceDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceKnowledgeSourceDetail sourceId={id} />
}
