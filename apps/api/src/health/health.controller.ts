import { Controller, Get } from '@nestjs/common'
import type { ProductHealthResponse } from '@openport/product-contracts'

@Controller('health')
export class HealthController {
  @Get()
  check(): ProductHealthResponse {
    return {
      status: 'ok',
      service: 'openport-api',
      phase: 'phase-3-shell',
      domainAdapter: process.env.OPENPORT_DOMAIN_ADAPTER === 'postgres' ? 'postgres' : 'memory'
    }
  }
}
