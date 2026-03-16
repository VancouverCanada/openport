import { Injectable } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import type { ProjectDenseKnowledgeChunkRecord, ProjectKnowledgeChunkRecord } from '../storage/api-state-store.service.js'

type RankedSparseChunk = ProjectKnowledgeChunkRecord & { score: number }

export type RankedDenseChunk = ProjectDenseKnowledgeChunkRecord & { score: number }

export type RankedHybridChunk = {
  chunkId: string
  itemId: string
  text: string
  score: number
}

const DENSE_DIMENSION = 64
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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

function normalizeDense(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / magnitude)
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let score = 0

  for (let index = 0; index < length; index += 1) {
    score += (left[index] || 0) * (right[index] || 0)
  }

  return score
}

export interface ProjectEmbeddingProvider {
  name: string
  embed(text: string): number[]
}

export interface ProjectVectorStoreProvider {
  rank(chunks: ProjectDenseKnowledgeChunkRecord[], queryVector: number[]): RankedDenseChunk[]
}

class DeterministicEmbeddingProvider implements ProjectEmbeddingProvider {
  readonly name = 'deterministic-hash'

  embed(text: string): number[] {
    const vector = new Array<number>(DENSE_DIMENSION).fill(0)
    const tokens = tokenize(text)
    if (tokens.length === 0) return vector

    tokens.forEach((token, tokenIndex) => {
      const digest = createHash('sha256').update(`${token}:${tokenIndex}`).digest()
      for (let index = 0; index < DENSE_DIMENSION; index += 1) {
        const byte = digest[index % digest.length] || 0
        vector[index] += (byte / 255 - 0.5) * 2
      }
    })

    return normalizeDense(vector)
  }
}

class InProcessVectorStoreProvider implements ProjectVectorStoreProvider {
  rank(chunks: ProjectDenseKnowledgeChunkRecord[], queryVector: number[]): RankedDenseChunk[] {
    return chunks
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(chunk.vector, queryVector)
      }))
      .filter((chunk) => chunk.score > 0)
      .sort((left, right) => right.score - left.score)
  }
}

@Injectable()
export class ProjectRetrievalService {
  private readonly embeddingProvider: ProjectEmbeddingProvider = new DeterministicEmbeddingProvider()
  private readonly vectorStore: ProjectVectorStoreProvider = new InProcessVectorStoreProvider()

  buildDenseChunks(chunks: ProjectKnowledgeChunkRecord[]): ProjectDenseKnowledgeChunkRecord[] {
    return chunks.map((chunk) => ({
      id: chunk.id,
      workspaceId: chunk.workspaceId,
      itemId: chunk.itemId,
      text: chunk.text,
      vector: this.embeddingProvider.embed(chunk.text)
    }))
  }

  buildStandaloneDenseChunks(workspaceId: string, itemId: string, texts: string[]): ProjectDenseKnowledgeChunkRecord[] {
    return texts.map((text, index) => ({
      id: `dchunk_${itemId}_${index}_${randomUUID()}`,
      workspaceId,
      itemId,
      text,
      vector: this.embeddingProvider.embed(text)
    }))
  }

  rankHybrid(
    sparseChunks: RankedSparseChunk[],
    denseChunks: ProjectDenseKnowledgeChunkRecord[],
    query: string
  ): RankedHybridChunk[] {
    const denseRank = this.vectorStore.rank(denseChunks, this.embeddingProvider.embed(query))
    const byChunkId = new Map<string, RankedHybridChunk>()

    sparseChunks.forEach((chunk) => {
      byChunkId.set(chunk.id, {
        chunkId: chunk.id,
        itemId: chunk.itemId,
        text: chunk.text,
        score: chunk.score * 0.6
      })
    })

    denseRank.forEach((chunk) => {
      const current = byChunkId.get(chunk.id)
      if (current) {
        current.score += chunk.score * 0.4
        return
      }

      byChunkId.set(chunk.id, {
        chunkId: chunk.id,
        itemId: chunk.itemId,
        text: chunk.text,
        score: chunk.score * 0.4
      })
    })

    return [...byChunkId.values()].sort((left, right) => right.score - left.score)
  }
}
