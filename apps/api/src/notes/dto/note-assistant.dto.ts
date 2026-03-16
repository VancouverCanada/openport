import { IsString, MaxLength } from 'class-validator'

export class NoteAssistantDto {
  @IsString()
  @MaxLength(2000)
  prompt!: string
}
