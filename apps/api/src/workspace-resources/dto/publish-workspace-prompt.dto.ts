import { IsOptional, IsString } from 'class-validator'

export class PublishWorkspacePromptDto {
  @IsOptional()
  @IsString()
  versionId?: string
}
