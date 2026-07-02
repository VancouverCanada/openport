'use client'

import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

marked.use({
  breaks: true,
  gfm: true
})

type ChatMarkdownProps = {
  content: string
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  const html = useMemo(() => {
    const value = (content || '').trim()
    if (!value) return ''
    const parsed = marked.parse(value, { async: false }) as string
    return DOMPurify.sanitize(parsed)
  }, [content])

  return <div className="owui-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
