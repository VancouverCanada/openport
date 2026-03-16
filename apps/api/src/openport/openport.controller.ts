import { Controller, Get } from '@nestjs/common'
import { OpenPortService } from './openport.service.js'

@Controller('openport')
export class OpenPortController {
  constructor(private readonly openPort: OpenPortService) {}

  @Get('runtime')
  getRuntime(): Record<string, unknown> {
    return this.openPort.getRuntimeSummary()
  }
}
