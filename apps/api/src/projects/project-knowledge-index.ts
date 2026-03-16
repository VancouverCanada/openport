import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type { ProjectKnowledgeChunkRecord } from '../storage/api-state-store.service.js'

const TEXTUAL_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.yml',
  '.yaml',
  '.html',
  '.htm',
  '.xml',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.css',
  '.scss',
  '.sql'
])

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'into',
  'have',
  'will',
  'what',
  'when',
  'where',
  'about',
  'which',
  'were',
  'been',
  'them',
  'they',
  'their',
  'then',
  'than',
  'there',
  'here',
  'would',
  'could',
  'should',
  'openport',
  'project'
])

function isTextLike(name: string, type: string): boolean {
  if (type.startsWith('text/')) return true
  if (type === 'application/json' || type === 'application/xml') return true
  return TEXTUAL_EXTENSIONS.has(path.extname(name).toLowerCase())
}

export function decodeTextContent(name: string, type: string, contentBase64: string): string | null {
  if (!isTextLike(name, type)) return null

  try {
    return Buffer.from(contentBase64, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trim()
}

export type KnowledgeChunkingOptions = {
  strategy?: 'balanced' | 'dense' | 'sparse' | 'semantic'
  chunkSize?: number
  overlap?: number
  maxChunks?: number
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

function toSparseVector(tokens: string[]): Record<string, number> {
  const counts = new Map<string, number>()
  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1)
  })

  const magnitude = Math.sqrt([...counts.values()].reduce((sum, value) => sum + value * value, 0)) || 1
  return [...counts.entries()].reduce<Record<string, number>>((result, [token, count]) => {
    result[token] = count / magnitude
    return result
  }, {})
}

function resolveChunkOptions(options: KnowledgeChunkingOptions = {}): Required<KnowledgeChunkingOptions> {
  const strategy = options.strategy || 'balanced'
  if (strategy === 'dense') {
    return {
      strategy,
      chunkSize: options.chunkSize ?? 360,
      overlap: options.overlap ?? 90,
      maxChunks: options.maxChunks ?? 120
    }
  }
  if (strategy === 'sparse') {
    return {
      strategy,
      chunkSize: options.chunkSize ?? 900,
      overlap: options.overlap ?? 120,
      maxChunks: options.maxChunks ?? 40
    }
  }
  if (strategy === 'semantic') {
    return {
      strategy,
      chunkSize: options.chunkSize ?? 720,
      overlap: options.overlap ?? 120,
      maxChunks: options.maxChunks ?? 80
    }
  }
  return {
    strategy: 'balanced',
    chunkSize: options.chunkSize ?? 600,
    overlap: options.overlap ?? 120,
    maxChunks: options.maxChunks ?? 50
  }
}

function pushWithOverlap(target: string[], text: string, chunkSize: number, overlap: number, maxChunks: number): void {
  const normalizedOverlap = Math.max(0, Math.min(overlap, Math.max(0, chunkSize - 1)))
  const step = Math.max(1, chunkSize - normalizedOverlap)
  for (let index = 0; index < text.length && target.length < maxChunks; index += step) {
    const segment = text.slice(index, index + chunkSize).trim()
    if (!segment) continue
    target.push(segment)
    if (index + chunkSize >= text.length) {
      break
    }
  }
}

function chunkText(text: string, options: KnowledgeChunkingOptions = {}): string[] {
  const source = normalizeText(text)
  if (!source) return []
  const resolved = resolveChunkOptions(options)
  const chunkSize = Math.max(120, Math.min(2400, resolved.chunkSize))
  const overlap = Math.max(0, Math.min(chunkSize - 1, resolved.overlap))
  const maxChunks = Math.max(1, Math.min(300, resolved.maxChunks))

  const paragraphs = source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (resolved.strategy === 'semantic') {
    const sentences = source
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
    const semanticChunks: string[] = []
    let current = ''
    sentences.forEach((sentence) => {
      if ((`${current} ${sentence}`).trim().length <= chunkSize) {
        current = `${current} ${sentence}`.trim()
        return
      }
      if (current) {
        semanticChunks.push(current)
      }
      if (sentence.length <= chunkSize) {
        current = sentence
      } else {
        pushWithOverlap(semanticChunks, sentence, chunkSize, overlap, maxChunks)
        current = ''
      }
    })
    if (current && semanticChunks.length < maxChunks) {
      semanticChunks.push(current)
    }
    return semanticChunks.slice(0, maxChunks)
  }

  const chunks: string[] = []
  let current = ''

  paragraphs.forEach((paragraph) => {
    if ((current + '\n\n' + paragraph).length <= chunkSize) {
      current = current ? `${current}\n\n${paragraph}` : paragraph
      return
    }

    if (current) {
      chunks.push(current)
    }

    if (paragraph.length <= chunkSize) {
      current = paragraph
      return
    }

    pushWithOverlap(chunks, paragraph, chunkSize, overlap, maxChunks)
    current = ''
  })

  if (current) {
    chunks.push(current)
  }

  return chunks.slice(0, maxChunks)
}

export function buildKnowledgeChunks(
  workspaceId: string,
  itemId: string,
  contentText: string | null,
  options: KnowledgeChunkingOptions = {}
): ProjectKnowledgeChunkRecord[] {
  if (!contentText) return []

  return chunkText(contentText, options).map((text) => ({
    id: `chunk_${randomUUID()}`,
    workspaceId,
    itemId,
    text,
    vector: toSparseVector(tokenize(text))
  }))
}

export function buildKnowledgePreview(contentText: string | null): string {
  if (!contentText) return ''
  return normalizeText(contentText).slice(0, 180)
}

function cosineSimilarity(left: Record<string, number>, right: Record<string, number>): number {
  let score = 0

  Object.entries(left).forEach(([token, value]) => {
    const match = right[token]
    if (typeof match === 'number') {
      score += value * match
    }
  })

  return score
}

export function rankKnowledgeChunks(
  chunks: ProjectKnowledgeChunkRecord[],
  query: string
): Array<ProjectKnowledgeChunkRecord & { score: number }> {
  const queryVector = toSparseVector(tokenize(query))
  if (Object.keys(queryVector).length === 0) return []

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.vector)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.text.localeCompare(right.text)
    })
}

export function createDeterministicAssetHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}
