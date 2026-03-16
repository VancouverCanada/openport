import { IsOptional, IsString } from 'class-validator'

export class UpdateKnowledgeCollectionDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string
}
