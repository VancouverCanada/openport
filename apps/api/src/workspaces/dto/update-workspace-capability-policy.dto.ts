import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator'

class WorkspaceCapabilityPolicyChangeDto {
  @IsIn(['admin', 'member', 'viewer'])
  role!: 'admin' | 'member' | 'viewer'

  @IsIn(['models', 'knowledge', 'prompts', 'tools', 'skills'])
  module!: 'models' | 'knowledge' | 'prompts' | 'tools' | 'skills'

  @IsIn(['read', 'manage', 'import', 'export', 'publish', 'share', 'validate'])
  action!: 'read' | 'manage' | 'import' | 'export' | 'publish' | 'share' | 'validate'

  @IsBoolean()
  enabled!: boolean
}

export class UpdateWorkspaceCapabilityPolicyDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceCapabilityPolicyChangeDto)
  change?: WorkspaceCapabilityPolicyChangeDto

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceCapabilityPolicyChangeDto)
  changes?: WorkspaceCapabilityPolicyChangeDto[]
}
