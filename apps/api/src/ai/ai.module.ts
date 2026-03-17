import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { ProjectsModule } from '../projects/projects.module.js'
import { OllamaModule } from '../ollama/ollama.module.js'
import { AiController } from './ai.controller.js'
import { AiService } from './ai.service.js'
import { StorageModule } from '../storage/storage.module.js'

@Module({
  imports: [AuthModule, StorageModule, ProjectsModule, OllamaModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService]
})
export class AiModule {}
