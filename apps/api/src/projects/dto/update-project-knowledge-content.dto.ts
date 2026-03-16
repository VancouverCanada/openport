import { IsString } from 'class-validator'

export class UpdateProjectKnowledgeContentDto {
  @IsString()
  contentText!: string
}
