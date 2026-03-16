import { Module } from '@nestjs/common'
import { ApiStateStoreService } from './api-state-store.service.js'
import { IdentityStateService } from './identity-state.service.js'

@Module({
  providers: [ApiStateStoreService, IdentityStateService],
  exports: [ApiStateStoreService, IdentityStateService]
})
export class StorageModule {}
