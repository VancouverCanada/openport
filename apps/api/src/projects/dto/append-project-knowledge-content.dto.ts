import { IsString } from 'class-validator'

export class AppendProjectKnowledgeContentDto {
  @IsString()
  contentText!: string
}
