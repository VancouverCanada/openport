import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class ImportWorkspaceToolPackageDto {
  @IsObject()
  package!: Record<string, unknown>

  @IsOptional()
  @IsString()
  targetToolId?: string

  @IsOptional()
  @IsBoolean()
  forceEnable?: boolean
}
