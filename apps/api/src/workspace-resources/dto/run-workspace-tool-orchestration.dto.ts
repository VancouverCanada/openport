import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

export class RunWorkspaceToolOrchestrationDto {
  @IsOptional()
  @IsString()
  inputPayload?: string

  @IsOptional()
  @IsBoolean()
  debug?: boolean

  @IsOptional()
  @IsNumber()
  stepLimit?: number
}
