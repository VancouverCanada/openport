import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import type { OpenPortSearchResultType } from '@openport/product-contracts'

export class SearchHistoryTrackDto {
  @IsString()
  query!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  lastResultCount?: number

  @IsOptional()
  @IsString()
  topResultType?: OpenPortSearchResultType
}
