import { IsArray, IsOptional, IsString } from 'class-validator'

export class CreateWorkspaceConnectorCredentialDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  name!: string

  @IsString()
  provider!: 'directory' | 'web' | 's3' | 'github' | 'notion' | 'rss'

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  fields!: Array<{
    key?: string
    label?: string
    secret?: boolean
    value?: string
  }>
}
