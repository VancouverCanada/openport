'use client'

import DOMPurify from 'dompurify'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { marked } from 'marked'
import TurndownService from 'turndown'

const turndownService = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx'
})

turndownService.escape = (value) => value
turndownService.use(gfm)

turndownService.addRule('tableHeaders', {
  filter: 'th',
  replacement(content) {
    return content
  }
})

turndownService.addRule('tables', {
  filter: 'table',
  replacement(_content, node) {
    const rows = Array.from((node as HTMLElement).querySelectorAll('tr'))
    if (rows.length === 0) return ''

    let markdown = '\n'
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('th, td'))
      const cellContents = cells.map((cell) => {
        let cellContent = turndownService.turndown(cell.innerHTML).trim()
        cellContent = cellContent.replace(/^\n+|\n+$/g, '')
        return cellContent
      })

      markdown += `| ${cellContents.join(' | ')} |\n`
      if (rowIndex === 0) {
        markdown += `| ${cells.map(() => '---').join(' | ')} |\n`
      }
    })

    return `${markdown}\n`
  }
})

turndownService.addRule('taskListItems', {
  filter(node) {
    return node.nodeName === 'LI'
      && (node.getAttribute('data-checked') === 'true' || node.getAttribute('data-checked') === 'false')
  },
  replacement(content, node) {
    const checked = node.getAttribute('data-checked') === 'true'
    return `- [${checked ? 'x' : ' '}] ${content.replace(/^\s+/, '')}\n`
  }
})

turndownService.addRule('mentions', {
  filter(node) {
    return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'mention'
  },
  replacement(_content, node) {
    const id = node.getAttribute('data-id') || ''
    const trigger = node.getAttribute('data-mention-suggestion-char') || '@'
    return `<${trigger}${id}>`
  }
})

marked.use({
  breaks: true,
  gfm: true
})

function expandMentionShortcodes(markdown: string): string {
  return markdown.replace(/<@([a-zA-Z0-9._:@\-]+)>/g, (_match, id: string) => {
    const safeId = DOMPurify.sanitize(id, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
    if (!safeId) return ''
    return `<span class="note-rich-mention" data-type="mention" data-id="${safeId}" data-label="${safeId}" data-mention-suggestion-char="@">@${safeId}</span>`
  })
}

export type OpenPortNoteRichSnapshot = {
  contentHtml: string | null
  contentMd: string
  excerpt: string
  text: string
}

function normalizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-type', 'data-checked', 'data-id', 'data-label', 'data-mention-suggestion-char']
  })
    .replace(/<p><\/p>/g, '')
    .replace(/<p>\s*<\/p>/g, '')
    .trim()
}

export function htmlToMarkdown(html: string): string {
  const normalized = normalizeHtml(html)
  if (!normalized) return ''
  return turndownService.turndown(normalized).trim()
}

export function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const div = window.document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim()
}

export function htmlToExcerpt(html: string): string {
  return htmlToPlainText(html).slice(0, 180)
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const value = markdown.trim()
  if (!value) return ''
  return await marked.parse(expandMentionShortcodes(value))
}

export async function toInitialRichHtml(contentHtml: string | null, contentMd: string): Promise<string> {
  if (contentHtml?.trim()) return contentHtml.trim()
  return markdownToHtml(contentMd)
}

export function buildNoteRichSnapshot(html: string): OpenPortNoteRichSnapshot {
  const normalized = normalizeHtml(html)
  const markdown = normalized ? htmlToMarkdown(normalized) : ''
  const text = normalized ? htmlToPlainText(normalized) : ''

  return {
    contentHtml: normalized || null,
    contentMd: markdown,
    excerpt: text.slice(0, 180),
    text
  }
}
