import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'

const root = process.cwd()
const runtimeDir = path.join(root, '.openport-product')
const logDir = path.join(runtimeDir, 'logs')
const runtimeFile = path.join(runtimeDir, 'runtime.json')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function request(url) {
  const client = url.startsWith('https://') ? https : http
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timeout while requesting ${url}`))
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ port }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(preferred, fallbackStart) {
  if (await isPortFree(preferred)) {
    return preferred
  }

  for (let port = fallbackStart; port < fallbackStart + 100; port += 1) {
    if (await isPortFree(port)) {
      return port
    }
  }

  throw new Error(`Unable to find free port near ${fallbackStart}`)
}

function killPid(pid) {
  if (!pid) return
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {}
}

function ensureBuildArtifacts() {
  const requiredArtifacts = [
    'apps/reference-server/dist/main.js',
    'apps/api/dist/main.js',
    'apps/web/.next/BUILD_ID'
  ]

  if (requiredArtifacts.every((item) => fileExists(item))) {
    return
  }

  console.log('[openport] build artifacts missing, running acceptance:apps first')
  const result = spawnSync('npm', ['run', 'acceptance:apps'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error('Failed to prepare build artifacts via acceptance:apps')
  }
}

function loadRuntime() {
  if (!fs.existsSync(runtimeFile)) return null
  try {
    return JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
  } catch {
    return null
  }
}

function assertNotAlreadyRunning() {
  const current = loadRuntime()
  if (!current) return

  const active = Object.values(current.processes || {}).some((value) => {
    try {
      process.kill(value.pid, 0)
      return true
    } catch {
      return false
    }
  })

  if (active) {
    throw new Error('Product stack already appears to be running. Use `npm run stop:product` first.')
  }
}

function spawnService({ name, command, env, logPath }) {
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(command[0], command.slice(1), {
    cwd: root,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.pipe(logStream)
  child.stderr.pipe(logStream)
  child.unref()

  return { pid: child.pid, logPath, name }
}

async function waitForHealth(targets, attempts = 45, delayMs = 1000) {
  let lastResults = []

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let ok = true
    const results = []

    for (const target of targets) {
      try {
        const response = await request(target.url)
        results.push({
          name: target.name,
          url: target.url,
          status: response.statusCode
        })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          ok = false
        }
      } catch (error) {
        results.push({
          name: target.name,
          url: target.url,
          error: error instanceof Error ? error.message : String(error)
        })
        ok = false
      }
    }

    lastResults = results
    if (ok) return
    await sleep(delayMs)
  }

  const summary = lastResults
    .map((result) => {
      if (result.error) {
        return `${result.name}: ${result.url} -> ${result.error}`
      }

      return `${result.name}: ${result.url} -> HTTP ${result.status}`
    })
    .join('; ')

  throw new Error(`Timed out waiting for product health endpoints. Last check: ${summary}`)
}

async function main() {
  assertNotAlreadyRunning()
  ensureBuildArtifacts()
  ensureDir(logDir)

  const referencePort = await findAvailablePort(8080, 8180)
  const apiPort = await findAvailablePort(4000, 4100)
  const webPort = await findAvailablePort(3000, 3100)
  const host = '127.0.0.1'

  const baseEnv = {
    ...process.env,
    PATH: process.env.PATH || '',
    HOST: host,
    REFERENCE_HOST: host,
    NEXT_PUBLIC_OPENPORT_API_BASE_URL: `http://${host}:${apiPort}/api`
  }

  const reference = spawnService({
    name: 'reference',
    command: ['npm', 'run', 'start:reference'],
    env: {
      ...baseEnv,
      REFERENCE_PORT: String(referencePort)
    },
    logPath: path.join(logDir, 'reference.log')
  })

  const api = spawnService({
    name: 'api',
    command: ['npm', 'run', 'start:api'],
    env: {
      ...baseEnv,
      PORT: String(apiPort)
    },
    logPath: path.join(logDir, 'api.log')
  })

  const web = spawnService({
    name: 'web',
    command: ['npm', 'run', 'start:web'],
    env: {
      ...baseEnv,
      PORT: String(webPort)
    },
    logPath: path.join(logDir, 'web.log')
  })

  try {
    await waitForHealth([
      { name: 'reference', url: `http://${host}:${referencePort}/healthz` },
      { name: 'api', url: `http://${host}:${apiPort}/api/health` },
      { name: 'web', url: `http://${host}:${webPort}/api/health` }
    ])

    const runtime = {
      startedAt: new Date().toISOString(),
      urls: {
        reference: `http://${host}:${referencePort}`,
        api: `http://${host}:${apiPort}/api`,
        web: `http://${host}:${webPort}`
      },
      processes: {
        reference,
        api,
        web
      }
    }
    fs.writeFileSync(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`, 'utf8')

    console.log('[openport] product stack started')
    console.log(`[openport] web: ${runtime.urls.web}`)
    console.log(`[openport] api: ${runtime.urls.api}`)
    console.log(`[openport] reference: ${runtime.urls.reference}`)
    console.log(`[openport] logs: ${logDir}`)
  } catch (error) {
    killPid(reference.pid)
    killPid(api.pid)
    killPid(web.pid)
    throw error
  }
}

main().catch((error) => {
  console.error(`[openport] start failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
