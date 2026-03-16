import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const runtimeFile = path.join(root, '.openport-product', 'runtime.json')

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

if (!fs.existsSync(runtimeFile)) {
  console.log('[openport] product stack is not running')
  process.exit(0)
}

const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
console.log('[openport] product stack status')
console.log(JSON.stringify({
  startedAt: runtime.startedAt,
  urls: runtime.urls,
  processes: Object.fromEntries(
    Object.entries(runtime.processes || {}).map(([name, info]) => [
      name,
      {
        pid: info.pid,
        alive: isAlive(info.pid),
        logPath: info.logPath
      }
    ])
  )
}, null, 2))
