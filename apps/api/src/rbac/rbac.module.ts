import { Module } from '@nestjs/common'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { RbacController } from './rbac.controller.js'
import { RbacService } from './rbac.service.js'

@Module({
  imports: [WorkspacesModule],
  controllers: [RbacController],
  providers: [RbacService]
})
export class RbacModule {}
