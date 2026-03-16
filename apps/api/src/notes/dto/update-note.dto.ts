import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateNoteDto {
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
  @IsBoolean()
  pinned?: boolean

  @IsOptional()
  @IsBoolean()
  archived?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}
