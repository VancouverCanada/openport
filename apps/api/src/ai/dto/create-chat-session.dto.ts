import { IsObject, IsOptional, IsString, MinLength } from 'class-validator'
import type { OpenPortChatSettings } from '@openport/product-contracts'

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string

  @IsOptional()
  @IsObject()
  settings?: OpenPortChatSettings
}
