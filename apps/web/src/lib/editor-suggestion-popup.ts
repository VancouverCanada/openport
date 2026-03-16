'use client'

type SuggestionItem = {
  id: string
  label: string
  description?: string
  icon?: string
  command?: (context: { editor: unknown; range: { from: number; to: number } }) => void
}

type SuggestionRendererProps<T extends SuggestionItem> = {
  query?: string
  items: T[]
  command: (item: T) => void
  clientRect?: (() => DOMRect | null) | null
}

type SuggestionKeyProps = {
  event: KeyboardEvent
}

function buildItemMarkup(item: SuggestionItem, active: boolean): string {
  const icon = item.icon ? `<span class="note-suggestion-icon">${item.icon}</span>` : ''
  const description = item.description
    ? `<span class="note-suggestion-description">${item.description}</span>`
    : ''

  return `
    <button class="note-suggestion-item${active ? ' is-active' : ''}" data-item-id="${item.id}" type="button">
      ${icon}
      <span class="note-suggestion-copy">
        <strong>${item.label}</strong>
        ${description}
      </span>
    </button>
  `
}

function positionPopup(container: HTMLElement | null, clientRect?: (() => DOMRect | null) | null): void {
  if (!container || !clientRect) return
  const rect = clientRect()
  if (!rect) return

  container.style.left = `${Math.max(12, rect.left)}px`
  container.style.top = `${rect.bottom + 8}px`
}

export function createSuggestionRenderer<T extends SuggestionItem>(): () => {
  onStart: (props: SuggestionRendererProps<T>) => void
  onUpdate: (props: SuggestionRendererProps<T>) => void
  onKeyDown: (props: SuggestionKeyProps) => boolean
  onExit: () => void
} {
  return function suggestionRenderer() {
    let container: HTMLDivElement | null = null
    let propsRef: SuggestionRendererProps<T> | null = null
    let selectedIndex = 0

    const render = () => {
      if (!container || !propsRef) return
      const items = propsRef.items
      if (!items.length) {
        container.innerHTML = '<div class="note-suggestion-empty">No matches</div>'
        return
      }

      selectedIndex = Math.min(selectedIndex, items.length - 1)
      container.innerHTML = items
        .map((item, index) => buildItemMarkup(item, index === selectedIndex))
        .join('')

      container.querySelectorAll<HTMLButtonElement>('.note-suggestion-item').forEach((button, index) => {
        button.addEventListener('mousedown', (event) => {
          event.preventDefault()
          propsRef?.command(items[index] as T)
        })
      })

      positionPopup(container, propsRef.clientRect)
    }

    return {
      onStart: (props: SuggestionRendererProps<T>) => {
        propsRef = props
        selectedIndex = 0
        container = document.createElement('div')
        container.className = 'note-suggestion-popup'
        document.body.appendChild(container)
        render()
      },

      onUpdate: (props: SuggestionRendererProps<T>) => {
        propsRef = props
        render()
      },

      onKeyDown: ({ event }: SuggestionKeyProps) => {
        if (!propsRef?.items.length) return false

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          selectedIndex = (selectedIndex + 1) % propsRef.items.length
          render()
          return true
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          selectedIndex = (selectedIndex + propsRef.items.length - 1) % propsRef.items.length
          render()
          return true
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          propsRef.command(propsRef.items[selectedIndex] as T)
          return true
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          container?.remove()
          container = null
          return true
        }

        return false
      },

      onExit: () => {
        container?.remove()
        container = null
        propsRef = null
      }
    }
  }
}
