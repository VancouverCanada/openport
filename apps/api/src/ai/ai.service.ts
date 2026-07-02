import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common'
import type {
  OpenPortChatAttachment,
  OpenPortChatSessionsExportResponse,
  OpenPortChatSessionsImportResponse,
  OpenPortChatMessagesResponse,
  OpenPortChatMessage,
  OpenPortChatSettings,
  OpenPortChatSession,
  OpenPortChatSessionResponse,
  OpenPortListResponse
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import type { CreateChatSessionDto } from './dto/create-chat-session.dto.js'
import type { ImportChatSessionsDto } from './dto/import-chat-sessions.dto.js'
import type { ListChatSessionsDto } from './dto/list-chat-sessions.dto.js'
import type { PostMessageDto } from './dto/post-message.dto.js'
import type { UpdateChatSessionMetaDto } from './dto/update-chat-session-meta.dto.js'
import type { UpdateChatSettingsDto } from './dto/update-chat-settings.dto.js'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import { ProjectsService } from '../projects/projects.service.js'
import { OllamaService } from '../ollama/ollama.service.js'
import { ChatTaskStoreService } from './chat-task-store.service.js'

type Actor = {
  userId: string
  workspaceId: string
}

type ActorInput = Actor | string

type ChatStreamChunk =
  | { event: 'status'; data: { done: boolean; action: string; description: string; urls?: string[]; query?: string } }
  | { event: 'delta'; data: { delta: string } }
  | { event: 'reasoning'; data: { content: string } }
  | { event: 'final'; data: OpenPortChatMessagesResponse }

type ActiveChatTask = {
  id: string
  userId: string
  sessionId: string
  controller: AbortController
  createdAt: string
  done: boolean
  cleanupTimer: NodeJS.Timeout | null
  reason: 'client_disconnect' | 'user_cancel' | 'system'
}

type ChatTaskEvent = {
  event: string
  data: unknown
}

type ChatModelErrorCode =
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_TIMEOUT'
  | 'MODEL_REQUEST_FAILED'
  | 'MODEL_ROUTE_INVALID'
  | 'MODEL_EMPTY_RESPONSE'
  | 'GENERATION_FAILED'

class ChatModelError extends Error {
  readonly code: ChatModelErrorCode
  readonly retryable: boolean
  readonly statusCode: number
  readonly details?: string

  constructor(input: {
    code: ChatModelErrorCode
    message: string
    retryable?: boolean
    statusCode?: number
    details?: string
  }) {
    super(input.message)
    this.name = 'ChatModelError'
    this.code = input.code
    this.retryable = input.retryable ?? true
    this.statusCode = input.statusCode ?? HttpStatus.SERVICE_UNAVAILABLE
    this.details = input.details
  }
}

function isChatModelError(error: unknown): error is ChatModelError {
  return error instanceof ChatModelError
}

function safeErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || error.name || 'Unknown error'
  return 'Unknown error'
}

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && /aborted|cancelled|canceled/i.test(`${error.name} ${error.message}`))
  )
}

function createModelTransportError(error: unknown, modelName: string): ChatModelError {
  if (isChatModelError(error)) return error
  if (isAbortLikeError(error)) {
    throw error
  }

  const details = safeErrorMessage(error)
  const normalized = details.toLowerCase()
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout') ||
    normalized.includes('body timeout') ||
    normalized.includes('headers timeout')
  ) {
    return new ChatModelError({
      code: 'MODEL_TIMEOUT',
      message: `Model "${modelName}" timed out. Please retry.`,
      retryable: true,
      statusCode: HttpStatus.GATEWAY_TIMEOUT,
      details
    })
  }

  return new ChatModelError({
    code: 'MODEL_UNAVAILABLE',
    message: `Model "${modelName}" is currently unavailable. Please check model service and retry.`,
    retryable: true,
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    details
  })
}

function resolveClientMessageId(
  preferredId: string | undefined,
  existingIds: Set<string>,
  prefix: string
): string {
  const normalized = preferredId?.trim()
  if (normalized && !existingIds.has(normalized)) {
    return normalized
  }
  return `${prefix}_${randomUUID()}`
}

type OllamaStreamChunk = {
  content?: string
  reasoning?: string
}

async function* streamOllamaChat(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal
): AsyncGenerator<OllamaStreamChunk> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal
    })
  } catch (error) {
    throw createModelTransportError(error, model)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 404) {
      throw new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: `Model "${model}" is unavailable in Ollama. Please pull the model and retry.`,
        retryable: true,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        details: text || `HTTP ${response.status}`
      })
    }
    if (response.status === 408 || response.status === 504) {
      throw new ChatModelError({
        code: 'MODEL_TIMEOUT',
        message: `Model "${model}" timed out. Please retry.`,
        retryable: true,
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        details: text || `HTTP ${response.status}`
      })
    }
    if (response.status >= 500) {
      throw new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: `Model "${model}" is currently unavailable. Please retry shortly.`,
        retryable: true,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        details: text || `HTTP ${response.status}`
      })
    }
    throw new ChatModelError({
      code: 'MODEL_REQUEST_FAILED',
      message: `Model "${model}" rejected the request. Please verify model configuration and try again.`,
      retryable: false,
      statusCode: HttpStatus.BAD_REQUEST,
      details: text || `HTTP ${response.status}`
    })
  }

  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line) continue

      try {
        const payload = JSON.parse(line) as any
        const delta = typeof payload?.message?.content === 'string' ? payload.message.content : ''
        const reasoning =
          typeof payload?.message?.thinking === 'string'
            ? payload.message.thinking
            : typeof payload?.thinking === 'string'
              ? payload.thinking
              : ''
        if (delta || reasoning) {
          yield {
            content: delta || undefined,
            reasoning: reasoning || undefined
          }
        }
        if (payload?.done === true) return
      } catch {
        // ignore malformed lines
      }
    }
  }
}

function extractThinkBlocks(raw: string): { thought: string; visible: string } {
  const parts: string[] = []
  let visible = raw || ''
  visible = visible.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
    const trimmed = typeof inner === 'string' ? inner.trim() : ''
    if (trimmed) parts.push(trimmed)
    return ''
  })
  return {
    thought: parts.join('\n\n').trim(),
    visible: visible.trim()
  }
}

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly activeChatTasks = new Map<string, ActiveChatTask>()
  private readonly logger = new Logger(AiService.name)
  private teardownStopCommandsListener: (() => void) | null = null

  constructor(
    private readonly stateStore: ApiStateStoreService,
    private readonly projects: ProjectsService,
    private readonly ollama: OllamaService,
    private readonly taskStore: ChatTaskStoreService
  ) {}

  async onModuleInit(): Promise<void> {
    this.teardownStopCommandsListener = await this.taskStore.subscribeStopCommands((taskId) => {
      const task = this.activeChatTasks.get(taskId)
      if (!task || task.controller.signal.aborted) return
      task.reason = 'user_cancel'
      task.controller.abort()
    })
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.teardownStopCommandsListener) return
    try {
      await this.teardownStopCommandsListener()
    } catch (error) {
      this.logger.debug(`Failed to teardown stop command listener: ${String(error)}`)
    }
  }

  private createTaskSignal(parentSignal?: AbortSignal): AbortController {
    const controller = new AbortController()
    if (parentSignal) {
      const onAbort = () => controller.abort()
      if (parentSignal.aborted) {
        controller.abort()
      } else {
        parentSignal.addEventListener('abort', onAbort, { once: true })
      }
    }
    return controller
  }

  private emitTaskEvent(taskId: string, event: string, data: unknown): void {
    const payload: ChatTaskEvent = { event, data }
    void this.taskStore.appendEvent(taskId, payload)
  }

  private scheduleTaskCleanup(taskId: string): void {
    const task = this.activeChatTasks.get(taskId)
    if (!task) return
    if (task.cleanupTimer) {
      clearTimeout(task.cleanupTimer)
    }
    task.cleanupTimer = setTimeout(() => {
      this.activeChatTasks.delete(taskId)
    }, 120_000)
  }

  async registerChatTask(
    userId: string,
    sessionId: string,
    parentSignal?: AbortSignal
  ): Promise<{ taskId: string; signal: AbortSignal }> {
    const taskId = `task_${randomUUID()}`
    const controller = this.createTaskSignal(parentSignal)
    const createdAt = new Date().toISOString()
    this.activeChatTasks.set(taskId, {
      id: taskId,
      userId,
      sessionId,
      controller,
      createdAt,
      done: false,
      cleanupTimer: null,
      reason: 'system'
    })
    await this.taskStore.createTask({
      id: taskId,
      userId,
      sessionId,
      createdAt,
      status: 'running'
    })
    return { taskId, signal: controller.signal }
  }

  async cancelChatTask(userId: string, taskId: string, reason: ActiveChatTask['reason'] = 'user_cancel'): Promise<boolean> {
    const task = this.activeChatTasks.get(taskId)
    await this.taskStore.publishStopCommand(taskId, reason)
    if (!task || task.userId !== userId) {
      await this.taskStore.updateTaskStatus(taskId, 'cancelled')
      return false
    }
    task.reason = reason
    task.controller.abort()
    await this.taskStore.updateTaskStatus(taskId, 'cancelled')
    return true
  }

  async completeChatTask(taskId: string): Promise<void> {
    const task = this.activeChatTasks.get(taskId)
    if (task) {
      task.done = true
      this.scheduleTaskCleanup(taskId)
      await this.taskStore.updateTaskStatus(taskId, 'done')
    }
  }

  getChatTask(taskId: string): ActiveChatTask | null {
    return this.activeChatTasks.get(taskId) ?? null
  }

  async getTaskEventSnapshot(userId: string, taskId: string): Promise<{ events: ChatTaskEvent[]; done: boolean } | null> {
    return this.taskStore.getSnapshot(userId, taskId)
  }

  async subscribeTaskEvents(
    userId: string,
    taskId: string,
    listener: (event: ChatTaskEvent) => void
  ): Promise<{ unsubscribe: () => void } | null> {
    return this.taskStore.subscribe(userId, taskId, listener)
  }

  async createMessageTask(
    actorInput: ActorInput,
    sessionId: string,
    dto: PostMessageDto
  ): Promise<{ taskId: string }> {
    const actor = typeof actorInput === 'string' ? { userId: actorInput, workspaceId: 'ws_user_demo' } : actorInput
    const sessions = await this.readUserSessions(actor.userId)
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }

    const { taskId, signal } = await this.registerChatTask(actor.userId, sessionId)
    this.emitTaskEvent(taskId, 'tasks', { taskIds: [taskId] })
    this.emitTaskEvent(taskId, 'status', { done: false, action: 'queued', description: 'Queued…' })
    this.emitTaskEvent(taskId, 'active', { active: true })
    this.emitTaskEvent(taskId, 'chat:active', { active: true })

    void (async () => {
      try {
        for await (const chunk of this.postMessageStream(actor, sessionId, dto, { signal })) {
          this.emitTaskEvent(taskId, chunk.event, chunk.data)
          if (chunk.event === 'status') {
            this.emitTaskEvent(taskId, 'chat:status', chunk.data)
          }
          if (chunk.event === 'reasoning') {
            this.emitTaskEvent(taskId, 'chat:reasoning', chunk.data)
          }
          if (chunk.event === 'delta') {
            const delta = (chunk.data as { delta?: string } | null)?.delta ?? ''
            this.emitTaskEvent(taskId, 'chat:message:delta', { content: delta })
            this.emitTaskEvent(taskId, 'message', { content: delta })
          }
          if (chunk.event === 'final') {
            this.emitTaskEvent(taskId, 'chat:completion', chunk.data)
          }
        }
      } catch (error) {
        if (signal.aborted) {
          this.emitTaskEvent(taskId, 'chat:tasks:cancel', { taskIds: [taskId] })
          this.emitTaskEvent(taskId, 'cancel', { message: 'Request cancelled' })
        } else {
          this.reportModelError(error, {
            sessionId,
            modelRoute: session.settings?.valves?.modelRoute || 'unknown'
          })
          this.emitTaskEvent(taskId, 'error', this.toTaskErrorPayload(error))
        }
      } finally {
        await this.completeChatTask(taskId)
        this.emitTaskEvent(taskId, 'tasks', { taskIds: [] })
        this.emitTaskEvent(taskId, 'active', { active: false })
        this.emitTaskEvent(taskId, 'chat:active', { active: false })
      }
    })()

    return { taskId }
  }

  async listChatTasks(userId: string, sessionId?: string): Promise<Array<{
    id: string
    sessionId: string
    createdAt: string
    status: 'running'
  }>> {
    return this.taskStore.listRunningTasks(userId, sessionId)
  }

  private toTaskErrorPayload(error: unknown): { code: ChatModelErrorCode; message: string; retryable: boolean } {
    if (isChatModelError(error)) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable
      }
    }

    return {
      code: 'GENERATION_FAILED',
      message: 'Unable to generate a response right now. Please retry.',
      retryable: true
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (isChatModelError(error)) {
      return new HttpException(
        {
          code: error.code,
          message: error.message,
          retryable: error.retryable
        },
        error.statusCode
      )
    }

    return new HttpException(
      {
        code: 'GENERATION_FAILED',
        message: 'Unable to generate a response right now. Please retry.',
        retryable: true
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    )
  }

  private reportModelError(error: unknown, context: { sessionId: string; modelRoute: string }): void {
    if (isAbortLikeError(error)) return
    if (isChatModelError(error)) {
      this.logger.warn(
        `[chat:model_error] code=${error.code} retryable=${error.retryable} session=${context.sessionId} route=${context.modelRoute} details=${error.details || 'none'}`
      )
      return
    }

    this.logger.error(
      `[chat:unexpected_error] session=${context.sessionId} route=${context.modelRoute} message=${safeErrorMessage(error)}`
    )
  }

  private resolveOllamaModelRoute(session: OpenPortChatSession): { modelRoute: string; modelName: string } {
    const modelRoute = String(session.settings?.valves?.modelRoute || '')
      .trim()
    const normalizedRoute = modelRoute.toLowerCase()

    if (!modelRoute || normalizedRoute === 'openport/local') {
      throw new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: 'No available model is selected. Please choose an available model and retry.',
        retryable: false,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      })
    }

    if (!normalizedRoute.startsWith('ollama/')) {
      throw new ChatModelError({
        code: 'MODEL_ROUTE_INVALID',
        message: 'Unsupported model route. Please choose a valid Ollama model and retry.',
        retryable: false,
        statusCode: HttpStatus.BAD_REQUEST,
        details: modelRoute
      })
    }

    const modelName = modelRoute.slice('ollama/'.length).trim()
    if (!modelName) {
      throw new ChatModelError({
        code: 'MODEL_ROUTE_INVALID',
        message: 'Invalid model selection. Please reselect a model and retry.',
        retryable: false,
        statusCode: HttpStatus.BAD_REQUEST,
        details: modelRoute
      })
    }

    return { modelRoute, modelName }
  }

  private toOllamaHttpError(modelName: string, status: number, details: string): ChatModelError {
    if (status === 404) {
      return new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: `Model "${modelName}" is unavailable in Ollama. Please pull the model and retry.`,
        retryable: true,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        details
      })
    }

    if (status === 408 || status === 504) {
      return new ChatModelError({
        code: 'MODEL_TIMEOUT',
        message: `Model "${modelName}" timed out. Please retry.`,
        retryable: true,
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        details
      })
    }

    if (status >= 500) {
      return new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: `Model "${modelName}" is currently unavailable. Please retry shortly.`,
        retryable: true,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        details
      })
    }

    return new ChatModelError({
      code: 'MODEL_REQUEST_FAILED',
      message: `Model "${modelName}" rejected the request. Please verify model configuration and try again.`,
      retryable: false,
      statusCode: HttpStatus.BAD_REQUEST,
      details
    })
  }

  private toOllamaConfigError(error: unknown, modelName: string): ChatModelError {
    if (isAbortLikeError(error)) {
      throw error
    }

    if (isChatModelError(error)) {
      return error
    }

    const details = safeErrorMessage(error)
    const normalized = details.toLowerCase()
    if (
      normalized.includes('disabled') ||
      normalized.includes('no ollama urls configured') ||
      normalized.includes('invalid ollama url')
    ) {
      return new ChatModelError({
        code: 'MODEL_UNAVAILABLE',
        message: 'Model service is offline or not configured. Please check model server settings.',
        retryable: false,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        details
      })
    }

    return createModelTransportError(error, modelName)
  }

  private sortSessions(sessions: OpenPortChatSession[]): OpenPortChatSession[] {
    return sessions.sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }

  private createDefaultSettings(projectId: string | null = null): OpenPortChatSettings {
    return {
      projectId,
      systemPrompt: '',
      valves: {
        modelRoute: 'openport/local',
        operatorMode: 'default',
        functionCalling: true
      },
      params: {
        streamResponse: true,
        reasoningEffort: 'medium',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9
      }
    }
  }

  private normalizeImportedSession(input: unknown, userId: string, existingIds: Set<string>): OpenPortChatSession | null {
    if (!input || typeof input !== 'object') return null

    const record = input as Record<string, unknown>
    const importedSettings = record.settings as OpenPortChatSettings | undefined
    const importedMessages = Array.isArray(record.messages) ? record.messages : []
    const createdAt =
      typeof record.createdAt === 'string' && record.createdAt.trim().length > 0
        ? record.createdAt
        : new Date().toISOString()
    const updatedAt =
      typeof record.updatedAt === 'string' && record.updatedAt.trim().length > 0
        ? record.updatedAt
        : createdAt
    const sourceId = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : `chat_${randomUUID()}`
    const sessionId = existingIds.has(sourceId) ? `chat_${randomUUID()}` : sourceId
    existingIds.add(sessionId)

    const importedTags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12)
      : []
    const inferredShared = importedTags.some((tag) => {
      const lowered = tag.toLowerCase()
      return lowered === 'shared' || lowered === 'public'
    })
    const normalizedFolderId =
      typeof record.folderId === 'string' && record.folderId.trim().length > 0
        ? record.folderId.trim()
        : importedSettings?.projectId ?? null

    const session: OpenPortChatSession = {
      id: sessionId,
      userId,
      title: typeof record.title === 'string' && record.title.trim().length > 0 ? record.title.trim() : 'Imported Chat',
      createdAt,
      updatedAt,
      archived: Boolean(record.archived),
      pinned: Boolean(record.pinned),
      shared: typeof record.shared === 'boolean' ? record.shared : inferredShared,
      folderId: normalizedFolderId,
      tags: importedTags,
      settings: importedSettings
        ? {
            ...importedSettings,
            projectId: normalizedFolderId
          }
        : this.createDefaultSettings(normalizedFolderId),
      messages: importedMessages
        .filter(
          (message): message is OpenPortChatMessage =>
            Boolean(message) &&
            typeof message === 'object' &&
            (((message as Record<string, unknown>).role === 'user') ||
              ((message as Record<string, unknown>).role === 'assistant')) &&
            typeof (message as Record<string, unknown>).content === 'string'
        )
        .map((message, index) => ({
          id:
            typeof message.id === 'string' && message.id.trim().length > 0
              ? message.id
              : `msg_${randomUUID()}_${index}`,
          role: message.role,
          content: message.content,
          createdAt:
            typeof message.createdAt === 'string' && message.createdAt.trim().length > 0
              ? message.createdAt
              : updatedAt,
          attachments: Array.isArray(message.attachments)
            ? message.attachments
                .filter((attachment): attachment is OpenPortChatAttachment => {
                  if (!attachment || typeof attachment !== 'object') return false
                  const record = attachment as Record<string, unknown>
                  return (
                    typeof record.id === 'string' &&
                    typeof record.type === 'string' &&
                    typeof record.label === 'string' &&
                    typeof record.payload === 'string'
                  )
                })
                .map((attachment) => ({
                  id: attachment.id,
                  type: attachment.type,
                  label: attachment.label,
                  meta: attachment.meta,
                  payload: attachment.payload,
                  assetId: attachment.assetId ?? null,
                  contentUrl: attachment.contentUrl ?? null
                }))
            : []
        }))
    }

    return session
  }

  async listSessions(
    userId: string,
    filters: ListChatSessionsDto = {}
  ): Promise<OpenPortListResponse<OpenPortChatSession>> {
    return {
      items: this.sortSessions(
        (await this.readUserSessions(userId))
        .filter((session) =>
          typeof filters.archived === 'boolean' ? session.archived === filters.archived : true
        )
      )
    }
  }

  async createSession(userId: string, dto: CreateChatSessionDto): Promise<OpenPortChatSessionResponse> {
    const now = new Date().toISOString()
    const session: OpenPortChatSession = {
      id: `chat_${randomUUID()}`,
      userId,
      title: dto.title?.trim() || 'New Chat',
      archived: false,
      pinned: false,
      shared: false,
      folderId: dto.settings?.projectId ?? null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      settings: dto.settings || this.createDefaultSettings(),
      messages: []
    }
    const current = await this.readUserSessions(userId)
    current.unshift(session)
    await this.writeUserSessions(userId, current)
    return { session }
  }

  async exportSessions(userId: string): Promise<OpenPortChatSessionsExportResponse> {
    return {
      exportedAt: new Date().toISOString(),
      items: await this.readUserSessions(userId)
    }
  }

  async importSessions(userId: string, dto: ImportChatSessionsDto): Promise<OpenPortChatSessionsImportResponse> {
    const current = await this.readUserSessions(userId)
    const ids = new Set(current.map((session) => session.id))
    const importedItems = dto.items
      .map((item) => this.normalizeImportedSession(item, userId, ids))
      .filter((item): item is OpenPortChatSession => item !== null)

    if (importedItems.length === 0) {
      return { imported: 0, items: current }
    }

    const sessions = this.sortSessions([...importedItems, ...current])
    await this.writeUserSessions(userId, sessions)
    return {
      imported: importedItems.length,
      items: sessions
    }
  }

  async getSession(userId: string, sessionId: string): Promise<OpenPortChatSessionResponse> {
    const session = (await this.readUserSessions(userId)).find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }
    return { session }
  }

  updateSettings(
    userId: string,
    sessionId: string,
    dto: UpdateChatSettingsDto
  ): Promise<OpenPortChatSessionResponse> {
    return this.updateSettingsInternal(userId, sessionId, dto)
  }

  async updateMeta(
    userId: string,
    sessionId: string,
    dto: UpdateChatSessionMetaDto
  ): Promise<OpenPortChatSessionResponse> {
    const sessions = await this.readUserSessions(userId)
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }

    if (typeof dto.title === 'string' && dto.title.trim()) {
      session.title = dto.title.trim()
    }
    if (typeof dto.archived === 'boolean') {
      session.archived = dto.archived
    }
    if (typeof dto.pinned === 'boolean') {
      session.pinned = dto.pinned
    }
    if (Array.isArray(dto.tags)) {
      session.tags = Array.from(
        new Set(
          dto.tags
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      ).slice(0, 12)
      if (dto.shared === undefined) {
        session.shared = session.tags.some((tag) => {
          const lowered = tag.toLowerCase()
          return lowered === 'shared' || lowered === 'public'
        })
      }
    }
    if (typeof dto.shared === 'boolean') {
      session.shared = dto.shared
    }
    if (dto.folderId !== undefined) {
      session.folderId = dto.folderId ?? null
      session.settings = {
        ...session.settings,
        projectId: dto.folderId ?? null
      }
    }

    session.updatedAt = new Date().toISOString()
    await this.writeUserSessions(userId, sessions)
    return { session }
  }

  private async updateSettingsInternal(
    userId: string,
    sessionId: string,
    dto: UpdateChatSettingsDto
  ): Promise<OpenPortChatSessionResponse> {
    const sessions = await this.readUserSessions(userId)
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }

    session.settings = dto.settings || this.createDefaultSettings()
    session.folderId = session.settings.projectId ?? null
    session.updatedAt = new Date().toISOString()
    await this.writeUserSessions(userId, sessions)
    return { session }
  }

  async postMessage(
    actorInput: ActorInput,
    sessionId: string,
    dto: PostMessageDto
  ): Promise<OpenPortChatMessagesResponse> {
    const actor = typeof actorInput === 'string'
      ? { userId: actorInput, workspaceId: 'ws_user_demo' }
      : actorInput
    const sessions = await this.readUserSessions(actor.userId)
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }

    const normalizedContent = dto.content.trim()
    const attachments: OpenPortChatAttachment[] = Array.isArray(dto.attachments)
      ? dto.attachments
          .filter((attachment) => attachment && typeof attachment.id === 'string' && typeof attachment.label === 'string')
          .slice(0, 16)
          .map((attachment) => ({
            id: attachment.id.trim() || `att_${randomUUID()}`,
            type: attachment.type,
            label: attachment.label.trim() || 'Attachment',
            meta: attachment.meta?.trim() || undefined,
            payload: attachment.payload.trim(),
            assetId: attachment.assetId ?? null,
            contentUrl: attachment.contentUrl ?? null
          }))
      : []

    const createdAt = new Date().toISOString()
    const existingMessageIds = new Set(session.messages.map((message) => message.id))
    const userMessage: OpenPortChatMessage = {
      id: resolveClientMessageId(dto.userMessageId, existingMessageIds, 'msg'),
      role: 'user',
      content: normalizedContent,
      createdAt,
      attachments
    }
    existingMessageIds.add(userMessage.id)
    let modelRoute = 'unknown'
    let assistantContent = ''

    try {
      const selection = this.resolveOllamaModelRoute(session)
      modelRoute = selection.modelRoute
      const { modelName } = selection
      const baseUrl = await this.ollama.resolveBaseUrl(actor.workspaceId, 0).catch((error) => {
        throw this.toOllamaConfigError(error, modelName)
      })

      const history = [...session.messages, userMessage].slice(-32).map((message) => ({
        role: message.role,
        content: message.content
      }))

      const systemPrompt = session.settings?.systemPrompt?.trim() || ''
      const messages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...history] : history

      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages,
            stream: false
          })
        })
      } catch (error) {
        throw createModelTransportError(error, modelName)
      }

      if (!response.ok) {
        const details = await response.text().catch(() => '') || `HTTP ${response.status}`
        throw this.toOllamaHttpError(modelName, response.status, details)
      }

      const payload = (await response.json().catch(() => ({}))) as {
        message?: { content?: string }
        response?: string
      }
      const content =
        (typeof payload.message?.content === 'string' && payload.message.content.trim()) ||
        (typeof payload.response === 'string' && payload.response.trim()) ||
        ''
      if (!content) {
        throw new ChatModelError({
          code: 'MODEL_EMPTY_RESPONSE',
          message: `Model "${modelName}" returned an empty response. Please retry.`,
          retryable: true,
          statusCode: HttpStatus.BAD_GATEWAY
        })
      }

      assistantContent = content
    } catch (error) {
      this.reportModelError(error, { sessionId, modelRoute })
      throw this.toHttpException(error)
    }

    const assistantMessage: OpenPortChatMessage = {
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      content: assistantContent,
      createdAt: new Date().toISOString()
    }
    session.messages.push(userMessage, assistantMessage)
    session.updatedAt = assistantMessage.createdAt
    await this.writeUserSessions(actor.userId, sessions)
    return {
      session,
      messages: [userMessage, assistantMessage]
    }
  }

  async *postMessageStream(
    actorInput: ActorInput,
    sessionId: string,
    dto: PostMessageDto,
    options: { signal?: AbortSignal } = {}
  ): AsyncGenerator<ChatStreamChunk> {
    const actor = typeof actorInput === 'string'
      ? { userId: actorInput, workspaceId: 'ws_user_demo' }
      : actorInput
    const sessions = await this.readUserSessions(actor.userId)
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      throw new NotFoundException('Chat session not found')
    }

    const normalizedContent = dto.content.trim()
    const attachments: OpenPortChatAttachment[] = Array.isArray(dto.attachments)
      ? dto.attachments
          .filter((attachment) => attachment && typeof attachment.id === 'string' && typeof attachment.label === 'string')
          .slice(0, 16)
          .map((attachment) => ({
            id: attachment.id.trim() || `att_${randomUUID()}`,
            type: attachment.type,
            label: attachment.label.trim() || 'Attachment',
            meta: attachment.meta?.trim() || undefined,
            payload: attachment.payload.trim(),
            assetId: attachment.assetId ?? null,
            contentUrl: attachment.contentUrl ?? null
          }))
      : []

    const createdAt = new Date().toISOString()
    const existingMessageIds = new Set(session.messages.map((message) => message.id))
    const userMessage: OpenPortChatMessage = {
      id: resolveClientMessageId(dto.userMessageId, existingMessageIds, 'msg'),
      role: 'user',
      content: normalizedContent,
      createdAt,
      attachments
    }
    existingMessageIds.add(userMessage.id)

    yield { event: 'status', data: { done: false, action: 'reasoning_start', description: 'Thinking…' } }

    yield { event: 'status', data: { done: false, action: 'context_lookup', description: 'Retrieving context…' } }

    const systemPrompt = session.settings?.systemPrompt?.trim() || ''
    const history = [...session.messages, userMessage].slice(-32).map((message) => ({
      role: message.role,
      content: message.content
    }))
    const chatMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...history] : history

    const startedAt = Date.now()
    let assistantContent = ''
    let assistantReasoning = ''
    let modelRoute = 'unknown'
    let modelName = ''
    try {
      const selection = this.resolveOllamaModelRoute(session)
      modelRoute = selection.modelRoute
      modelName = selection.modelName
      yield { event: 'status', data: { done: false, action: 'model_dispatch', description: `Calling ${modelName}…` } }
      const baseUrl = await this.ollama.resolveBaseUrl(actor.workspaceId, 0).catch((error) => {
        throw this.toOllamaConfigError(error, modelName)
      })
      let emittedFirstToken = false
      for await (const chunk of streamOllamaChat(baseUrl, modelName, chatMessages, options.signal)) {
        if (!emittedFirstToken) {
          emittedFirstToken = true
          yield {
            event: 'status',
            data: { done: false, action: 'response_stream_start', description: 'Receiving response…' }
          }
        }
        if (chunk.reasoning) {
          assistantReasoning += chunk.reasoning
          yield { event: 'reasoning', data: { content: assistantReasoning } }
        }
        if (chunk.content) {
          assistantContent += chunk.content
          yield { event: 'delta', data: { delta: chunk.content } }
        }
      }
    } catch (error) {
      this.reportModelError(error, { sessionId, modelRoute })
      throw error
    }

    if (!assistantContent.trim()) {
      throw new ChatModelError({
        code: 'MODEL_EMPTY_RESPONSE',
        message: `Model "${modelName || 'selected model'}" returned an empty response. Please retry.`,
        retryable: true,
        statusCode: HttpStatus.BAD_GATEWAY
      })
    }

    const assistantMessage: OpenPortChatMessage = {
      id: resolveClientMessageId(dto.assistantMessageId, existingMessageIds, 'msg'),
      role: 'assistant',
      content: assistantContent,
      createdAt: new Date().toISOString()
    }

    session.messages.push(userMessage, assistantMessage)
    session.updatedAt = assistantMessage.createdAt
    await this.writeUserSessions(actor.userId, sessions)

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    const extracted = extractThinkBlocks(assistantContent)
    const reasoningContent = (assistantReasoning || extracted.thought).trim()
    if (reasoningContent) {
      assistantMessage.reasoningContent = reasoningContent
      yield { event: 'reasoning', data: { content: reasoningContent } }
    }
    yield { event: 'status', data: { done: false, action: 'persisting', description: 'Finalizing response…' } }
    yield {
      event: 'status',
      data: { done: true, action: 'reasoning_complete', description: `Thought for ${durationSeconds} seconds` }
    }
    yield { event: 'final', data: { session, messages: [userMessage, assistantMessage] } }
  }

  async archiveAllSessions(userId: string): Promise<OpenPortListResponse<OpenPortChatSession>> {
    const sessions = await this.readUserSessions(userId)
    const updatedAt = new Date().toISOString()
    const archived = sessions.map((session) => ({
      ...session,
      archived: true,
      updatedAt
    }))
    await this.writeUserSessions(userId, archived)
    return { items: this.sortSessions(archived) }
  }

  async deleteAllSessions(userId: string): Promise<{ ok: true }> {
    await this.writeUserSessions(userId, [])
    return { ok: true }
  }

  async deleteSession(userId: string, sessionId: string): Promise<{ ok: true }> {
    const sessions = await this.readUserSessions(userId)
    const nextSessions = sessions.filter((session) => session.id !== sessionId)
    await this.writeUserSessions(userId, nextSessions)
    return { ok: true }
  }

  async deleteSessions(
    userId: string,
    sessionIds: string[]
  ): Promise<{ deletedIds: string[]; missingIds: string[] }> {
    const normalizedIds = Array.from(
      new Set(
        sessionIds
          .map((sessionId) => sessionId.trim())
          .filter(Boolean)
      )
    )
    if (normalizedIds.length === 0) return { deletedIds: [], missingIds: [] }

    const sessions = await this.readUserSessions(userId)
    const sessionIdSet = new Set(sessions.map((session) => session.id))
    const deletedIds = normalizedIds.filter((sessionId) => sessionIdSet.has(sessionId))
    const missingIds = normalizedIds.filter((sessionId) => !sessionIdSet.has(sessionId))

    if (deletedIds.length > 0) {
      const deletedIdSet = new Set(deletedIds)
      const nextSessions = sessions.filter((session) => !deletedIdSet.has(session.id))
      await this.writeUserSessions(userId, nextSessions)
    }

    return { deletedIds, missingIds }
  }

  private readUserSessions(userId: string): Promise<OpenPortChatSession[]> {
    return this.stateStore.readChatSessions(userId)
  }

  private writeUserSessions(userId: string, sessions: OpenPortChatSession[]): Promise<void> {
    return this.stateStore.writeChatSessions(userId, sessions)
  }
}
