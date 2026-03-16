'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  createProjectKnowledgeText,
  fetchKnowledgeCollections,
  loadSession,
  uploadProjectKnowledge
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file'))
        return
      }

      const [, contentBase64 = ''] = result.split(',', 2)
      resolve(contentBase64)
    }
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

export function WorkspaceKnowledgeCreate() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'upload' | 'text'>('upload')
  const [collectionId, setCollectionId] = useState('collection_general')
  const [collectionName, setCollectionName] = useState('')
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([])
  const [contentText, setContentText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchKnowledgeCollections(loadSession())
      .then((response) => {
        setCollections(response.items.map((item) => ({ id: item.id, name: item.name })))
      })
      .catch(() => {
        setCollections([])
      })
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (mode === 'upload' && !file) {
      notify('error', 'Choose a file to upload.')
      return
    }

    if (mode === 'text' && !contentText.trim()) {
      notify('error', 'Enter text content to index.')
      return
    }

    setSaving(true)
    try {
      const item =
        mode === 'upload'
          ? (
              await uploadProjectKnowledge(
                {
                  name: name.trim() || file?.name || 'Untitled knowledge',
                  type: file?.type,
                  size: file?.size,
                  collectionId: collectionId === 'custom' ? undefined : collectionId,
                  collectionName: collectionId === 'custom' ? collectionName.trim() || undefined : undefined,
                  contentBase64: await fileToBase64(file as File)
                },
                loadSession()
              )
            ).item
          : (
              await createProjectKnowledgeText(
                {
                  name: name.trim() || 'Untitled knowledge',
                  collectionId: collectionId === 'custom' ? undefined : collectionId,
                  collectionName: collectionId === 'custom' ? collectionName.trim() || undefined : undefined,
                  contentText
                },
                loadSession()
              )
            ).item
      notify('success', 'Knowledge uploaded.')
      router.push(`/workspace/knowledge/${item.id}`)
    } catch {
      notify('error', 'Unable to upload knowledge.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-editor-page">
      <PageHeader
        description="Upload a document or text source so OpenPort can index it for retrieval."
        label="Workspace"
        title="New knowledge"
      />

      <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="workspace-editor-grid workspace-editor-grid--compact">
          <label className="workspace-editor-checkbox">
            <input checked={mode === 'upload'} onChange={() => setMode('upload')} type="radio" />
            <span>Upload file</span>
          </label>
          <label className="workspace-editor-checkbox">
            <input checked={mode === 'text'} onChange={() => setMode('text')} type="radio" />
            <span>Add text</span>
          </label>
        </div>
        <Field label="Name">
          <input onChange={(event) => setName(event.target.value)} placeholder="Knowledge base name" value={name} />
        </Field>
        <Field label="Collection">
          <select onChange={(event) => setCollectionId(event.target.value)} value={collectionId}>
            <option value="collection_general">General</option>
            {collections
              .filter((collection) => collection.id !== 'collection_general')
              .map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            <option value="custom">Create from name…</option>
          </select>
        </Field>
        {collectionId === 'custom' ? (
          <Field label="New collection name">
            <input onChange={(event) => setCollectionName(event.target.value)} placeholder="Policies" value={collectionName} />
          </Field>
        ) : null}
        {mode === 'upload' ? (
          <Field label="File">
            <input onChange={(event) => setFile(event.target.files?.[0] || null)} required type="file" />
          </Field>
        ) : (
          <Field label="Text content">
            <textarea onChange={(event) => setContentText(event.target.value)} required rows={14} value={contentText} />
          </Field>
        )}
        <div className="workspace-editor-actions">
          <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Uploading…' : 'Upload knowledge'}</CapsuleButton>
          <CapsuleButton onClick={() => router.push('/workspace/knowledge')} type="button" variant="secondary">Cancel</CapsuleButton>
        </div>
      </form>
    </div>
  )
}
