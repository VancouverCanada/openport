import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { AddMemberDto } from './dto/add-member.dto.js'
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js'
import { InviteMemberDto } from './dto/invite-member.dto.js'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js'
import { UpdateWorkspaceCapabilityPolicyDto } from './dto/update-workspace-capability-policy.dto.js'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js'
import { WorkspacesService } from './workspaces.service.js'

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Req() req: FastifyRequest): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.listForUser(actor.userId)
  }

  @Post()
  create(@Req() req: FastifyRequest, @Body() dto: CreateWorkspaceDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.create(actor.userId, dto)
  }

  @Patch(':id')
  update(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto
  ): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.update(actor.userId, id, dto)
  }

  @Delete(':id')
  remove(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.remove(actor.userId, id)
  }

  @Get(':id/members')
  members(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.listMembers(actor.userId, id)
  }

  @Post(':id/members')
  addMember(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: AddMemberDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.addMember(actor.userId, id, dto)
  }

  @Get(':id/invites')
  invites(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.listInvites(actor.userId, id)
  }

  @Post(':id/invites')
  invite(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: InviteMemberDto): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.inviteMember(actor.userId, id, dto)
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto
  ): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.updateMemberRole(actor.userId, id, memberId, dto.role)
  }

  @Get(':id/capability-policy')
  capabilityPolicy(@Req() req: FastifyRequest, @Param('id') id: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.getCapabilityPolicy(actor.userId, id)
  }

  @Patch(':id/capability-policy')
  updateCapabilityPolicy(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceCapabilityPolicyDto
  ): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.workspaces.updateCapabilityPolicy(actor.userId, id, {
      change: dto.change,
      changes: dto.changes
    })
  }
}
