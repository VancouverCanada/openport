'use client'

import { Extension } from '@tiptap/core'
import { listDragHandlePlugin } from './list-drag-handle-plugin.js'

export const NoteDragHandle = Extension.create({
  name: 'openportNoteDragHandle',

  addProseMirrorPlugins() {
    return [
      listDragHandlePlugin({
        getEditor: () => this.editor
      })
    ]
  }
})
