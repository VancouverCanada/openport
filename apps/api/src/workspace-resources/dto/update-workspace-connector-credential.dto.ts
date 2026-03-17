import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateWorkspaceConnectorCredentialDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  provider?: 'directory' | 'web' | 's3' | 'github' | 'notion' | 'rss'

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  fields?: Array<{
    key?: string
    label?: string
    secret?: boolean
    value?: string
  }>
}
