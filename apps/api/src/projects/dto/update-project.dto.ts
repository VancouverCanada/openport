import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class ProjectMetaDto {
  @IsOptional()
  @IsString()
  backgroundImageUrl?: string | null

  @IsOptional()
  @IsString()
  backgroundImageAssetId?: string | null

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  icon?: string | null

  @IsOptional()
  @IsString()
  color?: string | null

  @IsOptional()
  @IsBoolean()
  hiddenInSidebar?: boolean
}

class ProjectFileDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  size?: number

  @IsOptional()
  addedAt?: number

  @IsOptional()
  selected?: boolean

  @IsOptional()
  @IsString()
  knowledgeItemId?: string | null

  @IsOptional()
  @IsString()
  assetId?: string | null
}

class ProjectDataDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  defaultModelRoute?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modelRoutes?: string[]

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProjectFileDto)
  files?: ProjectFileDto[]
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  parentId?: string | null

  @IsOptional()
  @IsBoolean()
  isExpanded?: boolean

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectMetaDto)
  meta?: ProjectMetaDto

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectDataDto)
  data?: ProjectDataDto
}
