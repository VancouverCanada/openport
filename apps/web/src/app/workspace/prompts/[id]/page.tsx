import { WorkspacePromptEditor } from '../../../../components/workspace-prompt-editor'

export default async function WorkspacePromptDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspacePromptEditor promptId={id} />
}
