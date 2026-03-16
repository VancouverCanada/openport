import { WorkspaceKnowledgeDetail } from '../../../../components/workspace-knowledge-detail'

export default async function WorkspaceKnowledgeDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceKnowledgeDetail itemId={id} />
}
