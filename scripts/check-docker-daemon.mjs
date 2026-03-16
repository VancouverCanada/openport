import { spawnSync } from 'node:child_process'

console.log('[openport] docker daemon preflight')

const result = spawnSync('docker', ['info'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32'
})

if (typeof result.status === 'number' && result.status === 0) {
  console.log('[ok] Docker daemon is reachable')
  process.exit(0)
}

const stderr = String(result.stderr || '').trim()
const stdout = String(result.stdout || '').trim()
const combined = [stdout, stderr].filter(Boolean).join('\n')

if (combined.includes('Cannot connect to the Docker daemon')) {
  console.log('[fail] Docker CLI is installed but the Docker daemon is not reachable')
  console.log('[hint] Start Docker Desktop or fix the current Docker context before running compose validation')
} else if (result.error) {
  console.log('[fail] Unable to execute `docker info`')
  console.log(String(result.error))
} else {
  console.log('[fail] Docker daemon check failed')
  if (combined) {
    console.log(combined)
  }
}

process.exit(1)
