import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateWorkspaceToolDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  integrationId?: string | null

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  manifest?: string

  @IsOptional()
  @IsObject()
  valves?: Record<string, string>

  @IsOptional()
  @IsArray()
  valveSchema?: Array<{
    id?: string
    key?: string
    label?: string
    type?: 'string' | 'number' | 'boolean' | 'json'
    description?: string
    defaultValue?: string
    required?: boolean
  }>

  @IsOptional()
  @IsArray()
  examples?: Array<{
    id?: string
    name?: string
    input?: string
    output?: string
  }>

  @IsOptional()
  @IsObject()
  executionChain?: {
    enabled?: boolean
    steps?: Array<{
      id?: string
      toolId?: string
      mode?: 'sequential' | 'parallel' | 'fallback'
      when?: 'always' | 'on_success' | 'on_error'
      condition?: string
      outputKey?: string
    }>
  }
}
