import { Injectable, NotFoundException } from '@nestjs/common'
import type { OpenPortProjectAsset, OpenPortProjectAssetKind } from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { ProjectAssetStorageProviderFactory } from './project-storage.provider.js'

type AssetActor = {
  userId: string
  workspaceId: string
}

@Injectable()
export class ProjectAssetsService {
  constructor(
    private readonly stateStore: ApiStateStoreService,
    private readonly providerFactory: ProjectAssetStorageProviderFactory
  ) {}

  async upload(
    actor: AssetActor,
    input: {
      kind: OpenPortProjectAssetKind
      name: string
      type: string
      size: number
      contentBase64: string
    }
  ): Promise<{ asset: OpenPortProjectAsset; buffer: Buffer }> {
    const assetId = `asset_${randomUUID()}`
    const decodedBuffer = Buffer.from(input.contentBase64, 'base64')
    const asset: OpenPortProjectAsset = {
      id: assetId,
      workspaceId: actor.workspaceId,
      ownerUserId: actor.userId,
      kind: input.kind,
      name: input.name.trim() || 'asset',
      type: input.type || 'application/octet-stream',
      size: input.size || decodedBuffer.byteLength,
      createdAt: new Date().toISOString(),
      contentUrl: `/projects/assets/${assetId}/content`,
      sourceUrl: null,
      previewText: ''
    }

    const buffer = await this.providerFactory.getProvider().upload(actor, {
      asset,
      contentBase64: input.contentBase64
    })

    const assets = await this.stateStore.readProjectAssets(actor.workspaceId)
    await this.stateStore.writeProjectAssets(actor.workspaceId, [asset, ...assets])
    return { asset, buffer }
  }

  async getAsset(assetId: string): Promise<OpenPortProjectAsset> {
    const assetsByWorkspace = await this.stateStore.readAllProjectAssets()
    const asset = assetsByWorkspace.find((entry) => entry.id === assetId)
    if (!asset) {
      throw new NotFoundException('Project asset not found')
    }
    return asset
  }

  async readAssetContent(assetId: string): Promise<{ asset: OpenPortProjectAsset; buffer: Buffer }> {
    const asset = await this.getAsset(assetId)
    return {
      asset,
      buffer: await this.providerFactory.getProvider().read(asset)
    }
  }

  async listAssets(
    actor: AssetActor,
    options: {
      kind?: OpenPortProjectAssetKind | null
      scope?: 'workspace' | 'user'
    } = {}
  ): Promise<OpenPortProjectAsset[]> {
    const assets = await this.stateStore.readProjectAssets(actor.workspaceId)
    return assets.filter((asset) => {
      if (options.kind && asset.kind !== options.kind) return false
      if (options.scope === 'user') {
        return !asset.ownerUserId || asset.ownerUserId === actor.userId
      }
      return true
    })
  }

  async deleteAsset(actor: AssetActor, assetId: string): Promise<{ ok: true }> {
    const asset = await this.getAsset(assetId)
    if (asset.workspaceId !== actor.workspaceId) {
      throw new NotFoundException('Project asset not found')
    }

    const assets = await this.stateStore.readProjectAssets(actor.workspaceId)
    await this.providerFactory.getProvider().remove(asset)
    await this.stateStore.writeProjectAssets(
      actor.workspaceId,
      assets.filter((entry) => entry.id !== assetId)
    )
    await this.stateStore.deleteProjectAssetBlob(assetId)
    return { ok: true }
  }
}
