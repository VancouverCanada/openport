import { Injectable } from '@nestjs/common'
import type {
  OpenPortBootstrapResponse,
  OpenPortIntegration,
  OpenPortListResponse
} from '@openport/product-contracts'
import { OpenPortService } from '../openport/openport.service.js'

@Injectable()
export class OpenPortAdminService {
  constructor(private readonly openport: OpenPortService) {}

  bootstrapStatus(): OpenPortBootstrapResponse {
    return {
      status: 'ready-for-productization',
      runtime: this.openport.getRuntimeSummary(),
      modules: ['auth', 'workspaces', 'rbac', 'openport-admin', 'ai']
    }
  }

  listIntegrations(): OpenPortListResponse<OpenPortIntegration> {
    const runtime = this.openport.getRuntime()
    return runtime.admin.listApps() as OpenPortListResponse<OpenPortIntegration>
  }
}
