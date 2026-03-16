import { IsIn } from 'class-validator'

export class NoteCollaborationHeartbeatDto {
  @IsIn(['viewing', 'editing'])
  state!: 'viewing' | 'editing'
}
