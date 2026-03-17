import { Injectable, NotFoundException } from '@nestjs/common'
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

type Actor = {
  userId: string
  workspaceId: string
}

type ActorInput = Actor | string

@Injectable()
export class AiService {
  constructor(
    private readonly stateStore: ApiStateStoreService,
    private readonly projects: ProjectsService,
    private readonly ollama: OllamaService
  ) {}

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
    const userMessage: OpenPortChatMessage = {
      id: `msg_${randomUUID()}`,
      role: 'user',
      content: normalizedContent,
      createdAt,
      attachments
    }
    const projectContext =
      session.settings.projectId && normalizedContent
        ? await this.projects.getKnowledgeContextForProject(actor, session.settings.projectId, normalizedContent).catch(() => '')
        : ''
    const attachmentContext =
      attachments.length > 0
        ? attachments
            .map((attachment) => `- [${attachment.type}] ${attachment.label}${attachment.meta ? ` (${attachment.meta})` : ''}${attachment.payload ? `: ${attachment.payload.slice(0, 240)}` : ''}`)
            .join('\n')
        : ''

    const createdAssistantAt = new Date().toISOString()
    let assistantContent = [
      `OpenPort API shell received: ${normalizedContent}`,
      attachmentContext ? `Attached context:\n${attachmentContext}` : '',
      projectContext ? `Project context:\n${projectContext}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')

    const modelRoute = session.settings?.valves?.modelRoute || 'openport/local'
    if (modelRoute.startsWith('ollama/')) {
      const modelName = modelRoute.slice('ollama/'.length).trim()
      if (modelName) {
        try {
          const baseUrl = await this.ollama.resolveBaseUrl(actor.workspaceId, 0)
          const history = [...session.messages, userMessage].slice(-32).map((message) => ({
            role: message.role,
            content: message.content
          }))

          const systemPrompt = session.settings?.systemPrompt?.trim() || ''
          const messages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...history] : history

          const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: modelName,
              messages,
              stream: false
            })
          })

          if (response.ok) {
            const payload = (await response.json().catch(() => ({}))) as {
              message?: { content?: string }
              response?: string
            }
            const content =
              (typeof payload.message?.content === 'string' && payload.message.content.trim()) ||
              (typeof payload.response === 'string' && payload.response.trim()) ||
              ''
            if (content) assistantContent = content
          }
        } catch {
          // Fall back to shell response on any Ollama error.
        }
      }
    }

    const assistantMessage: OpenPortChatMessage = {
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      content: assistantContent,
      createdAt: createdAssistantAt
    }
    session.messages.push(userMessage, assistantMessage)
    session.updatedAt = assistantMessage.createdAt
    await this.writeUserSessions(actor.userId, sessions)
    return {
      session,
      messages: [userMessage, assistantMessage]
    }
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

  private readUserSessions(userId: string): Promise<OpenPortChatSession[]> {
    return this.stateStore.readChatSessions(userId)
  }

  private writeUserSessions(userId: string, sessions: OpenPortChatSession[]): Promise<void> {
    return this.stateStore.writeChatSessions(userId, sessions)
  }
}
