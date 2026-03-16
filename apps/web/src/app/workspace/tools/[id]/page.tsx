import { WorkspaceToolEditor } from '../../../../components/workspace-tool-editor'

export default async function WorkspaceToolDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceToolEditor toolId={id} />
}
