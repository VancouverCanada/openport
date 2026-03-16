import { Controller, Get } from '@nestjs/common'
import { OpenPortAdminService } from './openport-admin.service.js'

@Controller('openport-admin')
export class OpenPortAdminController {
  constructor(private readonly admin: OpenPortAdminService) {}

  @Get('bootstrap')
  bootstrap(): Record<string, unknown> {
    return this.admin.bootstrapStatus()
  }

  @Get('integrations')
  integrations(): Record<string, unknown> {
    return this.admin.listIntegrations()
  }
}
