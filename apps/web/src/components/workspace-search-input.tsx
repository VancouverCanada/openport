'use client'

import { Iconify } from './iconify'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'
import type { WorkspaceSearchSuggestion } from '../lib/workspace-search'

type WorkspaceSearchInputProps = {
  value: string
  onChange: (value: string) => void
  suggestions: WorkspaceSearchSuggestion[]
  selectedSuggestionIndex: number
  onSuggestionHover: (index: number) => void
  onSuggestionAccept: (suggestion: WorkspaceSearchSuggestion) => void
  onClear: () => void
}

export function WorkspaceSearchInput({
  value,
  onChange,
  suggestions,
  selectedSuggestionIndex,
  onSuggestionHover,
  onSuggestionAccept,
  onClear
}: WorkspaceSearchInputProps) {
  return (
    <div className="workspace-search-input-stack">
      <label className="workspace-search-input">
        <Iconify icon="solar:magnifer-outline" size={18} />
        <input
          aria-label="Search"
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search"
          type="search"
          value={value}
        />
      </label>
      <IconButton aria-label="Clear search" className="workspace-search-close" onClick={onClear} size="md" variant="ghost">
        <Iconify icon="solar:close-outline" size={18} />
      </IconButton>

      {suggestions.length > 0 ? (
        <div className="workspace-search-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <TextButton
              key={suggestion.id}
              className={`workspace-search-suggestion${selectedSuggestionIndex === index ? ' is-selected' : ''}`}
              onClick={() => onSuggestionAccept(suggestion)}
              onMouseEnter={() => onSuggestionHover(index)}
              size="md"
              type="button"
              variant="inline"
            >
              <span className="workspace-search-suggestion-copy">
                <strong>{suggestion.label}</strong>
                <span>{suggestion.description}</span>
              </span>
            </TextButton>
          ))}
        </div>
      ) : null}
    </div>
  )
}
