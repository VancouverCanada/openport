import { Injectable } from '@nestjs/common'
import type { OpenPortNotePresence } from '@openport/product-contracts'
import * as Y from 'yjs'

type RealtimeActor = {
  userId: string
  workspaceId: string
  name: string
  email: string
}

type RealtimeDocument = {
  noteId: string
  documentId: string
  doc: Y.Doc
  activeUsers: Map<string, OpenPortNotePresence>
  saveTimeout: NodeJS.Timeout | null
}

@Injectable()
export class NotesRealtimeService {
  private readonly documents = new Map<string, RealtimeDocument>()

  getOrCreateDocument(noteId: string): RealtimeDocument {
    const documentId = this.toDocumentId(noteId)
    const existing = this.documents.get(documentId)
    if (existing) return existing

    const doc = new Y.Doc()

    const next: RealtimeDocument = {
      noteId,
      documentId,
      doc,
      activeUsers: new Map<string, OpenPortNotePresence>(),
      saveTimeout: null
    }

    this.documents.set(documentId, next)
    return next
  }

  toDocumentId(noteId: string): string {
    return `note:${noteId}`
  }

  toRoom(documentId: string): string {
    return `doc_${documentId}`
  }

  encodeState(documentId: string): number[] {
    const registry = this.requireDocument(documentId)
    return Array.from(Y.encodeStateAsUpdate(registry.doc))
  }

  applyUpdate(documentId: string, update: number[]): void {
    const registry = this.requireDocument(documentId)
    Y.applyUpdate(registry.doc, Uint8Array.from(update), 'remote')
  }

  addUser(
    documentId: string,
    socketId: string,
    actor: RealtimeActor,
    state: OpenPortNotePresence['state'] = 'viewing'
  ): OpenPortNotePresence[] {
    const registry = this.requireDocument(documentId)
    registry.activeUsers.set(socketId, {
      userId: actor.userId,
      name: actor.name,
      email: actor.email,
      state,
      seenAt: new Date().toISOString()
    })
    return this.listUsers(documentId)
  }

  updateUserState(
    documentId: string,
    socketId: string,
    state: OpenPortNotePresence['state']
  ): OpenPortNotePresence[] {
    const registry = this.requireDocument(documentId)
    const current = registry.activeUsers.get(socketId)
    if (!current) return this.listUsers(documentId)

    registry.activeUsers.set(socketId, {
      ...current,
      state,
      seenAt: new Date().toISOString()
    })
    return this.listUsers(documentId)
  }

  removeUser(documentId: string, socketId: string): OpenPortNotePresence[] {
    const registry = this.documents.get(documentId)
    if (!registry) return []

    registry.activeUsers.delete(socketId)
    const remaining = this.listUsers(documentId)
    if (remaining.length === 0 && registry.saveTimeout) {
      clearTimeout(registry.saveTimeout)
      registry.saveTimeout = null
    }
    return remaining
  }

  listUsers(documentId: string): OpenPortNotePresence[] {
    const registry = this.documents.get(documentId)
    if (!registry) return []
    return [...registry.activeUsers.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  scheduleSave<T>(documentId: string, payload: T, callback: (payload: T) => void, delayMs = 500): void {
    const registry = this.requireDocument(documentId)
    if (registry.saveTimeout) {
      clearTimeout(registry.saveTimeout)
    }

    registry.saveTimeout = setTimeout(() => {
      registry.saveTimeout = null
      callback(payload)
    }, delayMs)
  }

  cleanup(documentId: string): void {
    const registry = this.documents.get(documentId)
    if (!registry) return
    if (registry.activeUsers.size > 0) return
    if (registry.saveTimeout) {
      clearTimeout(registry.saveTimeout)
    }
    this.documents.delete(documentId)
  }

  private requireDocument(documentId: string): RealtimeDocument {
    const registry = this.documents.get(documentId)
    if (!registry) {
      throw new Error(`Realtime document not found: ${documentId}`)
    }
    return registry
  }
}
