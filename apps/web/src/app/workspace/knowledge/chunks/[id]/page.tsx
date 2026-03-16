import { WorkspaceKnowledgeChunkDetail } from '../../../../../components/workspace-knowledge-chunk-detail'

export default async function WorkspaceKnowledgeChunkDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceKnowledgeChunkDetail chunkId={id} />
}
