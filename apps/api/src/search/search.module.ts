import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module.js'
import { NotesModule } from '../notes/notes.module.js'
import { ProjectsModule } from '../projects/projects.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { ChatsController } from './chats.controller.js'
import { SearchController } from './search.controller.js'
import { SearchService } from './search.service.js'

@Module({
  imports: [AiModule, NotesModule, ProjectsModule, StorageModule],
  controllers: [SearchController, ChatsController],
  providers: [SearchService],
  exports: [SearchService]
})
export class SearchModule {}
