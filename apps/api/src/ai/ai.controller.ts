import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { AiService } from './ai.service.js'
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js'
import { DeleteChatSessionsDto } from './dto/delete-chat-sessions.dto.js'
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

  @Post('sessions/:id/messages/tasks')
  async createMessageTask(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: PostMessageDto
  ): Promise<{ taskId: string }> {
    const actor = resolveActor(req.headers)
    return this.ai.createMessageTask(actor, id, dto)
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

    // Legacy compatibility endpoint.
    // Keep `messages?stream=1`, but route it through the same task lifecycle used by task endpoints.
    const task = await this.ai.createMessageTask(actor, id, dto)
    req.raw.on('close', () => {
      void this.ai.cancelChatTask(actor.userId, task.taskId, 'client_disconnect')
    })

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

    const snapshot = await this.ai.getTaskEventSnapshot(actor.userId, task.taskId)
    if (!snapshot) {
      reply.code(404)
      void reply.send({ message: 'Task not found' })
      return
    }

    snapshot.events.forEach((event) => writeEvent(event.event, event.data))
    if (snapshot.done) {
      reply.raw.end()
      return
    }

    let subscription: { unsubscribe: () => void } | null = null
    subscription = await this.ai.subscribeTaskEvents(actor.userId, task.taskId, (event) => {
      writeEvent(event.event, event.data)
      if (event.event === 'chat:active' && (event.data as { active?: boolean } | null)?.active === false) {
        subscription?.unsubscribe()
        reply.raw.end()
      }
    })

    if (!subscription) {
      reply.raw.end()
      return
    }

    req.raw.on('close', () => {
      subscription?.unsubscribe()
    })
  }

  @Post('tasks/:taskId/cancel')
  async cancelTask(@Req() req: FastifyRequest, @Param('taskId') taskId: string): Promise<{ ok: boolean }> {
    const actor = resolveActor(req.headers)
    const ok = await this.ai.cancelChatTask(actor.userId, taskId, 'user_cancel')
    return { ok }
  }

  @Post('tasks/stop/:taskId')
  async stopTask(@Req() req: FastifyRequest, @Param('taskId') taskId: string): Promise<{ ok: boolean }> {
    const actor = resolveActor(req.headers)
    const ok = await this.ai.cancelChatTask(actor.userId, taskId, 'user_cancel')
    return { ok }
  }

  @Get('tasks/:taskId/events')
  async streamTaskEvents(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param('taskId') taskId: string
  ): Promise<void> {
    const actor = resolveActor(req.headers)
    const snapshot = await this.ai.getTaskEventSnapshot(actor.userId, taskId)
    if (!snapshot) {
      reply.code(404)
      void reply.send({ message: 'Task not found' })
      return
    }

    reply
      .header('content-type', 'text/event-stream; charset=utf-8')
      .header('cache-control', 'no-cache, no-transform')
      .header('connection', 'keep-alive')
      .code(200)

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

    snapshot.events.forEach((event) => writeEvent(event.event, event.data))
    if (snapshot.done) {
      reply.raw.end()
      return
    }

    let subscription: { unsubscribe: () => void } | null = null
    subscription = await this.ai.subscribeTaskEvents(actor.userId, taskId, (event) => {
      writeEvent(event.event, event.data)
      if (event.event === 'chat:active' && (event.data as { active?: boolean } | null)?.active === false) {
        subscription?.unsubscribe()
        reply.raw.end()
      }
    })

    if (!subscription) {
      reply.raw.end()
      return
    }

    req.raw.on('close', () => {
      subscription.unsubscribe()
    })
  }

  @Get('tasks')
  async listTasks(
    @Req() req: FastifyRequest
  ): Promise<{ tasks: Array<{ id: string; sessionId: string; createdAt: string; status: 'running' }> }> {
    const actor = resolveActor(req.headers)
    return { tasks: await this.ai.listChatTasks(actor.userId) }
  }

  @Get('tasks/chat/:id')
  async listTasksByChat(
    @Req() req: FastifyRequest,
    @Param('id') id: string
  ): Promise<{ task_ids: string[] }> {
    const actor = resolveActor(req.headers)
    const tasks = await this.ai.listChatTasks(actor.userId, id)
    return { task_ids: tasks.map((task) => task.id) }
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

  @Post('sessions/batch-delete')
  deleteSessions(
    @Req() req: FastifyRequest,
    @Body() dto: DeleteChatSessionsDto
  ): Promise<{ deletedIds: string[]; missingIds: string[] }> {
    const actor = resolveActor(req.headers)
    return this.ai.deleteSessions(actor.userId, dto.ids)
  }
}
