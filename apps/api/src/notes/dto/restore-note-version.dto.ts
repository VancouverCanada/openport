import { IsString } from 'class-validator'

export class RestoreNoteVersionDto {
  @IsString()
  versionId!: string
}
