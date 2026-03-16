'use client'

import type { ReactNode } from 'react'
import type { OpenPortSearchHighlight } from '@openport/product-contracts'
import { resolveSearchHighlights } from '../lib/workspace-search'

type SearchHighlightProps = {
  text: string
  highlights: OpenPortSearchHighlight[]
  field: 'title' | 'excerpt'
  queryTerms?: string[]
}

export function SearchHighlight({ text, highlights, field, queryTerms = [] }: SearchHighlightProps) {
  const resolvedHighlights = resolveSearchHighlights(text, field, highlights, queryTerms)
  if (!resolvedHighlights.length) return text

  const segments: ReactNode[] = []
  let cursor = 0

  resolvedHighlights.forEach((highlight, index) => {
    if (highlight.start > cursor) {
      segments.push(text.slice(cursor, highlight.start))
    }

    segments.push(
      <mark key={`${highlight.start}-${highlight.end}-${index}`} className="search-highlight">
        {text.slice(highlight.start, highlight.end)}
      </mark>
    )

    cursor = highlight.end
  })

  if (cursor < text.length) {
    segments.push(text.slice(cursor))
  }

  return <>{segments}</>
}
