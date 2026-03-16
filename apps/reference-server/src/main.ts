import { buildReferenceDemoApp } from './app.js'
import { resolveReferenceRuntimeEnv } from './runtime-env.js'

async function main(): Promise<void> {
  const runtime = resolveReferenceRuntimeEnv()
  const { app, bootstrap } = await buildReferenceDemoApp({
    domainAdapter: runtime.domainAdapter,
    postgresConnectionString: runtime.databaseUrl || undefined
  })

  await app.listen({ host: runtime.host, port: runtime.port })

  console.log('[openport-reference] server started')
  console.log(`[openport-reference] listening on http://${runtime.host}:${runtime.port}`)
  console.log(`[openport-reference] domain adapter: ${runtime.domainAdapter}`)
  console.log('[openport-reference] admin header: x-admin-user: admin_demo')
  console.log('[openport-reference] bootstrap credentials:', bootstrap)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
