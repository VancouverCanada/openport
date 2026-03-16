import { IsOptional, IsString } from 'class-validator'

export class DeleteKnowledgeCollectionDto {
  @IsOptional()
  @IsString()
  moveToCollectionId?: string

  @IsOptional()
  @IsString()
  moveToCollectionName?: string
}
