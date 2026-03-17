import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateWorkspaceConnectorDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  name!: string

  @IsString()
  adapter!: 'directory' | 'web' | 's3' | 'github' | 'notion' | 'rss'

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  credentialId?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsObject()
  schedule?: {
    enabled?: boolean
    intervalMinutes?: number
    timezone?: string
    incremental?: boolean
  }

  @IsOptional()
  @IsObject()
  syncPolicy?: {
    autoRetry?: boolean
    maxRetries?: number
    retryBackoffSeconds?: number
    maxDocumentsPerRun?: number
  }

  @IsOptional()
  @IsObject()
  sourceConfig?: {
    directoryPath?: string
    urls?: string[]
    bucket?: string
    prefix?: string
    repository?: string
    branch?: string
    notionDatabaseId?: string
    rssFeedUrls?: string[]
    includePatterns?: string[]
    excludePatterns?: string[]
  }
}
