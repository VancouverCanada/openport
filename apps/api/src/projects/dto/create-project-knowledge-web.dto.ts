import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateProjectKnowledgeWebDto {
  @IsString()
  url!: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  collectionName?: string

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(500000)
  maxChars?: number
}
