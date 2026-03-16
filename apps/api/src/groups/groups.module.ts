import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module.js'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { GroupsController } from './groups.controller.js'
import { GroupsService } from './groups.service.js'

@Module({
  imports: [StorageModule, WorkspacesModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService]
})
export class GroupsModule {}
