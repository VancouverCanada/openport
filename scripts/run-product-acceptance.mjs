import { spawnSync } from 'node:child_process'

const modes = {
  local: {
    description: 'Run product preflight and root build validation.',
    steps: [
      { label: 'preflight', command: ['npm', 'run', 'preflight:product'] },
      { label: 'build', command: ['npm', 'run', 'build'] }
    ]
  },
  apps: {
    description: 'Run preflight, root build, then compile reference/api/web product apps.',
    steps: [
      { label: 'preflight', command: ['npm', 'run', 'preflight:product'] },
      { label: 'build', command: ['npm', 'run', 'build'] },
      { label: 'build-reference', command: ['npm', 'run', 'build:reference'] },
      { label: 'build-api', command: ['npm', 'run', 'build:api'] },
      { label: 'build-web', command: ['npm', 'run', 'build:web'] }
    ]
  },
  images: {
    description: 'Run preflight, docker preflight, then build product compose images.',
    steps: [
      { label: 'env', command: ['npm', 'run', 'env:product'] },
      { label: 'preflight', command: ['npm', 'run', 'preflight:product'] },
      { label: 'docker-preflight', command: ['npm', 'run', 'docker:preflight'] },
      { label: 'compose-config', command: ['npm', 'run', 'compose:config'] },
      { label: 'compose-build', command: ['npm', 'run', 'compose:build'] }
    ]
  },
  services: {
    description: 'Probe already-running reference/api/web services.',
    steps: [
      {
        label: 'health',
        command: ['npm', 'run', 'health:product'],
        retryable: true
      }
    ]
  },
  full: {
    description: 'Run preflight, build, then probe already-running services.',
    steps: [
      { label: 'preflight', command: ['npm', 'run', 'preflight:product'] },
      { label: 'build', command: ['npm', 'run', 'build'] },
      {
        label: 'health',
        command: ['npm', 'run', 'health:product'],
        retryable: true
      }
    ]
  },
  compose: {
    description: 'Run preflight, boot docker compose, then wait for product health checks.',
    steps: [
      { label: 'env', command: ['npm', 'run', 'env:product'] },
      { label: 'preflight', command: ['npm', 'run', 'preflight:product'] },
      { label: 'docker-preflight', command: ['npm', 'run', 'docker:preflight'] },
      { label: 'compose-up', command: ['npm', 'run', 'compose:up'] },
      {
        label: 'health',
        command: ['npm', 'run', 'health:product'],
        retryable: true
      }
    ]
  }
}

function parseMode(raw) {
  const value = String(raw || 'local').trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(modes, value)) {
    return value
  }

  throw new Error(`Unknown acceptance mode: ${value}`)
}

function parsePositiveInteger(raw, fallback) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.trunc(value)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function runCommand(command, label) {
  const [bin, ...args] = command
  console.log(`[openport] ${label}: ${[bin, ...args].join(' ')}`)
  const result = spawnSync(bin, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  const code = typeof result.status === 'number' ? result.status : 1
  if (code !== 0) {
    throw new Error(`Step failed: ${label} (exit ${code})`)
  }
}

async function runRetryableStep(step, attempts, delayMs) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      runCommand(step.command, `${step.label} attempt ${attempt}/${attempts}`)
      return
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }
      console.log(`[openport] ${step.label} retry scheduled in ${delayMs}ms`)
      await sleep(delayMs)
    }
  }
}

async function main() {
  const mode = parseMode(process.argv[2])
  const attempts = parsePositiveInteger(process.env.OPENPORT_HEALTH_ATTEMPTS, 12)
  const delayMs = parsePositiveInteger(process.env.OPENPORT_HEALTH_DELAY_MS, 5000)
  const plan = modes[mode]

  console.log(`[openport] acceptance mode: ${mode}`)
  console.log(`[openport] ${plan.description}`)

  for (const step of plan.steps) {
    if (step.retryable) {
      await runRetryableStep(step, attempts, delayMs)
    } else {
      runCommand(step.command, step.label)
    }
  }

  console.log(`[openport] acceptance mode ${mode} passed`)
}

main().catch((error) => {
  console.error(`[openport] acceptance failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
