import { Controller, Get, Query, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { RbacService } from './rbac.service.js'

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('role-templates')
  templates(@Query('scope') scope = 'workspace'): Record<string, unknown> {
    return this.rbac.listTemplates(scope)
  }

  @Get('me')
  me(@Req() req: FastifyRequest, @Query('workspaceId') workspaceId?: string): Record<string, unknown> {
    const actor = resolveActor(req.headers)
    return this.rbac.getAssignments(actor.userId, workspaceId || actor.workspaceId)
  }
}
