import { IsOptional, IsString } from 'class-validator'

export class CreateKnowledgeCollectionDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string
}
