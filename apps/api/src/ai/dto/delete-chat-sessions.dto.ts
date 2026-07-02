import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class DeleteChatSessionsDto {
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      )
    }

    if (typeof value === 'string') {
      return Array.from(
        new Set(
          value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      )
    }

    return value
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[]
}
