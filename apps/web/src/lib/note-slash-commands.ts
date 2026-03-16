'use client'

import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { createSuggestionRenderer } from './editor-suggestion-popup'

export type NoteSlashCommandItem = {
  id: string
  label: string
  description?: string
  icon?: string
  command: (context: { editor: any; range: { from: number; to: number } }) => void
}

type Options = {
  items: NoteSlashCommandItem[]
}

export const NoteSlashCommands = Extension.create<Options>({
  name: 'openportNoteSlashCommands',

  addOptions() {
    return {
      items: []
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: ({ query }) => {
          const value = query.trim().toLowerCase()
          return this.options.items.filter((item) => {
            if (!value) return true
            const haystack = `${item.label} ${item.description || ''}`.toLowerCase()
            return haystack.includes(value)
          }).slice(0, 8)
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        render: createSuggestionRenderer<NoteSlashCommandItem>()
      })
    ]
  }
})
