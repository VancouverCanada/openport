import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { AppModule } from './app.module.js'
import { resolveApiRuntimeEnv } from './config/runtime-env.js'

async function bootstrap(): Promise<void> {
  const runtime = resolveApiRuntimeEnv()
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true }
  )

  app.setGlobalPrefix('api')
  app.useWebSocketAdapter(new IoAdapter(app))
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-openport-user', 'x-openport-workspace', 'x-openport-admin-user']
  })
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }))

  await app.listen(runtime.port, runtime.host)
  new Logger('OpenPortApi').log(`Listening on http://${runtime.host}:${runtime.port}/api`)
  new Logger('OpenPortApi').log(`Domain adapter: ${runtime.domainAdapter}`)
  new Logger('OpenPortApi').log(
    `API state backend: ${runtime.apiStateBackend}${runtime.apiStateBackend === 'file' && runtime.apiStateFile ? ` (${runtime.apiStateFile})` : ''}`
  )
}

bootstrap().catch((error) => {
  new Logger('OpenPortApi').error(error)
  process.exit(1)
})
