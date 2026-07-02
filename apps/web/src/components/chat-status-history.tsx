'use client'

import type { OpenPortChatMessage } from '../lib/openport-api'
import { ChatStatusItem } from './chat-status-item'

type AssistantStatusEntry = NonNullable<OpenPortChatMessage['statusHistory']>[number]

type ChatStatusHistoryProps = {
  entries: AssistantStatusEntry[]
  expanded: boolean
  onToggle: () => void
  formatStatusDescription: (entry: AssistantStatusEntry) => string
  getStatusTags: (entry: AssistantStatusEntry) => string[]
}

export function ChatStatusHistory({
  entries,
  expanded,
  onToggle,
  formatStatusDescription,
  getStatusTags
}: ChatStatusHistoryProps) {
  if (entries.length === 0) return null
  const latest = entries.at(-1)
  if (!latest) return null

  return (
    <div className="owui-status-history">
      <button aria-expanded={expanded} className="owui-status-toggle" onClick={onToggle} type="button">
        <ChatStatusItem
          entry={latest}
          formatStatusDescription={formatStatusDescription}
          getStatusTags={getStatusTags}
          hideLeadingDot
        />
      </button>
      {expanded && entries.length > 1 ? (
        <div className="owui-status-list">
          {entries.map((entry, entryIndex) => (
            <div className="owui-status-row" key={`${entry.action}-${entryIndex}`}>
              <div className="owui-status-rail" aria-hidden="true">
                <span className="owui-status-dot is-muted" />
                {entryIndex < entries.length - 1 ? <span className="owui-status-line" /> : null}
              </div>
              <ChatStatusItem
                entry={entry}
                doneOverride
                formatStatusDescription={formatStatusDescription}
                getStatusTags={getStatusTags}
                muted
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
