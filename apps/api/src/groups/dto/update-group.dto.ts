import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberUserIds?: string[]
}
