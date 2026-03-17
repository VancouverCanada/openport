import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class ReplayWorkspaceToolOrchestrationRunDto {
  @IsOptional()
  @IsBoolean()
  debug?: boolean

  @IsOptional()
  @IsString()
  inputPayload?: string
}
