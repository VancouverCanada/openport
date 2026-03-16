import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const runtimeFile = path.join(root, '.openport-product', 'runtime.json')

function killPid(pid) {
  if (!pid) return
  try {
    process.kill(pid, 'SIGTERM')
  } catch {}
}

if (!fs.existsSync(runtimeFile)) {
  console.log('[openport] no running product stack metadata found')
  process.exit(0)
}

const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
for (const processInfo of Object.values(runtime.processes || {})) {
  killPid(processInfo.pid)
}

fs.unlinkSync(runtimeFile)
console.log('[openport] product stack stopped')
