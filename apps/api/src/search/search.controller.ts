import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { resolveActor } from '../common/request-context.js'
import { SearchHistoryTrackDto } from './dto/search-history-track.dto.js'
import { SearchQueryDto } from './dto/search-query.dto.js'
import { SearchService } from './search.service.js'

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@Req() req: FastifyRequest, @Query() query: SearchQueryDto): Promise<unknown> {
    const actor = resolveActor(req.headers)
    return this.search.search(actor, query)
  }

  @Get('context')
  context(@Req() req: FastifyRequest): Promise<unknown> {
    const actor = resolveActor(req.headers)
    return this.search.getContext(actor)
  }

  @Post('history')
  trackHistory(@Req() req: FastifyRequest, @Body() body: SearchHistoryTrackDto): Promise<unknown> {
    const actor = resolveActor(req.headers)
    return this.search.trackHistory(actor, body)
  }

  @Delete('history/:id')
  removeHistory(@Req() req: FastifyRequest, @Param('id') id: string): Promise<unknown> {
    const actor = resolveActor(req.headers)
    return this.search.removeHistory(actor, id)
  }
}
