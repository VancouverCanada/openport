import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateWorkspaceSkillDto {
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
  content?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedModelIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedToolIds?: string[]
}
