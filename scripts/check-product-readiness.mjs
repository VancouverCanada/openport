import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function log(status, message) {
  const prefix = status === 'ok' ? '[ok]' : status === 'warn' ? '[warn]' : '[fail]'
  console.log(`${prefix} ${message}`)
}

function parseMajor(version) {
  const normalized = String(version || '').replace(/^v/, '')
  const major = Number(normalized.split('.')[0] || '0')
  return Number.isFinite(major) ? major : 0
}

function parseEnvFile(relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) return null

  const raw = fs.readFileSync(fullPath, 'utf8')
  const map = new Map()
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    map.set(key, value)
  }
  return map
}

const requiredFiles = [
  '.env.example',
  '.dockerignore',
  'compose/docker-compose.yml',
  'docker/api.Dockerfile',
  'docker/web.Dockerfile',
  'docker/reference-server.Dockerfile',
  'apps/api/package.json',
  'apps/web/package.json',
  'apps/reference-server/package.json',
  '.nvmrc',
  '.node-version',
  'packages/openport-product-contracts/package.json',
  'packages/openport-core/package.json',
  'docs/15-openport-productization-progress.md',
  'docs/17-openport-runtime-validation.md',
  'docs/18-openport-validation-failure-guide.md',
  'docs/19-openport-app-acceptance-checklist.md',
  'scripts/check-docker-daemon.mjs',
  'scripts/prepare-product-env.mjs',
  'scripts/run-product-acceptance.mjs',
  'scripts/start-product-stack.mjs',
  'scripts/stop-product-stack.mjs',
  'scripts/status-product-stack.mjs',
  'scripts/with-modern-node.sh'
]

const requiredEnvKeys = [
  'NEXT_PUBLIC_OPENPORT_API_BASE_URL',
  'PORT',
  'HOST',
  'OPENPORT_DOMAIN_ADAPTER',
  'REFERENCE_PORT',
  'REFERENCE_HOST',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD'
]

let hasFailure = false

console.log('[openport] product readiness preflight')

const nodeMajor = parseMajor(process.version)
if (nodeMajor >= 20) {
  log('ok', `Node runtime ${process.version} satisfies product app requirement (>=20)`)
} else {
  hasFailure = true
  log('fail', `Node runtime ${process.version} is below required version >=20 for apps/api, apps/web, and apps/reference-server`)
}

for (const file of requiredFiles) {
  if (fileExists(file)) {
    log('ok', `Found ${file}`)
  } else {
    hasFailure = true
    log('fail', `Missing ${file}`)
  }
}

if (fileExists('.env')) {
  log('ok', 'Found .env')
  const envMap = parseEnvFile('.env')
  if (envMap) {
    for (const key of requiredEnvKeys) {
      if (envMap.has(key)) {
        log('ok', `.env contains ${key}`)
      } else {
        hasFailure = true
        log('fail', `.env is missing required key ${key}`)
      }
    }

    const adapter = envMap.get('OPENPORT_DOMAIN_ADAPTER')
    if (adapter === 'postgres' && !envMap.get('OPENPORT_DATABASE_URL')) {
      hasFailure = true
      log('fail', '.env must define OPENPORT_DATABASE_URL when OPENPORT_DOMAIN_ADAPTER=postgres')
    }
  }
} else {
  log('warn', 'No .env file found. Run `npm run env:product` or copy .env.example to .env before running compose or product apps.')
}

const dockerSocketExists =
  fs.existsSync('/var/run/docker.sock') ||
  fs.existsSync(path.join(process.env.HOME || '', '.docker'))

if (dockerSocketExists) {
  log('ok', 'Docker installation indicators detected')
} else {
  log('warn', 'Docker installation was not detected from common locations')
}

if (hasFailure) {
  console.log('[openport] readiness preflight failed')
  process.exit(1)
}

console.log('[openport] readiness preflight passed')
