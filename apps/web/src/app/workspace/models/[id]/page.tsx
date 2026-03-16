import { WorkspaceModelEditor } from '../../../../components/workspace-model-editor'

export default async function WorkspaceModelDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceModelEditor modelId={id} />
}
