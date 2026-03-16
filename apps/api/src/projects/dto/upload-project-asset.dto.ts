import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator'
import type { OpenPortProjectAssetKind } from '@openport/product-contracts'

export class UploadProjectAssetDto {
  @IsIn(['background', 'knowledge', 'chat', 'webpage'])
  kind!: OpenPortProjectAssetKind

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsNumber()
  size?: number

  @IsString()
  contentBase64!: string
}
