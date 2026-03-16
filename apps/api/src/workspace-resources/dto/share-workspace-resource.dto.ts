import { IsIn, IsOptional, IsString } from 'class-validator'
import type {
  OpenPortWorkspaceResourcePermission,
  OpenPortWorkspaceResourcePrincipalType
} from '@openport/product-contracts'

export class ShareWorkspaceResourceDto {
  @IsIn(['user', 'workspace', 'group', 'public'])
  principalType!: OpenPortWorkspaceResourcePrincipalType

  @IsOptional()
  @IsString()
  principalId?: string

  @IsIn(['read', 'write', 'admin'])
  permission!: OpenPortWorkspaceResourcePermission
}
