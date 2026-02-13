import { buildDemoApp } from './app.js'

const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '127.0.0.1'

async function main(): Promise<void> {
  const domainAdapter = process.env.OPENPORT_DOMAIN_ADAPTER === 'postgres' ? 'postgres' : 'memory'
  const { app, bootstrap } = await buildDemoApp({
    domainAdapter,
    postgresConnectionString: process.env.OPENPORT_DATABASE_URL
  })

  await app.listen({ host: HOST, port: PORT })

  // eslint-disable-next-line no-console
  console.log('[openport] reference server started')
  // eslint-disable-next-line no-console
  console.log(`[openport] listening on http://${HOST}:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`[openport] domain adapter: ${domainAdapter}`)
  // eslint-disable-next-line no-console
  console.log('[openport] admin header: x-admin-user: admin_demo')
  // eslint-disable-next-line no-console
  console.log('[openport] bootstrap credentials:', bootstrap)
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})
