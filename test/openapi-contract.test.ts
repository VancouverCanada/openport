import { readFile } from 'node:fs/promises'
import path from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'

type SpecDoc = {
  openapi: string
  paths: Record<string, Record<string, unknown>>
}

function toFastifyPath(specPath: string): string {
  return specPath.replace(/\{([^}]+)\}/g, ':$1')
}

describe('openapi contract', () => {
  it('has a valid OpenAPI document', async () => {
    const specPath = path.resolve(process.cwd(), 'spec/openmcp-v1.openapi.yaml')
    const parsed = await SwaggerParser.validate(specPath)
    expect(parsed.openapi).toMatch(/^3\./)
  })

  it('registers all documented routes in reference app', async () => {
    const specPath = path.resolve(process.cwd(), 'spec/openmcp-v1.openapi.yaml')
    const raw = await readFile(specPath, 'utf8')
    const doc = parseYaml(raw) as SpecDoc

    const { app } = await buildDemoApp()

    try {
      for (const [specPathKey, methods] of Object.entries(doc.paths)) {
        const routePath = toFastifyPath(specPathKey)
        for (const method of Object.keys(methods)) {
          const upper = method.toUpperCase()
          const exists = app.hasRoute({ method: upper, url: routePath })
          expect(exists, `${upper} ${routePath} should exist`).toBe(true)
        }
      }
    } finally {
      await app.close()
    }
  })

  it('returns standardized envelope on manifest endpoint', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const payload = response.json()
      expect(payload).toMatchObject({
        ok: true,
        code: 'common.success'
      })
      expect(payload.data).toBeTypeOf('object')
    } finally {
      await app.close()
    }
  })
})
