import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { AiService } from './ai.service.js'
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js'
import { ImportChatSessionsDto } from './dto/import-chat-sessions.dto.js'
import { ListChatSessionsDto } from './dto/list-chat-sessions.dto.js'
import { PostMessageDto } from './dto/post-message.dto.js'
import { UpdateChatSessionMetaDto } from './dto/update-chat-session-meta.dto.js'
import { UpdateChatSettingsDto } from './dto/update-chat-settings.dto.js'

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('sessions')
  listSessions(
    @Req() req: FastifyRequest,
    @Query() dto: ListChatSessionsDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.listSessions(actor.userId, dto)
  }

  @Post('sessions')
  createSession(
    @Req() req: FastifyRequest,
    @Body() dto: CreateChatSessionDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.createSession(actor.userId, dto)
  }

  @Get('sessions/export')
  exportSessions(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.exportSessions(actor.userId)
  }

  @Post('sessions/import')
  importSessions(
    @Req() req: FastifyRequest,
    @Body() dto: ImportChatSessionsDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.importSessions(actor.userId, dto)
  }

  @Post('sessions/archive-all')
  archiveAllSessions(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.archiveAllSessions(actor.userId)
  }

  @Get('sessions/:id')
  getSession(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.getSession(actor.userId, id)
  }

  @Patch('sessions/:id/settings')
  updateSettings(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChatSettingsDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.updateSettings(actor.userId, id, dto)
  }

  @Patch('sessions/:id/meta')
  updateMeta(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChatSessionMetaDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.updateMeta(actor.userId, id, dto)
  }

  @Post('sessions/:id/messages')
  async postMessage(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: PostMessageDto,
    @Query('stream') stream: string | boolean | undefined,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const actor = resolveActor(req.headers)
    const wantsStream = stream === true || stream === '1' || stream === 'true'

    if (!wantsStream) {
      const payload = await this.ai.postMessage(actor, id, dto)
      void reply.send(payload)
      return
    }

    // SSE stream: token deltas + status updates, terminated by a final JSON payload.
    const controller = new AbortController()
    req.raw.on('close', () => controller.abort())

    reply
      .header('content-type', 'text/event-stream; charset=utf-8')
      .header('cache-control', 'no-cache, no-transform')
      .header('connection', 'keep-alive')
      .code(200)

    // Some runtimes support explicit flushing (safe to ignore when absent).
    try {
      ;(reply.raw as any).flushHeaders?.()
    } catch {
      // ignore
    }

    const writeEvent = (event: string, data: unknown) => {
      const json = JSON.stringify(data ?? null)
      reply.raw.write(`event: ${event}\n`)
      reply.raw.write(`data: ${json}\n\n`)
    }

    try {
      for await (const chunk of this.ai.postMessageStream(actor, id, dto, { signal: controller.signal })) {
        writeEvent(chunk.event, chunk.data)
      }
    } catch (error) {
      writeEvent('error', { message: error instanceof Error ? error.message : 'Stream failed' })
    } finally {
      reply.raw.end()
    }
  }

  @Delete('sessions')
  deleteAllSessions(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.deleteAllSessions(actor.userId)
  }

  @Delete('sessions/:id')
  deleteSession(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.deleteSession(actor.userId, id)
  }
}
