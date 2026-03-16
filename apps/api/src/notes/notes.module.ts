import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { NotesCollaborationGateway } from './notes-collaboration.gateway.js'
import { NotesController } from './notes.controller.js'
import { NotesRealtimeService } from './notes-realtime.service.js'
import { NotesService } from './notes.service.js'

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [NotesController],
  providers: [NotesService, NotesRealtimeService, NotesCollaborationGateway],
  exports: [NotesService]
})
export class NotesModule {}
