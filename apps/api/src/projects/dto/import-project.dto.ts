import { IsObject, IsOptional, IsString } from 'class-validator'

export class ImportProjectDto {
  @IsObject()
  bundle!: Record<string, unknown>

  @IsOptional()
  @IsString()
  parentId?: string | null
}
