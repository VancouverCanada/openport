import { Module } from '@nestjs/common'
import { GroupsModule } from '../groups/groups.module.js'
import { OllamaModule } from '../ollama/ollama.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { WorkspaceResourcesController } from './workspace-resources.controller.js'
import { WorkspaceResourcesService } from './workspace-resources.service.js'

@Module({
  imports: [StorageModule, WorkspacesModule, GroupsModule, OllamaModule],
  controllers: [WorkspaceResourcesController],
  providers: [WorkspaceResourcesService],
  exports: [WorkspaceResourcesService]
})
export class WorkspaceResourcesModule {}
