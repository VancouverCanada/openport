'use client'

import type { OpenPortChatMessage } from '../lib/openport-api'

type AssistantStatusEntry = NonNullable<OpenPortChatMessage['statusHistory']>[number]

type ChatStatusItemProps = {
  entry: AssistantStatusEntry
  formatStatusDescription: (entry: AssistantStatusEntry) => string
  getStatusTags: (entry: AssistantStatusEntry) => string[]
  doneOverride?: boolean
  muted?: boolean
  hideLeadingDot?: boolean
}

export function ChatStatusItem({
  entry,
  formatStatusDescription,
  getStatusTags,
  doneOverride,
  muted = false,
  hideLeadingDot = false
}: ChatStatusItemProps) {
  const isDone = typeof doneOverride === 'boolean' ? doneOverride : entry.done
  const tags = getStatusTags(entry)

  return (
    <div className={muted ? 'owui-status-copy is-muted' : 'owui-status-item'}>
      {muted ? (
        <span className={`owui-status-copy-text${isDone ? '' : ' is-pending'}`}>{formatStatusDescription(entry)}</span>
      ) : (
        <>
          {!hideLeadingDot ? <span className="owui-status-dot" /> : null}
          <span className={`owui-status-copy${isDone ? '' : ' is-pending'}`}>{formatStatusDescription(entry)}</span>
        </>
      )}
      {tags.length > 0 ? (
        <span className="owui-status-queries">
          {tags.map((tag) => (
            <span className="owui-status-query" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  )
}
