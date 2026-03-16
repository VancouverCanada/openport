import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function loadDotEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return {}

  const content = fs.readFileSync(envPath, 'utf8')
  const values = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    values[key] = value
  }

  return values
}

function loadManagedRuntime() {
  const runtimePath = path.join(root, '.openport-product', 'runtime.json')
  if (!fs.existsSync(runtimePath)) return null

  try {
    return JSON.parse(fs.readFileSync(runtimePath, 'utf8'))
  } catch {
    return null
  }
}

const managedRuntime = loadManagedRuntime()
const dotenv = loadDotEnv()

function envValue(key) {
  return process.env[key] || dotenv[key]
}

const targets = {
  reference: {
    url: envValue('OPENPORT_REFERENCE_HEALTH_URL') ||
      (managedRuntime?.urls?.reference
        ? `${managedRuntime.urls.reference}/healthz`
        : `http://127.0.0.1:${envValue('REFERENCE_HOST_PORT') || envValue('REFERENCE_PORT') || '8080'}/healthz`)
  },
  api: {
    url: envValue('OPENPORT_API_HEALTH_URL') ||
      (managedRuntime?.urls?.api
        ? `${managedRuntime.urls.api}/health`
        : `http://127.0.0.1:${envValue('API_HOST_PORT') || envValue('PORT') || '4000'}/api/health`)
  },
  web: {
    url: envValue('OPENPORT_WEB_HEALTH_URL') ||
      (managedRuntime?.urls?.web
        ? `${managedRuntime.urls.web}/api/health`
        : `http://127.0.0.1:${envValue('WEB_HOST_PORT') || '3000'}/api/health`)
  }
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

function parseArg(raw) {
  const value = String(raw || 'product').trim().toLowerCase()
  if (value === 'product' || value === 'all') return ['reference', 'api', 'web']
  if (value === 'reference' || value === 'api' || value === 'web') return [value]
  throw new Error(`Unknown target: ${value}`)
}

async function main() {
  const selected = parseArg(process.argv[2])
  let hasFailure = false

  for (const name of selected) {
    const target = targets[name]
    try {
      const response = await request(target.url)
      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`[ok] ${name} health check passed: ${target.url}`)
      } else {
        hasFailure = true
        console.log(`[fail] ${name} health check returned ${response.statusCode}: ${target.url}`)
      }
    } catch (error) {
      hasFailure = true
      console.log(`[fail] ${name} health check error: ${target.url}`)
      console.log(String(error))
    }
  }

  if (hasFailure) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
