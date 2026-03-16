import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator'

class ChatAttachmentDto {
  @IsString()
  id!: string

  @IsString()
  type!: 'chat' | 'file' | 'knowledge' | 'note' | 'prompt' | 'web'

  @IsString()
  label!: string

  @IsOptional()
  @IsString()
  meta?: string

  @IsString()
  payload!: string

  @IsOptional()
  @IsString()
  assetId?: string | null

  @IsOptional()
  @IsString()
  contentUrl?: string | null
}

export class PostMessageDto {
  @IsString()
  @MinLength(1)
  content!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[]
}
