import { IsOptional, IsString } from 'class-validator'

export class UpdateKnowledgeItemCollectionDto {
  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  collectionName?: string
}
