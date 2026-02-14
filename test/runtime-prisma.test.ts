import { describe, expect, it } from 'vitest'
import { createOpenMCPRuntime } from '../src/runtime.js'
import { OpenMCPError } from '../src/errors.js'

describe('runtime prisma mode', () => {
  it('throws when prisma mode is selected without prismaClient', () => {
    expect(() => createOpenMCPRuntime({ domainAdapter: 'prisma' })).toThrow(OpenMCPError)
  })
})
