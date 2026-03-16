import { IsOptional, IsString } from 'class-validator'

export class MoveProjectDto {
  @IsOptional()
  @IsString()
  parentId?: string | null
}
