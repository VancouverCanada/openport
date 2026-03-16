import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class MaintainProjectKnowledgeSourceDto {
  @IsString()
  @IsIn(['reindex', 'reset', 'remove', 'replace', 'rebuild'])
  action!: 'reindex' | 'reset' | 'remove' | 'replace' | 'rebuild'

  @IsOptional()
  @IsString()
  contentText?: string

  @IsOptional()
  @IsString()
  label?: string

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
