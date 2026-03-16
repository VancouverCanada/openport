import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module.js'
import { WorkspacesController } from './workspaces.controller.js'
import { WorkspacesService } from './workspaces.service.js'

@Module({
  imports: [StorageModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService]
})
export class WorkspacesModule {}
