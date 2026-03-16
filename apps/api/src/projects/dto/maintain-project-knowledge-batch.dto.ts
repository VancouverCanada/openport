import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class MaintainProjectKnowledgeBatchDto {
  @IsString()
  @IsIn(['reindex', 'reset', 'rebuild', 'move_collection', 'delete'])
  action!: 'reindex' | 'reset' | 'rebuild' | 'move_collection' | 'delete'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[]

  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  collectionName?: string

  @IsOptional()
  @IsString()
  @IsIn(['balanced', 'dense', 'sparse', 'semantic'])
  strategy?: 'balanced' | 'dense' | 'sparse' | 'semantic'

  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(2400)
  chunkSize?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1200)
  overlap?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  maxChunks?: number
}
