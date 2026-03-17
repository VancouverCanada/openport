import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { OllamaService } from './ollama.service.js'

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollama: OllamaService) {}

  @Get('config')
  getConfig(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.getConfig(actor.workspaceId)
  }

  @Post('config/update')
  updateConfig(@Req() req: FastifyRequest, @Body() body: { ENABLE_OLLAMA_API?: boolean }): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.updateConfig(actor.workspaceId, body)
  }

  @Get('urls')
  listUrls(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.listUrls(actor.workspaceId).then((urls) => ({ urls }))
  }

  @Post('urls/update')
  updateUrls(@Req() req: FastifyRequest, @Body() body: { urls?: string[] }): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.updateUrls(actor.workspaceId, Array.isArray(body.urls) ? body.urls : []).then((urls) => ({ urls }))
  }

  @Get('verify')
  verifyDefault(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.verify(actor.workspaceId, 0)
  }

  @Get('verify/:idx')
  verify(@Req() req: FastifyRequest, @Param('idx') idx: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    const parsed = Number(idx)
    return this.ollama.verify(actor.workspaceId, Number.isFinite(parsed) ? parsed : 0)
  }

  @Get('api/tags')
  tagsDefault(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.fetchAllTags(actor.workspaceId)
  }

  @Get('api/tags/:idx')
  tags(@Req() req: FastifyRequest, @Param('idx') idx: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    const parsed = Number(idx)
    return this.ollama.fetchTags(actor.workspaceId, Number.isFinite(parsed) ? parsed : 0)
  }

  @Get('api/version')
  versionDefault(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.verify(actor.workspaceId, 0).then((payload) => ({ version: payload.version }))
  }

  @Get('api/version/:idx')
  version(@Req() req: FastifyRequest, @Param('idx') idx: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    const parsed = Number(idx)
    return this.ollama.verify(actor.workspaceId, Number.isFinite(parsed) ? parsed : 0).then((payload) => ({ version: payload.version }))
  }

  @Post('sync')
  sync(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ollama.ensureWorkspaceModels(actor).then(() => ({ ok: true }))
  }
}
