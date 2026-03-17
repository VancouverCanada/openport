import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module.js'
import { OllamaController } from './ollama.controller.js'
import { OllamaService } from './ollama.service.js'

@Module({
  imports: [StorageModule],
  controllers: [OllamaController],
  providers: [OllamaService],
  exports: [OllamaService]
})
export class OllamaModule {}

