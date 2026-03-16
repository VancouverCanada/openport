import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateWorkspaceModelDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  name!: string

  @IsString()
  route!: string

  @IsOptional()
  @IsString()
  provider?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled'

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filterIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultFilterIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultFeatureIds?: string[]

  @IsOptional()
  @IsObject()
  capabilities?: {
    vision?: boolean
    webSearch?: boolean
    imageGeneration?: boolean
    codeInterpreter?: boolean
  }

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeItemIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  builtinToolIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[]

  @IsOptional()
  @IsArray()
  promptSuggestions?: Array<{
    id?: string
    title?: string
    prompt?: string
  }>
}
