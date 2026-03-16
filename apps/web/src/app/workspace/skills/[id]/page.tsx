import { WorkspaceSkillEditor } from '../../../../components/workspace-skill-editor'

export default async function WorkspaceSkillDetailPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return <WorkspaceSkillEditor skillId={id} />
}
