import { IsArray, IsOptional, IsString } from 'class-validator'

export class ImportChatSessionsDto {
  @IsOptional()
  @IsString()
  exportedAt?: string

  @IsArray()
  items!: unknown[]
}
