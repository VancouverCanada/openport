'use client'

import { TextButton } from './text-button'

type WorkspacePaginationProps = {
  onNext: () => void
  onPrevious: () => void
  page: number
  total: number
  totalPages: number
}

export function WorkspacePagination({
  onNext,
  onPrevious,
  page,
  total,
  totalPages
}: WorkspacePaginationProps) {
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  return (
    <div className="workspace-module-chip-row workspace-pagination">
      <span className="workspace-pagination-metric">
        {total} total
      </span>
      <span className="workspace-pagination-metric">
        Page {page} / {totalPages}
      </span>
      <TextButton
        active={hasPrevious}
        className="workspace-pagination-action"
        disabled={!hasPrevious}
        onClick={onPrevious}
        size="sm"
        type="button"
        variant="inline"
      >
        Previous
      </TextButton>
      <TextButton
        active={hasNext}
        className="workspace-pagination-action"
        disabled={!hasNext}
        onClick={onNext}
        size="sm"
        type="button"
        variant="inline"
      >
        Next
      </TextButton>
    </div>
  )
}
