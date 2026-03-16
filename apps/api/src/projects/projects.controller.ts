import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, Sse } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { FastifyReply } from 'fastify'
import type { Observable } from 'rxjs'
import { resolveActor } from '../common/request-context.js'
import { AuthService } from '../auth/auth.service.js'
import { CreateProjectDto } from './dto/create-project.dto.js'
import { CreateProjectKnowledgeTextDto } from './dto/create-project-knowledge-text.dto.js'
import { CreateProjectKnowledgeWebDto } from './dto/create-project-knowledge-web.dto.js'
import { ImportProjectDto } from './dto/import-project.dto.js'
import { MaintainProjectKnowledgeBatchDto } from './dto/maintain-project-knowledge-batch.dto.js'
import { MaintainProjectKnowledgeSourceDto } from './dto/maintain-project-knowledge-source.dto.js'
import { RebuildProjectKnowledgeBatchDto } from './dto/rebuild-project-knowledge-batch.dto.js'
import { RebuildProjectKnowledgeDto } from './dto/rebuild-project-knowledge.dto.js'
import { AppendProjectKnowledgeContentDto } from './dto/append-project-knowledge-content.dto.js'
import { UpdateProjectKnowledgeContentDto } from './dto/update-project-knowledge-content.dto.js'
import { CreateKnowledgeCollectionDto } from './dto/create-knowledge-collection.dto.js'
import { MoveProjectDto } from './dto/move-project.dto.js'
import { ProjectCollaborationHeartbeatDto } from './dto/project-collaboration-heartbeat.dto.js'
import { ShareProjectDto } from './dto/share-project.dto.js'
import { DeleteKnowledgeCollectionDto } from './dto/delete-knowledge-collection.dto.js'
import { UpdateProjectDto } from './dto/update-project.dto.js'
import { UpdateKnowledgeCollectionDto } from './dto/update-knowledge-collection.dto.js'
import { UpdateKnowledgeItemCollectionDto } from './dto/update-knowledge-item-collection.dto.js'
import { ReplaceProjectKnowledgeSourceDto } from './dto/replace-project-knowledge-source.dto.js'
import { UploadProjectAssetDto } from './dto/upload-project-asset.dto.js'
import { UploadProjectKnowledgeDto } from './dto/upload-project-knowledge.dto.js'
import { ProjectsService } from './projects.service.js'

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly auth: AuthService,
    private readonly projects: ProjectsService
  ) {}

  @Get()
  list(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.list(actor)
  }

  @Get('knowledge')
  listKnowledge(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledge(actor)
  }

  @Get('knowledge/collections')
  listKnowledgeCollections(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledgeCollections(actor)
  }

  @Post('knowledge/collections')
  createKnowledgeCollection(@Req() req: FastifyRequest, @Body() dto: CreateKnowledgeCollectionDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.createKnowledgeCollection(actor, dto)
  }

  @Patch('knowledge/collections/:collectionId')
  updateKnowledgeCollection(
    @Req() req: FastifyRequest,
    @Param('collectionId') collectionId: string,
    @Body() dto: UpdateKnowledgeCollectionDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.updateKnowledgeCollection(actor, collectionId, dto)
  }

  @Delete('knowledge/collections/:collectionId')
  deleteKnowledgeCollection(
    @Req() req: FastifyRequest,
    @Param('collectionId') collectionId: string,
    @Body() dto: DeleteKnowledgeCollectionDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.deleteKnowledgeCollection(actor, collectionId, dto)
  }

  @Get('knowledge/collections/:collectionId/access-grants')
  listKnowledgeCollectionAccessGrants(
    @Req() req: FastifyRequest,
    @Param('collectionId') collectionId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledgeCollectionAccessGrants(actor, collectionId)
  }

  @Post('knowledge/collections/:collectionId/access-grants')
  shareKnowledgeCollection(
    @Req() req: FastifyRequest,
    @Param('collectionId') collectionId: string,
    @Body() dto: ShareProjectDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.shareKnowledgeCollection(actor, collectionId, dto)
  }

  @Delete('knowledge/collections/:collectionId/access-grants/:grantId')
  revokeKnowledgeCollectionShare(
    @Req() req: FastifyRequest,
    @Param('collectionId') collectionId: string,
    @Param('grantId') grantId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.revokeKnowledgeCollectionShare(actor, collectionId, grantId)
  }

  @Get('knowledge/sources/:sourceId/access-grants')
  listKnowledgeSourceAccessGrants(
    @Req() req: FastifyRequest,
    @Param('sourceId') sourceId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledgeSourceAccessGrants(actor, sourceId)
  }

  @Post('knowledge/sources/:sourceId/access-grants')
  shareKnowledgeSource(
    @Req() req: FastifyRequest,
    @Param('sourceId') sourceId: string,
    @Body() dto: ShareProjectDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.shareKnowledgeSource(actor, sourceId, dto)
  }

  @Delete('knowledge/sources/:sourceId/access-grants/:grantId')
  revokeKnowledgeSourceShare(
    @Req() req: FastifyRequest,
    @Param('sourceId') sourceId: string,
    @Param('grantId') grantId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.revokeKnowledgeSourceShare(actor, sourceId, grantId)
  }

  @Get('knowledge/chunks/:chunkId/access-grants')
  listKnowledgeChunkAccessGrants(
    @Req() req: FastifyRequest,
    @Param('chunkId') chunkId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledgeChunkAccessGrants(actor, chunkId)
  }

  @Post('knowledge/chunks/:chunkId/access-grants')
  shareKnowledgeChunk(
    @Req() req: FastifyRequest,
    @Param('chunkId') chunkId: string,
    @Body() dto: ShareProjectDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.shareKnowledgeChunk(actor, chunkId, dto)
  }

  @Delete('knowledge/chunks/:chunkId/access-grants/:grantId')
  revokeKnowledgeChunkShare(
    @Req() req: FastifyRequest,
    @Param('chunkId') chunkId: string,
    @Param('grantId') grantId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.revokeKnowledgeChunkShare(actor, chunkId, grantId)
  }

  @Get('knowledge/:itemId')
  getKnowledge(@Req() req: FastifyRequest, @Param('itemId') itemId: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.getKnowledge(actor, itemId)
  }

  @Get('knowledge/:itemId/access-grants')
  listKnowledgeAccessGrants(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listKnowledgeItemAccessGrants(actor, itemId)
  }

  @Post('knowledge/:itemId/access-grants')
  shareKnowledge(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: ShareProjectDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.shareKnowledgeItem(actor, itemId, dto)
  }

  @Delete('knowledge/:itemId/access-grants/:grantId')
  revokeKnowledgeShare(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Param('grantId') grantId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.revokeKnowledgeItemShare(actor, itemId, grantId)
  }

  @Delete('knowledge/:itemId')
  deleteKnowledge(@Req() req: FastifyRequest, @Param('itemId') itemId: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.deleteKnowledge(actor, itemId)
  }

  @Patch('knowledge/:itemId/collection')
  updateKnowledgeItemCollection(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateKnowledgeItemCollectionDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.updateKnowledgeItemCollection(actor, itemId, dto)
  }

  @Post('assets/upload')
  uploadAsset(@Req() req: FastifyRequest, @Body() dto: UploadProjectAssetDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.uploadAsset(actor, dto)
  }

  @Get('assets')
  listAssets(
    @Req() req: FastifyRequest,
    @Query('kind') kind?: 'background' | 'knowledge' | 'chat' | 'webpage',
    @Query('scope') scope?: 'workspace' | 'user'
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listAssets(actor, { kind, scope })
  }

  @Delete('assets/:assetId')
  deleteAsset(@Req() req: FastifyRequest, @Param('assetId') assetId: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.deleteAsset(actor, assetId)
  }

  @Post('assets/web')
  createWebAsset(@Req() req: FastifyRequest, @Body() dto: CreateProjectKnowledgeWebDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.createWebAsset(actor, dto)
  }

  @Post('knowledge/upload')
  uploadKnowledge(@Req() req: FastifyRequest, @Body() dto: UploadProjectKnowledgeDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.uploadKnowledge(actor, dto)
  }

  @Post('knowledge/text')
  createKnowledgeText(@Req() req: FastifyRequest, @Body() dto: CreateProjectKnowledgeTextDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.createKnowledgeText(actor, dto)
  }

  @Post('knowledge/web')
  createKnowledgeWeb(@Req() req: FastifyRequest, @Body() dto: CreateProjectKnowledgeWebDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.createKnowledgeWeb(actor, dto)
  }

  @Post('knowledge/:itemId/append')
  appendKnowledgeContent(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: AppendProjectKnowledgeContentDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.appendKnowledgeContent(actor, itemId, dto.contentText)
  }

  @Patch('knowledge/:itemId/content')
  updateKnowledgeContent(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProjectKnowledgeContentDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.updateKnowledgeContent(actor, itemId, dto.contentText)
  }

  @Post('knowledge/:itemId/reindex')
  reindexKnowledge(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.reindexKnowledgeItem(actor, itemId)
  }

  @Post('knowledge/:itemId/reset')
  resetKnowledge(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.resetKnowledgeItem(actor, itemId)
  }

  @Post('knowledge/:itemId/rebuild')
  rebuildKnowledge(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: RebuildProjectKnowledgeDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.rebuildKnowledgeItem(actor, itemId, dto)
  }

  @Post('knowledge/batch/rebuild')
  rebuildKnowledgeBatch(
    @Req() req: FastifyRequest,
    @Body() dto: RebuildProjectKnowledgeBatchDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.rebuildKnowledgeBatch(actor, dto)
  }

  @Post('knowledge/batch/maintain')
  maintainKnowledgeBatch(
    @Req() req: FastifyRequest,
    @Body() dto: MaintainProjectKnowledgeBatchDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.maintainKnowledgeBatch(actor, dto)
  }

  @Delete('knowledge/:itemId/sources/:sourceId')
  removeKnowledgeSource(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Param('sourceId') sourceId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.removeKnowledgeSource(actor, itemId, sourceId)
  }

  @Post('knowledge/sources/:sourceId/batch')
  maintainKnowledgeSourceBatch(
    @Req() req: FastifyRequest,
    @Param('sourceId') sourceId: string,
    @Body() dto: MaintainProjectKnowledgeSourceDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.maintainKnowledgeSourceBatch(actor, sourceId, dto)
  }

  @Patch('knowledge/:itemId/sources/:sourceId')
  replaceKnowledgeSource(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Param('sourceId') sourceId: string,
    @Body() dto: ReplaceProjectKnowledgeSourceDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.replaceKnowledgeSource(actor, itemId, sourceId, dto.contentText, dto.label)
  }

  @Get('knowledge/:itemId/chunks/search')
  searchKnowledgeChunks(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.searchKnowledgeChunks(actor, itemId, q || '', limit ? Number(limit) : 12)
  }

  @Get('knowledge/chunks/stats')
  knowledgeChunkStats(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.getKnowledgeChunkStats(actor)
  }

  @Get('assets/:assetId/content')
  async assetContent(@Param('assetId') assetId: string, @Res() reply: FastifyReply): Promise<void> {
    const { asset, buffer } = await this.projects.readAssetContent(assetId)
    reply.header('Content-Type', asset.type)
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    reply.send(buffer)
  }

  @Sse('events/stream')
  streamEvents(
    @Query('workspaceId') workspaceId?: string,
    @Query('userId') userId?: string,
    @Query('accessToken') accessToken?: string
  ): Observable<{ data: Record<string, unknown> }> {
    const user = this.auth.resolveUserByAccessToken(accessToken) || this.auth.getOrCreateUser(userId?.trim() || 'user_demo')
    return this.projects.streamEvents({
      userId: user.id,
      workspaceId: workspaceId?.trim() || user.defaultWorkspaceId
    }) as Observable<{ data: Record<string, unknown> }>
  }

  @Post('import')
  importBundle(@Req() req: FastifyRequest, @Body() dto: ImportProjectDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.import(actor, dto)
  }

  @Post()
  create(@Req() req: FastifyRequest, @Body() dto: CreateProjectDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.create(actor, dto as never)
  }

  @Get(':id/export')
  export(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.export(actor, id)
  }

  @Get(':id')
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.get(actor, id)
  }

  @Get(':id/access-grants')
  listAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.listAccessGrants(actor, id)
  }

  @Post(':id/access-grants')
  share(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: ShareProjectDto
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.share(actor, id, dto)
  }

  @Delete(':id/access-grants/:grantId')
  revokeShare(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Param('grantId') grantId: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.revokeShare(actor, id, grantId)
  }

  @Get(':id/collaboration')
  getCollaboration(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.projects.getCollaborationState(actor, id)
  }

  @Post(':id/collaboration/heartbeat')
  heartbeatCollaboration(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: ProjectCollaborationHeartbeatDto
  ): Record<string, unknown> {
    const actor = this.projects.getCollaborationActor(resolveActor(req.headers))
    return this.projects.heartbeatCollaboration(actor, id, dto.state)
  }

  @Get(':id/knowledge/search')
  searchKnowledge(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.searchKnowledge(actor, id, q || '', limit ? Number(limit) : 5)
  }

  @Patch(':id')
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateProjectDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.update(actor, id, dto as never)
  }

  @Post(':id/move')
  move(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: MoveProjectDto): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.move(actor, id, dto.parentId ?? null)
  }

  @Delete(':id')
  remove(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Query('deleteContents') deleteContents?: string
  ): Promise<Record<string, unknown>> {
    const actor = resolveActor(req.headers)
    return this.projects.delete(actor, id, deleteContents === 'true')
  }
}
