import { Module } from '@nestjs/common'
import { OpenPortModule } from '../openport/openport.module.js'
import { OpenPortAdminController } from './openport-admin.controller.js'
import { OpenPortAdminService } from './openport-admin.service.js'

@Module({
  imports: [OpenPortModule],
  controllers: [OpenPortAdminController],
  providers: [OpenPortAdminService]
})
export class OpenPortAdminModule {}
