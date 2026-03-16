import { IsIn, IsString } from 'class-validator'

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['owner', 'admin', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'member' | 'viewer'
}
