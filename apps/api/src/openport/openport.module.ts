import { Module } from '@nestjs/common'
import { OpenPortController } from './openport.controller.js'
import { openPortRuntimeProvider } from './openport-runtime.provider.js'
import { OpenPortService } from './openport.service.js'

@Module({
  controllers: [OpenPortController],
  providers: [openPortRuntimeProvider, OpenPortService],
  exports: [openPortRuntimeProvider, OpenPortService]
})
export class OpenPortModule {}
