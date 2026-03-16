import { IsIn, IsString } from 'class-validator'

export class AddMemberDto {
  @IsString()
  userId!: string

  @IsString()
  @IsIn(['owner', 'admin', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'member' | 'viewer'
}
