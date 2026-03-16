import { IsOptional, IsString } from 'class-validator'

export class ReplaceProjectKnowledgeSourceDto {
  @IsString()
  contentText!: string

  @IsOptional()
  @IsString()
  label?: string
}
