import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  OpenPortListResponse,
  OpenPortNote,
  OpenPortNoteAssistantMessage,
  OpenPortNoteAssistantResponse,
  OpenPortNoteCollaborationState,
  OpenPortNoteGrant,
  OpenPortNoteGrantResponse,
  OpenPortNotePermission,
  OpenPortNotePresence,
  OpenPortNotePrincipalType,
  OpenPortNoteResponse,
  OpenPortNoteVersion
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AuthService } from '../auth/auth.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import type { NoteAssistantDto } from './dto/note-assistant.dto.js'
import type { NoteCollaborationHeartbeatDto } from './dto/note-collaboration-heartbeat.dto.js'
import type { CreateNoteDto } from './dto/create-note.dto.js'
import type { RestoreNoteVersionDto } from './dto/restore-note-version.dto.js'
import type { ShareNoteDto } from './dto/share-note.dto.js'
import type { UploadNoteAssetDto } from './dto/upload-note-asset.dto.js'
import type { UpdateNoteDto } from './dto/update-note.dto.js'

type NoteRecord = OpenPortNote

const COLLABORATION_TTL_MS = 45_000
const NOTE_UPLOAD_ROOT = path.resolve(process.cwd(), '.openport-product/data/note-assets')

@Injectable()
export class NotesService {
  private readonly notes = new Map<string, NoteRecord>()
  private readonly collaboration = new Map<string, Map<string, OpenPortNotePresence>>()

  constructor(
    private readonly auth: AuthService,
    private readonly workspaces: WorkspacesService
  ) {}

  list(actor: { userId: string; workspaceId: string }, query?: string, archived?: boolean): OpenPortListResponse<OpenPortNote> {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    const normalizedQuery = query?.trim().toLowerCase() || ''

    const items = [...this.notes.values()]
      .filter((note) => note.workspaceId === actor.workspaceId)
      .filter((note) => this.canReadNote(actor, note))
      .filter((note) => (archived === undefined ? true : note.archived === archived))
      .filter((note) => {
        if (!normalizedQuery) return true
        return `${note.title} ${note.contentMd} ${note.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

    return { items }
  }

  create(actor: { userId: string; workspaceId: string }, dto: CreateNoteDto): OpenPortNoteResponse {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)

    const now = new Date().toISOString()
    const note: NoteRecord = {
      id: `note_${randomUUID()}`,
      workspaceId: actor.workspaceId,
      ownerUserId: actor.userId,
      title: dto.title?.trim() || this.buildDefaultTitle(),
      contentMd: dto.contentMd || '',
      contentHtml: dto.contentHtml || null,
      excerpt: this.toExcerpt(dto.contentMd || ''),
      pinned: false,
      archived: false,
      tags: dto.tags?.filter(Boolean) || [],
      createdAt: now,
      updatedAt: now,
      accessGrants: [
        this.buildGrant({
          noteId: `pending`,
          principalType: 'workspace',
          principalId: actor.workspaceId,
          permission: 'write'
        })
      ],
      versions: [],
      assistantMessages: []
    }

    note.accessGrants = [
      this.buildGrant({
        noteId: note.id,
        principalType: 'workspace',
        principalId: actor.workspaceId,
        permission: 'write'
      })
    ]

    this.notes.set(note.id, note)
    return { note }
  }

  get(actor: { userId: string; workspaceId: string }, noteId: string): OpenPortNoteResponse {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)
    return { note }
  }

  update(actor: { userId: string; workspaceId: string }, noteId: string, dto: UpdateNoteDto): OpenPortNoteResponse {
    const note = this.requireNote(noteId)
    this.ensureWriteAccess(actor, note)

    const titleChanged = dto.title !== undefined && dto.title.trim() !== note.title
    const contentChanged = dto.contentMd !== undefined && dto.contentMd !== note.contentMd

    if (titleChanged || contentChanged) {
      note.versions = [
        {
          id: `notever_${randomUUID()}`,
          noteId: note.id,
          title: note.title,
          contentMd: note.contentMd,
          contentHtml: note.contentHtml,
          savedAt: new Date().toISOString(),
          savedByUserId: actor.userId
        },
        ...note.versions
      ].slice(0, 20)
    }

    if (dto.title !== undefined) note.title = dto.title.trim() || note.title
    if (dto.contentMd !== undefined) note.contentMd = dto.contentMd
    if (dto.contentHtml !== undefined) note.contentHtml = dto.contentHtml
    if (dto.pinned !== undefined) note.pinned = dto.pinned
    if (dto.archived !== undefined) note.archived = dto.archived
    if (dto.tags !== undefined) note.tags = dto.tags.filter(Boolean)
    note.excerpt = this.toExcerpt(note.contentMd)
    note.updatedAt = new Date().toISOString()

    return { note }
  }

  delete(actor: { userId: string; workspaceId: string }, noteId: string): { ok: true } {
    const note = this.requireNote(noteId)
    this.ensureWriteAccess(actor, note)
    this.notes.delete(noteId)
    this.collaboration.delete(noteId)
    return { ok: true }
  }

  duplicate(actor: { userId: string; workspaceId: string }, noteId: string): OpenPortNoteResponse {
    const source = this.requireNote(noteId)
    this.ensureReadAccess(actor, source)
    return this.create(actor, {
      title: `${source.title} Copy`,
      contentMd: source.contentMd,
      contentHtml: source.contentHtml || undefined,
      tags: source.tags
    })
  }

  restoreVersion(actor: { userId: string; workspaceId: string }, noteId: string, dto: RestoreNoteVersionDto): OpenPortNoteResponse {
    const note = this.requireNote(noteId)
    this.ensureWriteAccess(actor, note)
    const version = note.versions.find((item) => item.id === dto.versionId)
    if (!version) {
      throw new NotFoundException('Note version not found')
    }

    note.versions = [
      {
        id: `notever_${randomUUID()}`,
        noteId: note.id,
        title: note.title,
        contentMd: note.contentMd,
        contentHtml: note.contentHtml,
        savedAt: new Date().toISOString(),
        savedByUserId: actor.userId
      },
      ...note.versions
    ].slice(0, 20)
    note.title = version.title
    note.contentMd = version.contentMd
    note.contentHtml = version.contentHtml
    note.excerpt = this.toExcerpt(version.contentMd)
    note.updatedAt = new Date().toISOString()

    return { note }
  }

  listAccessGrants(actor: { userId: string; workspaceId: string }, noteId: string): OpenPortListResponse<OpenPortNoteGrant> {
    const note = this.requireNote(noteId)
    this.ensureAdminAccess(actor, note)
    return { items: note.accessGrants }
  }

  share(actor: { userId: string; workspaceId: string }, noteId: string, dto: ShareNoteDto): OpenPortNoteGrantResponse {
    const note = this.requireNote(noteId)
    this.ensureAdminAccess(actor, note)

    const principalId = dto.principalType === 'workspace'
      ? (dto.principalId?.trim() || actor.workspaceId)
      : dto.principalType === 'public'
        ? '*'
        : (dto.principalId?.trim() || '')

    if (!principalId) {
      throw new ForbiddenException('principalId is required')
    }

    const existing = note.accessGrants.find((grant) => grant.principalType === dto.principalType && grant.principalId === principalId)
    if (existing) {
      existing.permission = dto.permission
      return { grant: existing }
    }

    const grant = this.buildGrant({
      noteId,
      principalType: dto.principalType,
      principalId,
      permission: dto.permission
    })
    note.accessGrants.push(grant)
    return { grant }
  }

  revokeShare(actor: { userId: string; workspaceId: string }, noteId: string, grantId: string): { ok: true } {
    const note = this.requireNote(noteId)
    this.ensureAdminAccess(actor, note)
    note.accessGrants = note.accessGrants.filter((grant) => grant.id !== grantId)
    return { ok: true }
  }

  askAssistant(actor: { userId: string; workspaceId: string }, noteId: string, dto: NoteAssistantDto): OpenPortNoteAssistantResponse {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)

    const prompt = dto.prompt.trim()
    const now = new Date().toISOString()
    const userMessage: OpenPortNoteAssistantMessage = {
      id: `note_msg_${randomUUID()}`,
      role: 'user',
      content: prompt,
      createdAt: now
    }
    const assistantMessage: OpenPortNoteAssistantMessage = {
      id: `note_msg_${randomUUID()}`,
      role: 'assistant',
      content: this.buildAssistantReply(note, prompt),
      createdAt: new Date().toISOString()
    }

    note.assistantMessages = [...note.assistantMessages, userMessage, assistantMessage]
    note.updatedAt = new Date().toISOString()

    return {
      noteId: note.id,
      messages: note.assistantMessages
    }
  }

  getCollaborationState(actor: { userId: string; workspaceId: string }, noteId: string): OpenPortNoteCollaborationState {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)
    const activeUsers = this.getActivePresence(noteId)
    return { noteId, activeUsers }
  }

  heartbeat(
    actor: { userId: string; workspaceId: string },
    noteId: string,
    dto: NoteCollaborationHeartbeatDto
  ): OpenPortNoteCollaborationState {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)
    const user = this.auth.getOrCreateUser(actor.userId)
    const presence = this.collaboration.get(noteId) || new Map<string, OpenPortNotePresence>()

    presence.set(actor.userId, {
      userId: user.id,
      name: user.name,
      email: user.email,
      state: dto.state,
      seenAt: new Date().toISOString()
    })
    this.collaboration.set(noteId, presence)

    return {
      noteId,
      activeUsers: this.getActivePresence(noteId)
    }
  }

  getNoteForRealtime(actor: { userId: string; workspaceId: string }, noteId: string): OpenPortNote {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)
    return note
  }

  canWriteNote(actor: { userId: string; workspaceId: string }, noteId: string): boolean {
    const note = this.requireNote(noteId)
    this.ensureReadAccess(actor, note)
    return this.resolvePermission(actor, note) !== 'read'
  }

  applyCollaborativeContent(
    actor: { userId: string; workspaceId: string },
    noteId: string,
    snapshot: {
      contentMd: string
      contentHtml: string | null
      excerpt?: string
    }
  ): OpenPortNoteResponse {
    const note = this.requireNote(noteId)
    this.ensureWriteAccess(actor, note)
    note.contentMd = snapshot.contentMd
    note.contentHtml = snapshot.contentHtml
    note.excerpt = snapshot.excerpt?.trim() || this.toExcerpt(snapshot.contentMd)
    note.updatedAt = new Date().toISOString()
    return { note }
  }

  uploadAsset(
    actor: { userId: string; workspaceId: string },
    dto: UploadNoteAssetDto
  ): {
    asset: {
      fileName: string
      contentType: string
      proxyPath: string
      apiPath: string
    }
  } {
    if (dto.noteId) {
      const note = this.requireNote(dto.noteId)
      this.ensureWriteAccess(actor, note)
    } else {
      this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    }

    const match = dto.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new ForbiddenException('Invalid image payload')
    }

    const contentType = match[1] || 'application/octet-stream'
    if (!contentType.startsWith('image/')) {
      throw new ForbiddenException('Only image uploads are supported')
    }
    const base64 = match[2] || ''
    const extension = this.resolveUploadExtension(contentType, dto.fileName)
    const fileName = `${dto.noteId || 'note'}_${randomUUID()}.${extension}`
    const buffer = Buffer.from(base64, 'base64')

    if (!existsSync(NOTE_UPLOAD_ROOT)) {
      mkdirSync(NOTE_UPLOAD_ROOT, { recursive: true })
    }

    writeFileSync(path.join(NOTE_UPLOAD_ROOT, fileName), buffer)

    return {
      asset: {
        fileName,
        contentType,
        proxyPath: `/api/openport/notes/uploads/${fileName}`,
        apiPath: `/notes/uploads/${fileName}`
      }
    }
  }

  getUploadedAsset(fileName: string): {
    contentType: string
    buffer: Buffer
  } {
    const safeFileName = path.basename(fileName)
    const assetPath = path.join(NOTE_UPLOAD_ROOT, safeFileName)
    if (!existsSync(assetPath)) {
      throw new NotFoundException('Note asset not found')
    }

    return {
      contentType: this.resolveUploadContentType(safeFileName),
      buffer: readFileSync(assetPath)
    }
  }

  private requireNote(noteId: string): NoteRecord {
    const note = this.notes.get(noteId)
    if (!note) {
      throw new NotFoundException('Note not found')
    }
    return note
  }

  private ensureReadAccess(actor: { userId: string; workspaceId: string }, note: NoteRecord): void {
    this.workspaces.assertWorkspaceAccess(actor.userId, actor.workspaceId)
    if (note.workspaceId !== actor.workspaceId || !this.canReadNote(actor, note)) {
      throw new ForbiddenException('Note not found or access denied')
    }
  }

  private ensureWriteAccess(actor: { userId: string; workspaceId: string }, note: NoteRecord): void {
    this.ensureReadAccess(actor, note)
    if (this.resolvePermission(actor, note) === 'read') {
      throw new ForbiddenException('Write access required')
    }
  }

  private ensureAdminAccess(actor: { userId: string; workspaceId: string }, note: NoteRecord): void {
    this.ensureReadAccess(actor, note)
    if (this.resolvePermission(actor, note) !== 'admin') {
      throw new ForbiddenException('Admin access required')
    }
  }

  private canReadNote(actor: { userId: string; workspaceId: string }, note: NoteRecord): boolean {
    return this.resolvePermission(actor, note) !== null
  }

  private resolvePermission(actor: { userId: string; workspaceId: string }, note: NoteRecord): OpenPortNotePermission | null {
    if (note.ownerUserId === actor.userId) return 'admin'

    const grants = note.accessGrants.filter((grant) => {
      if (grant.principalType === 'public' && grant.principalId === '*') return true
      if (grant.principalType === 'workspace' && grant.principalId === actor.workspaceId) return true
      if (grant.principalType === 'user' && grant.principalId === actor.userId) return true
      return false
    })

    if (grants.some((grant) => grant.permission === 'admin')) return 'admin'
    if (grants.some((grant) => grant.permission === 'write')) return 'write'
    if (grants.some((grant) => grant.permission === 'read')) return 'read'
    return null
  }

  private buildGrant(input: {
    noteId: string
    principalType: OpenPortNotePrincipalType
    principalId: string
    permission: OpenPortNotePermission
  }): OpenPortNoteGrant {
    return {
      id: `notegrant_${randomUUID()}`,
      noteId: input.noteId,
      principalType: input.principalType,
      principalId: input.principalId,
      permission: input.permission,
      createdAt: new Date().toISOString()
    }
  }

  private getActivePresence(noteId: string): OpenPortNotePresence[] {
    const registry = this.collaboration.get(noteId)
    if (!registry) return []

    const now = Date.now()
    const active: OpenPortNotePresence[] = []
    for (const [userId, presence] of registry.entries()) {
      if (now - new Date(presence.seenAt).getTime() > COLLABORATION_TTL_MS) {
        registry.delete(userId)
        continue
      }
      active.push(presence)
    }

    return active.sort((a, b) => a.name.localeCompare(b.name))
  }

  private buildDefaultTitle(): string {
    return `Note ${new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}`
  }

  private resolveUploadExtension(contentType: string, fileName?: string): string {
    const fromFileName = fileName?.trim().split('.').pop()?.toLowerCase()
    if (fromFileName) return fromFileName

    switch (contentType) {
      case 'image/png':
        return 'png'
      case 'image/webp':
        return 'webp'
      case 'image/gif':
        return 'gif'
      case 'image/jpeg':
      default:
        return 'jpg'
    }
  }

  private resolveUploadContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'png':
        return 'image/png'
      case 'webp':
        return 'image/webp'
      case 'gif':
        return 'image/gif'
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg'
    }
  }

  private toExcerpt(contentMd: string): string {
    return contentMd.replace(/\s+/g, ' ').trim().slice(0, 180)
  }

  private buildAssistantReply(note: NoteRecord, prompt: string): string {
    const normalized = prompt.toLowerCase()
    if (!note.contentMd.trim()) {
      return 'This note is still empty. Add content first, then ask for a summary, title, or action list.'
    }

    if (normalized.includes('title')) {
      const suggestion = note.contentMd
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean)
        ?.replace(/^#+\s*/, '')
        .slice(0, 48) || note.title
      return `Suggested title: ${suggestion}`
    }

    if (normalized.includes('task') || normalized.includes('action')) {
      const explicit = note.contentMd
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[-*]\s+/.test(line) || /^\[\s?\]\s+/.test(line))
        .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\[\s?\]\s+/, ''))

      if (explicit.length === 0) {
        return 'I could not find explicit action items yet. Add bullets or clearer next steps to the note.'
      }

      return `Action items:\n${explicit.slice(0, 6).map((item) => `- ${item}`).join('\n')}`
    }

    const summary = note.contentMd
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')

    return `Summary:\n${summary}`
  }
}
