import { WorkspaceKnowledgeCollectionDetail } from '../../../../../../components/workspace-knowledge-collection-detail'

export default async function WorkspaceKnowledgeCollectionSourcesPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceKnowledgeCollectionDetail collectionId={id} initialView="sources" />
}
