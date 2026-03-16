import { IsOptional, IsString } from 'class-validator'

export class CreateProjectKnowledgeTextDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  collectionName?: string

  @IsString()
  contentText!: string
}
