import { WorkspaceKnowledgeCollectionEditor } from '../../../../../../components/workspace-knowledge-collection-editor'

export default async function WorkspaceKnowledgeCollectionEditPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceKnowledgeCollectionEditor collectionId={id} />
}
