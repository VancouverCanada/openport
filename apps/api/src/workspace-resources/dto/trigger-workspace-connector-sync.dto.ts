import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class TriggerWorkspaceConnectorSyncDto {
  @IsOptional()
  @IsString()
  mode?: 'full' | 'incremental'

  @IsOptional()
  @IsBoolean()
  debug?: boolean
}
