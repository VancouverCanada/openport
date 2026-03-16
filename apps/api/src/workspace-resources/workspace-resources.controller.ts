import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { WorkspaceResourcesService } from './workspace-resources.service.js'
import { CreateWorkspaceModelDto } from './dto/create-workspace-model.dto.js'
import { UpdateWorkspaceModelDto } from './dto/update-workspace-model.dto.js'
import { CreateWorkspacePromptDto } from './dto/create-workspace-prompt.dto.js'
import { UpdateWorkspacePromptDto } from './dto/update-workspace-prompt.dto.js'
import { PublishWorkspacePromptDto } from './dto/publish-workspace-prompt.dto.js'
import { SubmitWorkspacePromptCommunityDto } from './dto/submit-workspace-prompt-community.dto.js'
import { CreateWorkspaceToolDto } from './dto/create-workspace-tool.dto.js'
import { UpdateWorkspaceToolDto } from './dto/update-workspace-tool.dto.js'
import { ValidateWorkspaceToolDto } from './dto/validate-workspace-tool.dto.js'
import { ImportWorkspaceToolPackageDto } from './dto/import-workspace-tool-package.dto.js'
import { CreateWorkspaceSkillDto } from './dto/create-workspace-skill.dto.js'
import { UpdateWorkspaceSkillDto } from './dto/update-workspace-skill.dto.js'
import { ShareWorkspaceResourceDto } from './dto/share-workspace-resource.dto.js'

@Controller('workspace')
export class WorkspaceResourcesController {
  constructor(private readonly resources: WorkspaceResourcesService) {}

  @Get('models')
  listModels(@Req() req: FastifyRequest) {
    return this.resources.listModels(resolveActor(req.headers))
  }

  @Post('models')
  createModel(@Req() req: FastifyRequest, @Body() dto: CreateWorkspaceModelDto) {
    return this.resources.createModel(resolveActor(req.headers), dto)
  }

  @Get('models/:id')
  getModel(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.getModel(resolveActor(req.headers), id)
  }

  @Patch('models/:id')
  updateModel(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateWorkspaceModelDto) {
    return this.resources.updateModel(resolveActor(req.headers), id, dto)
  }

  @Delete('models/:id')
  deleteModel(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.deleteModel(resolveActor(req.headers), id)
  }

  @Get('models/:id/access-grants')
  listModelAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.listModelAccessGrants(resolveActor(req.headers), id)
  }

  @Post('models/:id/access-grants')
  shareModel(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: ShareWorkspaceResourceDto) {
    return this.resources.shareModel(resolveActor(req.headers), id, dto)
  }

  @Delete('models/:id/access-grants/:grantId')
  revokeModelShare(@Req() req: FastifyRequest, @Param('id') id: string, @Param('grantId') grantId: string) {
    return this.resources.revokeModelShare(resolveActor(req.headers), id, grantId)
  }

  @Get('prompts')
  listPrompts(@Req() req: FastifyRequest) {
    return this.resources.listPrompts(resolveActor(req.headers))
  }

  @Post('prompts')
  createPrompt(@Req() req: FastifyRequest, @Body() dto: CreateWorkspacePromptDto) {
    return this.resources.createPrompt(resolveActor(req.headers), dto)
  }

  @Get('prompts/:id')
  getPrompt(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.getPrompt(resolveActor(req.headers), id)
  }

  @Patch('prompts/:id')
  updatePrompt(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateWorkspacePromptDto) {
    return this.resources.updatePrompt(resolveActor(req.headers), id, dto)
  }

  @Get('prompts/:id/versions')
  listPromptVersions(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.listPromptVersions(resolveActor(req.headers), id)
  }

  @Post('prompts/:id/versions/:versionId/restore')
  restorePromptVersion(@Req() req: FastifyRequest, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.resources.restorePromptVersion(resolveActor(req.headers), id, versionId)
  }

  @Post('prompts/:id/versions/:versionId/production')
  setPromptProductionVersion(@Req() req: FastifyRequest, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.resources.setPromptProductionVersion(resolveActor(req.headers), id, versionId)
  }

  @Post('prompts/:id/publish')
  publishPrompt(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: PublishWorkspacePromptDto) {
    return this.resources.publishPrompt(resolveActor(req.headers), id, dto.versionId)
  }

  @Post('prompts/:id/unpublish')
  unpublishPrompt(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.unpublishPrompt(resolveActor(req.headers), id)
  }

  @Post('prompts/:id/community/submit')
  submitPromptToCommunity(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: SubmitWorkspacePromptCommunityDto
  ) {
    return this.resources.submitPromptToCommunity(resolveActor(req.headers), id, dto)
  }

  @Post('prompts/:id/community/retract')
  retractPromptFromCommunity(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.retractPromptFromCommunity(resolveActor(req.headers), id)
  }

  @Delete('prompts/:id/versions/:versionId')
  deletePromptVersion(@Req() req: FastifyRequest, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.resources.deletePromptVersion(resolveActor(req.headers), id, versionId)
  }

  @Delete('prompts/:id')
  deletePrompt(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.deletePrompt(resolveActor(req.headers), id)
  }

  @Get('prompts/:id/access-grants')
  listPromptAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.listPromptAccessGrants(resolveActor(req.headers), id)
  }

  @Post('prompts/:id/access-grants')
  sharePrompt(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: ShareWorkspaceResourceDto) {
    return this.resources.sharePrompt(resolveActor(req.headers), id, dto)
  }

  @Delete('prompts/:id/access-grants/:grantId')
  revokePromptShare(@Req() req: FastifyRequest, @Param('id') id: string, @Param('grantId') grantId: string) {
    return this.resources.revokePromptShare(resolveActor(req.headers), id, grantId)
  }

  @Get('tools')
  listTools(@Req() req: FastifyRequest) {
    return this.resources.listTools(resolveActor(req.headers))
  }

  @Post('tools')
  createTool(@Req() req: FastifyRequest, @Body() dto: CreateWorkspaceToolDto) {
    return this.resources.createTool(resolveActor(req.headers), dto)
  }

  @Post('tools/validate')
  validateTool(@Req() req: FastifyRequest, @Body() dto: ValidateWorkspaceToolDto) {
    return this.resources.validateTool(resolveActor(req.headers), dto)
  }

  @Post('tools/package/import')
  importToolPackage(@Req() req: FastifyRequest, @Body() dto: ImportWorkspaceToolPackageDto) {
    return this.resources.importToolPackage(resolveActor(req.headers), dto)
  }

  @Get('tools/:id')
  getTool(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.getTool(resolveActor(req.headers), id)
  }

  @Get('tools/:id/package')
  exportToolPackage(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.exportToolPackage(resolveActor(req.headers), id)
  }

  @Patch('tools/:id')
  updateTool(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateWorkspaceToolDto) {
    return this.resources.updateTool(resolveActor(req.headers), id, dto)
  }

  @Delete('tools/:id')
  deleteTool(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.deleteTool(resolveActor(req.headers), id)
  }

  @Get('tools/:id/access-grants')
  listToolAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.listToolAccessGrants(resolveActor(req.headers), id)
  }

  @Post('tools/:id/access-grants')
  shareTool(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: ShareWorkspaceResourceDto) {
    return this.resources.shareTool(resolveActor(req.headers), id, dto)
  }

  @Delete('tools/:id/access-grants/:grantId')
  revokeToolShare(@Req() req: FastifyRequest, @Param('id') id: string, @Param('grantId') grantId: string) {
    return this.resources.revokeToolShare(resolveActor(req.headers), id, grantId)
  }

  @Get('skills')
  listSkills(@Req() req: FastifyRequest) {
    return this.resources.listSkills(resolveActor(req.headers))
  }

  @Post('skills')
  createSkill(@Req() req: FastifyRequest, @Body() dto: CreateWorkspaceSkillDto) {
    return this.resources.createSkill(resolveActor(req.headers), dto)
  }

  @Get('skills/:id')
  getSkill(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.getSkill(resolveActor(req.headers), id)
  }

  @Patch('skills/:id')
  updateSkill(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateWorkspaceSkillDto) {
    return this.resources.updateSkill(resolveActor(req.headers), id, dto)
  }

  @Delete('skills/:id')
  deleteSkill(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.deleteSkill(resolveActor(req.headers), id)
  }

  @Get('skills/:id/access-grants')
  listSkillAccessGrants(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.resources.listSkillAccessGrants(resolveActor(req.headers), id)
  }

  @Post('skills/:id/access-grants')
  shareSkill(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: ShareWorkspaceResourceDto) {
    return this.resources.shareSkill(resolveActor(req.headers), id, dto)
  }

  @Delete('skills/:id/access-grants/:grantId')
  revokeSkillShare(@Req() req: FastifyRequest, @Param('id') id: string, @Param('grantId') grantId: string) {
    return this.resources.revokeSkillShare(resolveActor(req.headers), id, grantId)
  }
}
