'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { OpenPortChatAttachment } from '@openport/product-contracts'
import { Iconify } from '../iconify'

type MessageBubbleProps = {
  attachments?: OpenPortChatAttachment[]
  children: ReactNode
  className?: string
  label?: ReactNode
  role: 'assistant' | 'user'
  style?: CSSProperties
}

export function MessageBubble({ attachments = [], children, className = '', label, role, style }: MessageBubbleProps) {
  return (
    <article className={`message-bubble ${role}${className ? ` ${className}` : ''}`} data-message-role={role} style={style}>
      <span className="message-role">{label || (role === 'assistant' ? 'AI' : 'You')}</span>
      {attachments.length > 0 ? (
        <div className="message-bubble-attachments">
          {attachments.map((attachment) =>
            attachment.contentUrl ? (
              <a className="message-bubble-attachment" href={attachment.contentUrl} key={attachment.id} rel="noreferrer" target="_blank">
                <Iconify icon={attachment.type === 'web' ? 'solar:global-outline' : 'solar:folder-with-files-outline'} size={13} />
                <span>{attachment.label}</span>
              </a>
            ) : (
              <span className="message-bubble-attachment" key={attachment.id}>
                <Iconify icon={attachment.type === 'web' ? 'solar:global-outline' : 'solar:folder-with-files-outline'} size={13} />
                <span>{attachment.label}</span>
              </span>
            )
          )}
        </div>
      ) : null}
      {children}
    </article>
  )
}
