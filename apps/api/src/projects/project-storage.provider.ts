import { Injectable } from '@nestjs/common'
import type { OpenPortProjectAsset } from '@openport/product-contracts'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { createDeterministicAssetHash } from './project-knowledge-index.js'

type AssetActor = {
  userId: string
  workspaceId: string
}

export type ProjectStorageProviderKind = 'local' | 'database'

export type UploadAssetInput = {
  asset: OpenPortProjectAsset
  contentBase64: string
}

export interface ProjectAssetStorageProvider {
  kind: ProjectStorageProviderKind
  upload(actor: AssetActor, input: UploadAssetInput): Promise<Buffer>
  read(asset: OpenPortProjectAsset): Promise<Buffer>
  remove(asset: OpenPortProjectAsset): Promise<void>
}

function resolveAssetsRoot(): string {
  const configured = process.env.OPENPORT_API_ASSETS_DIR?.trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }

  return path.resolve(process.cwd(), '.openport-product/data/assets')
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset'
}

function resolveStorageKind(): ProjectStorageProviderKind {
  const configured = process.env.OPENPORT_PROJECT_STORAGE_PROVIDER?.trim().toLowerCase()
  if (configured === 'database') return 'database'
  return 'local'
}

function resolveLocalFilePath(root: string, workspaceId: string, assetId: string, name: string, hash: string): string {
  const fileName = `${assetId}_${hash}_${sanitizeName(name)}`
  return path.join(root, workspaceId, fileName)
}

@Injectable()
export class LocalProjectAssetStorageProvider implements ProjectAssetStorageProvider {
  readonly kind: ProjectStorageProviderKind = 'local'
  private readonly assetsRoot = resolveAssetsRoot()

  async upload(actor: AssetActor, input: UploadAssetInput): Promise<Buffer> {
    const buffer = Buffer.from(input.contentBase64, 'base64')
    const hash = createDeterministicAssetHash(buffer)
    const absolutePath = resolveLocalFilePath(this.assetsRoot, actor.workspaceId, input.asset.id, input.asset.name, hash)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, buffer)
    return buffer
  }

  async read(asset: OpenPortProjectAsset): Promise<Buffer> {
    const workspaceDir = path.join(this.assetsRoot, asset.workspaceId)
    await mkdir(workspaceDir, { recursive: true })
    const files = await readdir(workspaceDir)
    const matched = files.find((entry) => entry.startsWith(`${asset.id}_`))
    if (!matched) {
      throw new Error('Project asset content not found')
    }
    return readFile(path.join(workspaceDir, matched))
  }

  async remove(asset: OpenPortProjectAsset): Promise<void> {
    const workspaceDir = path.join(this.assetsRoot, asset.workspaceId)
    await mkdir(workspaceDir, { recursive: true })
    const files = await readdir(workspaceDir)
    const matched = files.find((entry) => entry.startsWith(`${asset.id}_`))
    if (matched) {
      await unlink(path.join(workspaceDir, matched))
    }
  }
}

@Injectable()
export class DatabaseProjectAssetStorageProvider implements ProjectAssetStorageProvider {
  readonly kind: ProjectStorageProviderKind = 'database'

  constructor(private readonly stateStore: ApiStateStoreService) {}

  async upload(actor: AssetActor, input: UploadAssetInput): Promise<Buffer> {
    const buffer = Buffer.from(input.contentBase64, 'base64')
    await this.stateStore.writeProjectAssetBlob(actor.workspaceId, input.asset.id, buffer)
    return buffer
  }

  async read(asset: OpenPortProjectAsset): Promise<Buffer> {
    const blob = await this.stateStore.readProjectAssetBlob(asset.id)
    if (!blob) {
      throw new Error('Project asset content not found')
    }
    return blob.buffer
  }

  async remove(asset: OpenPortProjectAsset): Promise<void> {
    await this.stateStore.deleteProjectAssetBlob(asset.id)
  }
}

@Injectable()
export class ProjectAssetStorageProviderFactory {
  constructor(
    private readonly local: LocalProjectAssetStorageProvider,
    private readonly database: DatabaseProjectAssetStorageProvider
  ) {}

  getProvider(): ProjectAssetStorageProvider {
    return resolveStorageKind() === 'database' ? this.database : this.local
  }
}
