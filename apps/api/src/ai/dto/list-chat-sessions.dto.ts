import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

export class ListChatSessionsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true
      if (value.toLowerCase() === 'false') return false
    }
    return value
  })
  @IsBoolean()
  archived?: boolean
}
