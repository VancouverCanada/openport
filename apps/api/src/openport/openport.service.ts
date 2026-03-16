import { Inject, Injectable } from '@nestjs/common'
import type { OpenPortRuntime } from '@openport/core'
import { OPENPORT_RUNTIME } from './openport-runtime.provider.js'

@Injectable()
export class OpenPortService {
  constructor(
    @Inject(OPENPORT_RUNTIME)
    private readonly runtime: OpenPortRuntime
  ) {}

  getRuntime(): OpenPortRuntime {
    return this.runtime
  }

  getRuntimeSummary(): Record<string, unknown> {
    return {
      hasAdmin: Boolean(this.runtime.admin),
      hasAgent: Boolean(this.runtime.agent),
      hasAuth: Boolean(this.runtime.auth),
      domainAdapter: this.runtime.domain.constructor.name
    }
  }
}
