import { IsIn, IsOptional, IsString } from 'class-validator'
import type { OpenPortProjectPermission, OpenPortProjectPrincipalType } from '@openport/product-contracts'

export class ShareProjectDto {
  @IsIn(['user', 'workspace', 'group', 'public'])
  principalType!: OpenPortProjectPrincipalType

  @IsOptional()
  @IsString()
  principalId?: string

  @IsIn(['read', 'write', 'admin'])
  permission!: OpenPortProjectPermission
}
