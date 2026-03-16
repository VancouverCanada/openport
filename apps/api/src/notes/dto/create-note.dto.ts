import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsString()
  contentMd?: string

  @IsOptional()
  @IsString()
  contentHtml?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}
