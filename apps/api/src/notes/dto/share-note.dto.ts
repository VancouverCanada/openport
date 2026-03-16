import { IsIn, IsOptional, IsString } from 'class-validator'
import type { OpenPortNotePermission, OpenPortNotePrincipalType } from '@openport/product-contracts'

export class ShareNoteDto {
  @IsIn(['user', 'workspace', 'public'])
  principalType!: OpenPortNotePrincipalType

  @IsOptional()
  @IsString()
  principalId?: string

  @IsIn(['read', 'write', 'admin'])
  permission!: OpenPortNotePermission
}
