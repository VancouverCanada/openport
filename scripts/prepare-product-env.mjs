import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const examplePath = path.join(root, '.env.example')
const envPath = path.join(root, '.env')
const dryRun = process.argv.includes('--dry-run')

function parseLines(raw) {
  return raw.split(/\r?\n/)
}

function parseKey(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex <= 0) return null
  return trimmed.slice(0, eqIndex).trim()
}

function formatAction(message) {
  console.log(`[openport] ${message}`)
}

if (!fs.existsSync(examplePath)) {
  console.error('[openport] missing .env.example')
  process.exit(1)
}

const exampleRaw = fs.readFileSync(examplePath, 'utf8')
const exampleLines = parseLines(exampleRaw)
const exampleEntries = exampleLines
  .map((line) => ({ line, key: parseKey(line) }))
  .filter((entry) => entry.key)

if (!fs.existsSync(envPath)) {
  if (dryRun) {
    formatAction('would create .env from .env.example')
    process.exit(0)
  }

  fs.writeFileSync(envPath, `${exampleRaw.trimEnd()}\n`, 'utf8')
  formatAction('created .env from .env.example')
  process.exit(0)
}

const envRaw = fs.readFileSync(envPath, 'utf8')
const envLines = parseLines(envRaw)
const envKeys = new Set(envLines.map(parseKey).filter(Boolean))
const missingEntries = exampleEntries.filter((entry) => !envKeys.has(entry.key))

if (missingEntries.length === 0) {
  formatAction('.env already contains all keys from .env.example')
  process.exit(0)
}

if (dryRun) {
  formatAction(`would append ${missingEntries.length} missing key(s) to .env`)
  for (const entry of missingEntries) {
    formatAction(`missing ${entry.key}`)
  }
  process.exit(0)
}

const addition = [
  '',
  '# Added from .env.example by scripts/prepare-product-env.mjs',
  ...missingEntries.map((entry) => entry.line)
].join('\n')

const nextRaw = `${envRaw.trimEnd()}\n${addition}\n`
fs.writeFileSync(envPath, nextRaw, 'utf8')
formatAction(`updated .env with ${missingEntries.length} missing key(s)`)
