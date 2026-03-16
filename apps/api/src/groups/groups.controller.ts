import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { CreateGroupDto } from './dto/create-group.dto.js'
import { UpdateGroupDto } from './dto/update-group.dto.js'
import { GroupsService } from './groups.service.js'

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    return this.groups.list(resolveActor(req.headers))
  }

  @Get(':id')
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.groups.get(resolveActor(req.headers), id)
  }

  @Post()
  create(@Req() req: FastifyRequest, @Body() dto: CreateGroupDto): Promise<Record<string, unknown>> {
    return this.groups.create(resolveActor(req.headers), dto)
  }

  @Patch(':id')
  update(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto
  ): Promise<Record<string, unknown>> {
    return this.groups.update(resolveActor(req.headers), id, dto)
  }

  @Delete(':id')
  remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.groups.remove(resolveActor(req.headers), id)
  }
}
