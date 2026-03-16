import { IsOptional, IsString } from 'class-validator'

export class UploadNoteAssetDto {
  @IsString()
  dataUrl!: string

  @IsOptional()
  @IsString()
  fileName?: string

  @IsOptional()
  @IsString()
  noteId?: string
}
