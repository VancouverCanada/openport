import type { OpenPortChatSettings } from '@openport/product-contracts'
import { IsObject } from 'class-validator'

export class UpdateChatSettingsDto {
  @IsObject()
  settings!: OpenPortChatSettings
}
