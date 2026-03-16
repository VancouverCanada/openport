declare module '../lib/list-drag-handle-plugin.js' {
  import type { Plugin } from 'prosemirror-state'

  export function listDragHandlePlugin(options?: Record<string, unknown>): Plugin
}
