import { IsOptional, IsString } from 'class-validator'

export class SubmitWorkspacePromptCommunityDto {
  @IsOptional()
  @IsString()
  versionId?: string

  @IsOptional()
  @IsString()
  submissionUrl?: string

  @IsOptional()
  @IsString()
  note?: string
}
