import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { GroupsModule } from '../groups/groups.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { ProjectsController } from './projects.controller.js'
import { ProjectAssetsService } from './project-assets.service.js'
import { ProjectEventsService } from './project-events.service.js'
import { ProjectRetrievalService } from './project-retrieval.service.js'
import { ProjectsCollaborationGateway } from './projects-collaboration.gateway.js'
import {
  DatabaseProjectAssetStorageProvider,
  LocalProjectAssetStorageProvider,
  ProjectAssetStorageProviderFactory
} from './project-storage.provider.js'
import { ProjectsService } from './projects.service.js'

@Module({
  imports: [AuthModule, WorkspacesModule, StorageModule, GroupsModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectAssetsService,
    ProjectEventsService,
    ProjectRetrievalService,
    ProjectsCollaborationGateway,
    LocalProjectAssetStorageProvider,
    DatabaseProjectAssetStorageProvider,
    ProjectAssetStorageProviderFactory
  ],
  exports: [ProjectsService]
})
export class ProjectsModule {}
