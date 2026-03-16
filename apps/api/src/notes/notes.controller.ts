import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { NoteAssistantDto } from './dto/note-assistant.dto.js'
import { NoteCollaborationHeartbeatDto } from './dto/note-collaboration-heartbeat.dto.js'
import { CreateNoteDto } from './dto/create-note.dto.js'
import { RestoreNoteVersionDto } from './dto/restore-note-version.dto.js'
import { ShareNoteDto } from './dto/share-note.dto.js'
import { UploadNoteAssetDto } from './dto/upload-note-asset.dto.js'
import { UpdateNoteDto } from './dto/update-note.dto.js'
import { NotesService } from './notes.service.js'

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Req() req: FastifyRequest, @Query('query') query?: string, @Query('archived') archived?: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    const archivedValue = archived === undefined ? undefined : archived === 'true'
    return this.notes.list(actor, query, archivedValue)
  }

  @Post()
  create(@Req() req: FastifyRequest, @Body() dto: CreateNoteDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.create(actor, dto)
  }

  @Post('uploads')
  uploadAsset(@Req() req: FastifyRequest, @Body() dto: UploadNoteAssetDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.uploadAsset(actor, dto)
  }

  @Get('uploads/:fileName')
  getUploadedAsset(@Param('fileName') fileName: string, @Res() reply: FastifyReply): FastifyReply {
    const asset = this.notes.getUploadedAsset(fileName)
    return reply
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .type(asset.contentType)
      .send(asset.buffer)
  }

  @Get(':id')
  get(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.get(actor, id)
  }

  @Patch(':id')
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateNoteDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.update(actor, id, dto)
  }

  @Delete(':id')
  remove(@Req() req: FastifyRequest, @Param('id') id: string): { ok: true } {
    const actor = resolveActor(req.headers)
    return this.notes.delete(actor, id)
  }

  @Post(':id/duplicate')
  duplicate(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.duplicate(actor, id)
  }

  @Post(':id/restore-version')
  restoreVersion(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: RestoreNoteVersionDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.restoreVersion(actor, id, dto)
  }

  @Get(':id/access-grants')
  listAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.listAccessGrants(actor, id)
  }

  @Post(':id/access-grants')
  share(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: ShareNoteDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.share(actor, id, dto)
  }

  @Delete(':id/access-grants/:grantId')
  revokeShare(@Req() req: FastifyRequest, @Param('id') id: string, @Param('grantId') grantId: string): { ok: true } {
    const actor = resolveActor(req.headers)
    return this.notes.revokeShare(actor, id, grantId)
  }

  @Post(':id/assistant')
  assistant(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: NoteAssistantDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.askAssistant(actor, id, dto)
  }

  @Get(':id/collaboration')
  collaboration(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.getCollaborationState(actor, id)
  }

  @Post(':id/collaboration/heartbeat')
  collaborationHeartbeat(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: NoteCollaborationHeartbeatDto
  ): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.notes.heartbeat(actor, id, dto)
  }
}
