import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module.js'
import { WorkspacesModule } from '../workspaces/workspaces.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
  imports: [WorkspacesModule, StorageModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
