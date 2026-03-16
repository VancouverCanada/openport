import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateWorkspacePromptDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  command?: string

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
  @IsString()
  visibility?: 'private' | 'workspace'

  @IsOptional()
  @IsString()
  commitMessage?: string

  @IsOptional()
  @IsBoolean()
  setAsProduction?: boolean
}
