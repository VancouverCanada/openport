'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatShortcutKey, shortcutsByCategory } from '../lib/shortcuts'
import { ModalShell } from './ui/modal-shell'

type KeyboardShortcutsModalProps = {
  onClose: () => void
  open: boolean
}

const orderedCategories = ['Chat', 'Global', 'Input', 'Message'] as const

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setIsMac(/Mac/i.test(navigator.userAgent))
  }, [])

  const categories = useMemo(
    () =>
      orderedCategories.filter((category) => {
        const items = shortcutsByCategory[category]
        return Array.isArray(items) && items.length > 0
      }),
    []
  )

  return (
    <ModalShell
      backdropClassName="keyboard-shortcuts-backdrop"
      bodyClassName="keyboard-shortcuts-body"
      closeLabel="Close keyboard shortcuts"
      dialogClassName="keyboard-shortcuts-modal"
      headerClassName="keyboard-shortcuts-header"
      onClose={onClose}
      open={open}
      overlayClassName="keyboard-shortcuts-overlay"
      title={<div className="keyboard-shortcuts-title">Keyboard Shortcuts</div>}
    >
          {categories.map((category) => (
            <section key={category} className="keyboard-shortcuts-section">
              <div className="keyboard-shortcuts-section-title">{category}</div>

              <div className="keyboard-shortcuts-list">
                {(shortcutsByCategory[category] ?? []).map((shortcut) => (
                  <div key={shortcut.name} className="keyboard-shortcuts-item">
                    <div className="keyboard-shortcuts-item-copy">
                      <span>{shortcut.name}</span>
                      {shortcut.tooltip ? <span className="keyboard-shortcuts-item-tooltip">{shortcut.tooltip}</span> : null}
                    </div>

                    <div className="keyboard-shortcuts-keys">
                      {shortcut.keys
                        .filter(
                          (key) =>
                            !(key.toLowerCase() === 'delete' && shortcut.keys.some((candidate) => candidate.toLowerCase() === 'backspace'))
                        )
                        .map((key) => (
                          <span key={`${shortcut.name}-${key}`} className="keyboard-shortcuts-key">
                            {formatShortcutKey(key, isMac)}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
    </ModalShell>
  )
}
