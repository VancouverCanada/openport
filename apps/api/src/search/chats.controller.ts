import { Controller, Get, Query, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { OpenPortSearchResponse } from '@openport/product-contracts'
import { resolveActor } from '../common/request-context.js'
import { ChatsQueryDto } from './dto/chats-query.dto.js'
import { SearchService } from './search.service.js'

@Controller('chats')
export class ChatsController {
  constructor(private readonly search: SearchService) {}

  @Get()
  list(@Req() req: FastifyRequest, @Query() query: ChatsQueryDto): Promise<OpenPortSearchResponse> {
    return this.runChatSearch(req, query.text, query.page)
  }

  @Get('search')
  searchChats(@Req() req: FastifyRequest, @Query() query: ChatsQueryDto): Promise<OpenPortSearchResponse> {
    return this.runChatSearch(req, query.text, query.page)
  }

  private runChatSearch(req: FastifyRequest, text: string | undefined, page: number | undefined): Promise<OpenPortSearchResponse> {
    const actor = resolveActor(req.headers)
    const pageNumber = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1
    const limit = 20
    const offset = (pageNumber - 1) * limit

    return this.search.search(actor, {
      q: text?.trim() || '',
      type: 'chat',
      limit,
      cursor: offset > 0 ? String(offset) : undefined
    })
  }
}
