import { describe, expect, it } from 'vitest'
import { createOpenPortRuntime } from '../src/runtime.js'
import { OpenPortError } from '../src/errors.js'

describe('runtime prisma mode', () => {
  it('throws when prisma mode is selected without prismaClient', () => {
    expect(() => createOpenPortRuntime({ domainAdapter: 'prisma' })).toThrow(OpenPortError)
  })
})
