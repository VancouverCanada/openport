import { IsEmail, IsIn, IsString } from 'class-validator'

export class InviteMemberDto {
  @IsEmail()
  email!: string

  @IsString()
  @IsIn(['owner', 'admin', 'member', 'viewer'])
  role!: string
}
