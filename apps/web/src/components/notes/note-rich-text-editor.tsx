'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import type { OpenPortClientSession, OpenPortNoteCollaborationState } from '@openport/product-contracts'
import { buildNoteRichSnapshot, toInitialRichHtml, type OpenPortNoteRichSnapshot } from '../../lib/notes-rich-text'
import { NoteDragHandle } from '../../lib/note-drag-handle'
import { type NoteSlashCommandItem, NoteSlashCommands } from '../../lib/note-slash-commands'
import { OpenPortNoteRealtime } from '../../lib/notes-realtime'
import { uploadOpenPortNoteImage } from '../../lib/openport-api'
import { createSuggestionRenderer } from '../../lib/editor-suggestion-popup'
import { Iconify } from '../iconify'
import { IconButton } from '../ui/icon-button'
import { TextButton } from '../ui/text-button'

export type NoteMentionItem = {
  id: string
  label: string
  description?: string
  icon?: string
}

type NoteRichTextEditorProps = {
  noteId: string
  session: OpenPortClientSession
  contentHtml: string | null
  contentMd: string
  mentionItems: NoteMentionItem[]
  mode: 'write' | 'preview'
  onSnapshot: (snapshot: OpenPortNoteRichSnapshot) => void
  onPresence: (state: OpenPortNoteCollaborationState) => void
  onConnection: (state: 'connecting' | 'online' | 'offline') => void
  resetKey: string
}

function ToolbarButton({
  active,
  disabled,
  icon,
  label,
  onClick
}: {
  active?: boolean
  disabled?: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <IconButton
      aria-label={label}
      active={active}
      className="note-rich-toolbar-button"
      disabled={disabled}
      onClick={onClick}
      size="md"
      type="button"
      variant="ghost"
    >
      <Iconify icon={icon} size={16} />
    </IconButton>
  )
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function NoteRichTextEditor({
  noteId,
  session,
  contentHtml,
  contentMd,
  mentionItems,
  mode,
  onSnapshot,
  onPresence,
  onConnection,
  resetKey
}: NoteRichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const realtime = useMemo(
    () => new OpenPortNoteRealtime(noteId, session, '', {
      onPresence,
      onConnection
    }),
    [noteId, onConnection, onPresence, session]
  )

  const slashCommandItems = useMemo<NoteSlashCommandItem[]>(() => [
    {
      id: 'heading-1',
      label: 'Heading 1',
      description: 'Insert a primary heading',
      icon: 'H1',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
      }
    },
    {
      id: 'heading-2',
      label: 'Heading 2',
      description: 'Insert a section heading',
      icon: 'H2',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
      }
    },
    {
      id: 'heading-3',
      label: 'Heading 3',
      description: 'Insert a compact heading',
      icon: 'H3',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
      }
    },
    {
      id: 'bullet-list',
      label: 'Bullet list',
      description: 'Create a bulleted list',
      icon: '•',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      }
    },
    {
      id: 'task-list',
      label: 'Task list',
      description: 'Track checklist items',
      icon: '☑',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      }
    },
    {
      id: 'quote',
      label: 'Quote',
      description: 'Insert a quote block',
      icon: '❝',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      }
    },
    {
      id: 'code',
      label: 'Code block',
      description: 'Insert a fenced code block',
      icon: '</>',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      }
    },
    {
      id: 'table',
      label: 'Table',
      description: 'Insert a 3 x 3 table',
      icon: '▦',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      }
    },
    {
      id: 'divider',
      label: 'Divider',
      description: 'Insert a horizontal rule',
      icon: '―',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      }
    },
    {
      id: 'image',
      label: 'Image',
      description: 'Upload and insert an image',
      icon: '🖼',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        imageInputRef.current?.click()
      }
    }
  ], [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false
      }),
      Placeholder.configure({
        placeholder: 'Write the note',
        showOnlyWhenEditable: false
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Link.configure({
        openOnClick: false
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'note-rich-mention'
        },
        renderHTML({ options, node }) {
          return [
            'span',
            mergeAttributes(options.HTMLAttributes, {
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label || node.attrs.id,
              'data-mention-suggestion-char': '@'
            }),
            `@${node.attrs.label || node.attrs.id}`
          ]
        },
        renderText({ node }) {
          return `@${node.attrs.label || node.attrs.id}`
        },
        suggestion: {
          char: '@',
          items: ({ query }) => {
            const value = query.trim().toLowerCase()
            return mentionItems.filter((item) => {
              if (!value) return true
              const haystack = `${item.label} ${item.description || ''}`.toLowerCase()
              return haystack.includes(value)
            }).slice(0, 8)
          },
          render: createSuggestionRenderer<NoteMentionItem>()
        }
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'note-rich-image'
        }
      }),
      TableKit.configure({
        table: {
          resizable: true
        }
      }),
      NoteSlashCommands.configure({
        items: slashCommandItems
      }),
      NoteDragHandle,
      realtime.getExtension()
    ],
    content: '',
    editable: mode === 'write',
    editorProps: {
      attributes: {
        class: 'note-rich-editor prose'
      },
      handlePaste: (_view, event) => {
        const clipboardItems = Array.from(event.clipboardData?.items || [])
        const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'))
        const imageFile = imageItem?.getAsFile()
        if (!imageFile || !editor) return false

        event.preventDefault()
        void insertImageFile(imageFile, 'Pasted image')
        return true
      }
    }
  })

  const insertImageFile = useCallback(async (file: File | null, fallbackAlt?: string) => {
    if (!file || !editor) return
    const dataUrl = await readImageAsDataUrl(file)
    const response = await uploadOpenPortNoteImage({
      noteId,
      fileName: file.name,
      dataUrl
    }, session)

    editor.chain().focus().setImage({
      src: response.asset.proxyPath,
      alt: file.name || fallbackAlt || 'Image'
    }).run()
  }, [editor, noteId, session])

  const promptForLink = useCallback(() => {
    if (!editor || typeof window === 'undefined') return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const nextUrl = window.prompt('Enter a URL', previousUrl || 'https://')
    if (nextUrl === null) return
    if (!nextUrl.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: nextUrl.trim() }).run()
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const snapshotGetter = () => buildNoteRichSnapshot(editor.getHTML())
    realtime.setEditor(editor, snapshotGetter)
    void realtime.connect()

    return () => {
      realtime.destroy()
      editor.destroy()
    }
  }, [editor, realtime])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(mode === 'write')
    realtime.setMode(mode === 'write' ? 'editing' : 'viewing')
  }, [editor, mode, realtime])

  useEffect(() => {
    if (!editor) return
    let cancelled = false

    void (async () => {
      const initialHtml = await toInitialRichHtml(contentHtml, contentMd)
      if (cancelled) return
      if (!editor.getText().trim() && initialHtml) {
        editor.commands.setContent(initialHtml, {
          emitUpdate: true
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editor, contentHtml, contentMd, noteId])

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      onSnapshot(buildNoteRichSnapshot(editor.getHTML()))
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, onSnapshot])

  useEffect(() => {
    if (!editor) return
    let cancelled = false

    void (async () => {
      const nextHtml = await toInitialRichHtml(contentHtml, contentMd)
      if (cancelled) return
      realtime.replaceContent(nextHtml)
    })()

    return () => {
      cancelled = true
    }
  }, [contentHtml, contentMd, editor, realtime, resetKey])

  if (!editor) {
    return <div className="note-rich-loading">Loading editor…</div>
  }

  const isEditable = mode === 'write'
  const isListActive = editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')
  const listItemType = editor.isActive('taskList') ? 'taskItem' : 'listItem'

  return (
    <div className={`note-rich-shell${mode === 'preview' ? ' is-preview' : ''}`}>
      <input
        accept="image/*"
        className="note-rich-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0] || null
          void insertImageFile(file)
          event.target.value = ''
        }}
        ref={imageInputRef}
        type="file"
      />

      {isEditable ? (
        <div className="note-rich-toolbar">
          <div className="note-rich-toolbar-group">
            <ToolbarButton
              active={editor.isActive('bold')}
              icon="solar:text-bold-outline"
              label="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              active={editor.isActive('italic')}
              icon="solar:text-italic-outline"
              label="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              active={editor.isActive('strike')}
              icon="solar:text-cross-circle-outline"
              label="Strike"
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              active={editor.isActive('link')}
              icon="solar:link-outline"
              label="Link"
              onClick={promptForLink}
            />
            <ToolbarButton
              active={editor.isActive('code')}
              icon="solar:code-outline"
              label="Inline code"
              onClick={() => editor.chain().focus().toggleCode().run()}
            />
          </div>

          <div className="note-rich-toolbar-group">
            <ToolbarButton
              active={editor.isActive('bulletList')}
              icon="solar:list-outline"
              label="Bullet list"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              active={editor.isActive('orderedList')}
              icon="solar:sort-outline"
              label="Ordered list"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              active={editor.isActive('taskList')}
              icon="solar:checklist-outline"
              label="Task list"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            />
            <ToolbarButton
              active={editor.isActive('blockquote')}
              icon="solar:quote-up-outline"
              label="Blockquote"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
              active={editor.isActive('codeBlock')}
              icon="solar:square-code-outline"
              label="Code block"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
          </div>

          <div className="note-rich-toolbar-group">
            <ToolbarButton
              active={editor.isActive('heading', { level: 1 })}
              icon="solar:text-bold-square-outline"
              label="Heading 1"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolbarButton
              active={editor.isActive('heading', { level: 2 })}
              icon="solar:text-outline"
              label="Heading 2"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolbarButton
              active={editor.isActive('heading', { level: 3 })}
              icon="solar:text-circle-outline"
              label="Heading 3"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            />
            <ToolbarButton
              disabled={!isListActive}
              icon="solar:arrow-left-outline"
              label="Lift list"
              onClick={() => editor.chain().focus().liftListItem(listItemType).run()}
            />
            <ToolbarButton
              disabled={!isListActive}
              icon="solar:arrow-right-outline"
              label="Sink list"
              onClick={() => editor.chain().focus().sinkListItem(listItemType).run()}
            />
            <ToolbarButton
              active={editor.isActive('table')}
              icon="solar:table-outline"
              label="Insert table"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            />
            <ToolbarButton
              icon="solar:gallery-add-outline"
              label="Insert image"
              onClick={() => imageInputRef.current?.click()}
            />
            <ToolbarButton
              icon="solar:minus-square-outline"
              label="Divider"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />
          </div>
        </div>
      ) : null}

      {isEditable ? (
        <BubbleMenu
          className="note-rich-bubble-menu"
          editor={editor}
          options={{ placement: 'top' }}
          shouldShow={({ editor: currentEditor, from, to }) => from !== to && currentEditor.isEditable}
        >
          <ToolbarButton
            active={editor.isActive('bold')}
            icon="solar:text-bold-outline"
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            icon="solar:text-italic-outline"
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={editor.isActive('strike')}
            icon="solar:text-cross-circle-outline"
            label="Strike"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            active={editor.isActive('link')}
            icon="solar:link-outline"
            label="Link"
            onClick={promptForLink}
          />
          <ToolbarButton
            active={editor.isActive('code')}
            icon="solar:code-outline"
            label="Inline code"
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
        </BubbleMenu>
      ) : null}

      {isEditable ? (
        <FloatingMenu
          className="note-rich-floating-menu"
          editor={editor}
          options={{ placement: 'left-start' }}
          shouldShow={({ editor: currentEditor, state }) => {
            const { $from } = state.selection
            const currentLineIsEmpty = $from.parent.textContent.length === 0
            return currentEditor.isEditable && currentLineIsEmpty
          }}
        >
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:text-outline" size={14} />
            <span>Heading</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:list-outline" size={14} />
            <span>Bullet list</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:checklist-outline" size={14} />
            <span>Task list</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:quote-up-outline" size={14} />
            <span>Quote</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:square-code-outline" size={14} />
            <span>Code block</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:table-outline" size={14} />
            <span>Table</span>
          </TextButton>
          <TextButton
            className="note-rich-floating-action"
            onClick={() => imageInputRef.current?.click()}
            size="sm"
            type="button"
            variant="inline"
          >
            <Iconify icon="solar:gallery-add-outline" size={14} />
            <span>Image</span>
          </TextButton>
        </FloatingMenu>
      ) : null}

      <div className={`note-rich-canvas${mode === 'preview' ? ' is-preview' : ''}`}>
        <EditorContent editor={editor} />
      </div>

      {isEditable && editor.isActive('table') ? (
        <div className="note-rich-table-bar">
          <TextButton className="note-rich-table-action" onClick={() => editor.chain().focus().addColumnBefore().run()} variant="inline" type="button">
            <span>Add col before</span>
          </TextButton>
          <TextButton className="note-rich-table-action" onClick={() => editor.chain().focus().addColumnAfter().run()} variant="inline" type="button">
            <span>Add col after</span>
          </TextButton>
          <TextButton className="note-rich-table-action" onClick={() => editor.chain().focus().addRowBefore().run()} variant="inline" type="button">
            <span>Add row before</span>
          </TextButton>
          <TextButton className="note-rich-table-action" onClick={() => editor.chain().focus().addRowAfter().run()} variant="inline" type="button">
            <span>Add row after</span>
          </TextButton>
          <TextButton
            className="note-rich-table-action"
            danger
            onClick={() => editor.chain().focus().deleteTable().run()}
            variant="inline"
            type="button"
          >
            <span>Delete table</span>
          </TextButton>
        </div>
      ) : null}
    </div>
  )
}
