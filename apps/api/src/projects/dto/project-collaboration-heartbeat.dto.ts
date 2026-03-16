import { IsIn } from 'class-validator'

export class ProjectCollaborationHeartbeatDto {
  @IsIn(['viewing', 'editing'])
  state!: 'viewing' | 'editing'
}
