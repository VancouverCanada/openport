import { IsNumber, IsOptional, IsString } from 'class-validator'

export class UploadProjectKnowledgeDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsNumber()
  size?: number

  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  collectionName?: string

  @IsString()
  contentBase64!: string
}
