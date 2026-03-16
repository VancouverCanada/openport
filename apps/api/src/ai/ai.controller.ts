import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
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
  postMessage(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: PostMessageDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.ai.postMessage(actor, id, dto)
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
