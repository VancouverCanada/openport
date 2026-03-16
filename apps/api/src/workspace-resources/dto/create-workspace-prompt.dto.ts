import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'

export class CreateWorkspacePromptDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  title!: string

  @IsString()
  command!: string

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
