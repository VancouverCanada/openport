import { BadRequestException, Injectable } from '@nestjs/common'
import type { OpenPortWorkspaceModel } from '@openport/product-contracts'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { randomUUID } from 'node:crypto'

type OllamaConfigPayload = {
  ENABLE_OLLAMA_API: boolean
  OLLAMA_BASE_URLS: string[]
}

type OllamaVersionResponse = {
  version?: string
}

type OllamaTagsResponse = {
  models?: Array<{
    name?: string
    model?: string
    size?: number
    modified_at?: string
  }>
}

function normalizeUrl(input: string): string {
  const trimmed = String(input || '').trim()
  if (!trimmed) return ''
  // OpenWebUI accepts raw URLs. Keep it simple and just strip trailing slashes.
  return trimmed.replace(/\/+$/, '')
}

function slugifyModelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'model'
}

@Injectable()
export class OllamaService {
  constructor(private readonly stateStore: ApiStateStoreService) {}

  async getConfig(workspaceId: string): Promise<OllamaConfigPayload> {
    const stored = await this.stateStore.readOllamaConfig(workspaceId)
    if (stored) {
      return {
        ENABLE_OLLAMA_API: stored.enabled,
        OLLAMA_BASE_URLS: stored.baseUrls
      }
    }

    // Default behavior: mirror OpenWebUI's common docker setup.
    return {
      ENABLE_OLLAMA_API: true,
      OLLAMA_BASE_URLS: [normalizeUrl(process.env.OPENPORT_OLLAMA_BASE_URL || 'http://host.docker.internal:11434')]
        .filter(Boolean)
    }
  }

  async updateConfig(workspaceId: string, patch: Partial<OllamaConfigPayload>): Promise<OllamaConfigPayload> {
    const current = await this.getConfig(workspaceId)
    const enabled = patch.ENABLE_OLLAMA_API ?? current.ENABLE_OLLAMA_API
    const urls = patch.OLLAMA_BASE_URLS ?? current.OLLAMA_BASE_URLS
    const stored = await this.stateStore.writeOllamaConfig(workspaceId, {
      enabled: Boolean(enabled),
      baseUrls: Array.isArray(urls) ? urls.map((url) => normalizeUrl(url)).filter(Boolean) : []
    })
    return {
      ENABLE_OLLAMA_API: stored.enabled,
      OLLAMA_BASE_URLS: stored.baseUrls
    }
  }

  async listUrls(workspaceId: string): Promise<string[]> {
    return (await this.getConfig(workspaceId)).OLLAMA_BASE_URLS
  }

  async updateUrls(workspaceId: string, urls: string[]): Promise<string[]> {
    const next = await this.updateConfig(workspaceId, { OLLAMA_BASE_URLS: urls })
    return next.OLLAMA_BASE_URLS
  }

  async resolveBaseUrl(workspaceId: string, urlIdx = 0): Promise<string> {
    const config = await this.getConfig(workspaceId)
    if (!config.ENABLE_OLLAMA_API) {
      throw new BadRequestException('Ollama API is disabled')
    }
    const urls = config.OLLAMA_BASE_URLS
    if (!urls.length) {
      throw new BadRequestException('No Ollama URLs configured')
    }
    const idx = Math.max(0, Math.min(urlIdx, urls.length - 1))
    const baseUrl = normalizeUrl(urls[idx] || '')
    if (!baseUrl) throw new BadRequestException('Invalid Ollama URL')
    return baseUrl
  }

  async verify(workspaceId: string, urlIdx = 0): Promise<{ ok: true; version: string; baseUrl: string }> {
    const baseUrl = await this.resolveBaseUrl(workspaceId, urlIdx)
    const response = await fetch(`${baseUrl}/api/version`, { method: 'GET' })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new BadRequestException(text || `Unable to reach Ollama at ${baseUrl}`)
    }
    const payload = (await response.json().catch(() => ({}))) as OllamaVersionResponse
    const version = typeof payload.version === 'string' ? payload.version : 'unknown'
    return { ok: true, version, baseUrl }
  }

  async fetchTags(workspaceId: string, urlIdx = 0): Promise<OllamaTagsResponse> {
    const baseUrl = await this.resolveBaseUrl(workspaceId, urlIdx)
    const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new BadRequestException(text || `Unable to list Ollama models from ${baseUrl}`)
    }
    return (await response.json().catch(() => ({}))) as OllamaTagsResponse
  }

  async ensureWorkspaceModels(actor: { workspaceId: string }): Promise<void> {
    const config = await this.getConfig(actor.workspaceId)
    if (!config.ENABLE_OLLAMA_API) return

    const tags = await this.fetchTags(actor.workspaceId, 0).catch(() => ({ models: [] }))
    const rawModels = Array.isArray(tags.models) ? tags.models : []
    const names = rawModels
      .map((entry) => (typeof entry.name === 'string' ? entry.name : typeof entry.model === 'string' ? entry.model : ''))
      .map((name) => name.trim())
      .filter(Boolean)

    if (!names.length) return

    const existing = await this.stateStore.readWorkspaceModels(actor.workspaceId)
    const byRoute = new Map(existing.map((item) => [item.route, item]))
    const now = new Date().toISOString()
    const additions: OpenPortWorkspaceModel[] = []

    for (const name of names) {
      const route = `ollama/${name}`
      if (byRoute.has(route)) continue
      const id = `model_ollama_${slugifyModelName(name)}`
      const model: OpenPortWorkspaceModel = {
        id,
        workspaceId: actor.workspaceId,
        name,
        route,
        provider: 'ollama',
        description: '',
        tags: ['local'],
        status: 'active',
        isDefault: false,
        filterIds: [],
        defaultFilterIds: [],
        actionIds: [],
        defaultFeatureIds: [],
        capabilities: {
          vision: false,
          webSearch: false,
          imageGeneration: false,
          codeInterpreter: false
        },
        knowledgeItemIds: [],
        toolIds: [],
        builtinToolIds: [],
        skillIds: [],
        promptSuggestions: [],
        accessGrants: [
          {
            id: `workspace_resource_grant_${randomUUID()}`,
            workspaceId: actor.workspaceId,
            resourceType: 'model',
            resourceId: id,
            principalType: 'workspace',
            principalId: actor.workspaceId,
            permission: 'admin',
            createdAt: now
          }
        ],
        createdAt: now,
        updatedAt: now
      }
      additions.push(model)
    }

    if (additions.length === 0) return
    await this.stateStore.writeWorkspaceModels(actor.workspaceId, [...additions, ...existing])
  }
}
