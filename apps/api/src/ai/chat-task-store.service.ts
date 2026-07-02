import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createClient, type RedisClientType } from 'redis'

type ChatTaskRecord = {
  id: string
  userId: string
  sessionId: string
  createdAt: string
  status: 'running' | 'done' | 'cancelled' | 'error'
}

type ChatTaskEvent = {
  event: string
  data: unknown
}

type ChatTaskCommand = {
  type: 'stop'
  taskId: string
  reason?: string
}

@Injectable()
export class ChatTaskStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatTaskStoreService.name)
  private redis: RedisClientType | null = null
  private subscriber: RedisClientType | null = null
  private readonly fallbackEvents = new Map<string, ChatTaskEvent[]>()
  private readonly fallbackTaskStatus = new Map<string, ChatTaskRecord>()
  private readonly subscriptions = new Map<string, Set<(event: ChatTaskEvent) => void>>()
  private readonly subscribedChannels = new Set<string>()
  private readonly commandChannel = 'openport:chat:task:commands'

  private get redisUrl(): string {
    return process.env.OPENPORT_REDIS_URL?.trim() || process.env.REDIS_URL?.trim() || 'redis://redis:6379'
  }

  private get taskTtlSeconds(): number {
    const raw = Number(process.env.OPENPORT_CHAT_TASK_TTL_SECONDS || 300)
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300
  }

  async onModuleInit(): Promise<void> {
    try {
      this.redis = createClient({ url: this.redisUrl })
      this.redis.on('error', (error) => this.logger.warn(`Redis client error: ${String(error)}`))
      await this.redis.connect()

      this.subscriber = this.redis.duplicate()
      this.subscriber.on('error', (error) => this.logger.warn(`Redis subscriber error: ${String(error)}`))
      await this.subscriber.connect()
      this.logger.log(`Chat task store ready (Redis: ${this.redisUrl})`)
    } catch (error) {
      this.logger.warn(`Redis unavailable, using in-process fallback task events: ${String(error)}`)
      this.redis = null
      this.subscriber = null
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const channel of this.subscribedChannels) {
      try {
        await this.subscriber?.unsubscribe(channel)
      } catch {
        // ignore
      }
    }
    this.subscribedChannels.clear()
    await this.subscriber?.quit().catch(() => undefined)
    await this.redis?.quit().catch(() => undefined)
  }

  private taskKey(taskId: string): string {
    return `openport:chat:task:${taskId}`
  }

  private eventsKey(taskId: string): string {
    return `openport:chat:task:${taskId}:events`
  }

  private channelKey(taskId: string): string {
    return `openport:chat:task:${taskId}:events:channel`
  }

  private userTasksKey(userId: string): string {
    return `openport:chat:tasks:user:${userId}`
  }

  private userChatTasksKey(userId: string, sessionId: string): string {
    return `openport:chat:tasks:user:${userId}:chat:${sessionId}`
  }

  async createTask(record: ChatTaskRecord): Promise<void> {
    this.fallbackTaskStatus.set(record.id, record)
    if (!this.redis) return
    const score = new Date(record.createdAt).getTime()
    const taskKey = this.taskKey(record.id)
    const userTasksKey = this.userTasksKey(record.userId)
    const userChatTasksKey = this.userChatTasksKey(record.userId, record.sessionId)

    await this.redis
      .multi()
      .hSet(taskKey, {
        id: record.id,
        userId: record.userId,
        sessionId: record.sessionId,
        createdAt: record.createdAt,
        status: record.status
      })
      .zAdd(userTasksKey, [{ score, value: record.id }])
      .zAdd(userChatTasksKey, [{ score, value: record.id }])
      .expire(taskKey, this.taskTtlSeconds)
      .exec()
  }

  async updateTaskStatus(taskId: string, status: ChatTaskRecord['status']): Promise<void> {
    const fallback = this.fallbackTaskStatus.get(taskId)
    if (fallback) {
      this.fallbackTaskStatus.set(taskId, { ...fallback, status })
    }
    if (!this.redis) return
    const taskKey = this.taskKey(taskId)
    const record = await this.redis.hGetAll(taskKey)
    if (!record?.id) return

    const userId = record.userId || ''
    const sessionId = record.sessionId || ''
    const pipeline = this.redis.multi().hSet(taskKey, { status }).expire(taskKey, this.taskTtlSeconds)

    if (status !== 'running' && userId && sessionId) {
      pipeline.zRem(this.userTasksKey(userId), taskId).zRem(this.userChatTasksKey(userId, sessionId), taskId)
    }

    await pipeline.exec()
  }

  async appendEvent(taskId: string, event: ChatTaskEvent): Promise<void> {
    const fallback = this.fallbackEvents.get(taskId) || []
    fallback.push(event)
    if (fallback.length > 256) fallback.splice(0, fallback.length - 256)
    this.fallbackEvents.set(taskId, fallback)

    if (!this.redis) {
      const listeners = this.subscriptions.get(taskId)
      listeners?.forEach((listener) => {
        try {
          listener(event)
        } catch {
          // ignore listener failures
        }
      })
      return
    }
    const serialized = JSON.stringify(event)
    await this.redis
      .multi()
      .rPush(this.eventsKey(taskId), serialized)
      .lTrim(this.eventsKey(taskId), -256, -1)
      .expire(this.eventsKey(taskId), this.taskTtlSeconds)
      .publish(this.channelKey(taskId), serialized)
      .exec()
  }

  async getSnapshot(
    userId: string,
    taskId: string
  ): Promise<{ events: ChatTaskEvent[]; done: boolean } | null> {
    const fallbackEvents = this.fallbackEvents.get(taskId)
    const fallbackTask = this.fallbackTaskStatus.get(taskId)
    if (!this.redis) {
      if (!fallbackTask || fallbackTask.userId !== userId) return null
      return {
        events: fallbackEvents ? [...fallbackEvents] : [],
        done: fallbackTask.status !== 'running'
      }
    }

    const task = await this.redis.hGetAll(this.taskKey(taskId))
    if (!task?.id || task.userId !== userId) return null

    const rawEvents = await this.redis.lRange(this.eventsKey(taskId), 0, -1)
    const events = rawEvents
      .map((line) => {
        try {
          return JSON.parse(line) as ChatTaskEvent
        } catch {
          return null
        }
      })
      .filter((entry): entry is ChatTaskEvent => Boolean(entry))

    return {
      events,
      done: task.status !== 'running'
    }
  }

  async listRunningTasks(
    userId: string,
    sessionId?: string
  ): Promise<Array<{ id: string; sessionId: string; createdAt: string; status: 'running' }>> {
    if (!this.redis) {
      return Array.from(this.fallbackTaskStatus.values())
        .filter((task) => task.userId === userId && task.status === 'running')
        .filter((task) => (sessionId ? task.sessionId === sessionId : true))
        .map((task) => ({
          id: task.id,
          sessionId: task.sessionId,
          createdAt: task.createdAt,
          status: 'running' as const
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }

    const ids = sessionId
      ? await this.redis.zRange(this.userChatTasksKey(userId, sessionId), 0, -1)
      : await this.redis.zRange(this.userTasksKey(userId), 0, -1)

    const tasks: Array<{ id: string; sessionId: string; createdAt: string; status: 'running' }> = []
    for (const id of ids) {
      const task = await this.redis.hGetAll(this.taskKey(id))
      if (!task?.id || task.userId !== userId || task.status !== 'running') continue
      tasks.push({
        id: task.id,
        sessionId: task.sessionId,
        createdAt: task.createdAt,
        status: 'running'
      })
    }

    return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async subscribe(
    userId: string,
    taskId: string,
    listener: (event: ChatTaskEvent) => void
  ): Promise<{ unsubscribe: () => void } | null> {
    const snapshot = await this.getSnapshot(userId, taskId)
    if (!snapshot) return null

    if (!this.subscriptions.has(taskId)) {
      this.subscriptions.set(taskId, new Set())
    }
    this.subscriptions.get(taskId)!.add(listener)

    const channel = this.channelKey(taskId)
    if (this.subscriber && !this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel)
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const event = JSON.parse(message) as ChatTaskEvent
          const localListeners = this.subscriptions.get(taskId)
          localListeners?.forEach((fn) => {
            try {
              fn(event)
            } catch {
              // ignore
            }
          })
        } catch {
          // ignore malformed pubsub payload
        }
      })
    }

    return {
      unsubscribe: () => {
        const listeners = this.subscriptions.get(taskId)
        if (!listeners) return
        listeners.delete(listener)
      }
    }
  }

  async publishStopCommand(taskId: string, reason?: string): Promise<void> {
    const command: ChatTaskCommand = { type: 'stop', taskId, reason }
    if (!this.redis) return
    await this.redis.publish(this.commandChannel, JSON.stringify(command))
  }

  async subscribeStopCommands(handler: (taskId: string, reason?: string) => void): Promise<() => void> {
    if (!this.subscriber) return () => {}
    if (!this.subscribedChannels.has(this.commandChannel)) {
      this.subscribedChannels.add(this.commandChannel)
      await this.subscriber.subscribe(this.commandChannel, (message) => {
        try {
          const command = JSON.parse(message) as ChatTaskCommand
          if (command?.type === 'stop' && typeof command.taskId === 'string') {
            handler(command.taskId, command.reason)
          }
        } catch {
          // ignore malformed commands
        }
      })
    }
    return async () => {
      // keep shared command subscription active for process lifetime
      return
    }
  }
}
