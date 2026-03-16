'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  createKnowledgeCollection,
  fetchKnowledgeCollections,
  loadSession,
  updateKnowledgeCollection
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'

type WorkspaceKnowledgeCollectionEditorProps = {
  collectionId?: string
}

export function WorkspaceKnowledgeCollectionEditor({ collectionId }: WorkspaceKnowledgeCollectionEditorProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(Boolean(collectionId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!collectionId) return
    let isActive = true
    void fetchKnowledgeCollections(loadSession())
      .then((response) => {
        if (!isActive) return
        const item = response.items.find((entry) => entry.id === collectionId)
        if (!item) {
          setLoading(false)
          return
        }
        setName(item.name)
        setDescription(item.description)
        setLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [collectionId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    try {
      const session = loadSession()
      const response = collectionId
        ? await updateKnowledgeCollection(collectionId, { name, description }, session)
        : await createKnowledgeCollection({ name, description }, session)
      notify('success', collectionId ? 'Collection updated.' : 'Collection created.')
      router.push(`/workspace/knowledge/collections/${response.item.id}`)
      router.refresh()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to save collection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-editor-page">
      <PageHeader
        description="Organize retrieval sources into reusable knowledge collections."
        label="Workspace"
        title={collectionId ? 'Edit collection' : 'Create collection'}
      />
      {loading ? <p className="workspace-module-empty">Loading collection…</p> : null}
      {!loading ? (
        <form className="workspace-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Name">
            <input onChange={(event) => setName(event.target.value)} required value={name} />
          </Field>
          <Field label="Description">
            <textarea onChange={(event) => setDescription(event.target.value)} rows={6} value={description} />
          </Field>
          <div className="workspace-editor-actions">
            <CapsuleButton disabled={saving} type="submit" variant="primary">{saving ? 'Saving…' : collectionId ? 'Save collection' : 'Create collection'}</CapsuleButton>
            <CapsuleButton onClick={() => router.push('/workspace/knowledge')} type="button" variant="secondary">Cancel</CapsuleButton>
          </div>
        </form>
      ) : null}
    </div>
  )
}
