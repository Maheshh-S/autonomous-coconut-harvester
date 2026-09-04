"use client"

type PagerProps = {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

/**
 * Shared Prev/Next pager. Auto-hides entirely when there is a single page,
 * so small datasets (<= 8 rows) render no pager footprint at all.
 */
export default function Pager({ page, totalPages, onPrev, onNext }: PagerProps) {
  if (totalPages <= 1) return null

  return (
    <div className="pager">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        aria-label="Previous page"
        className="btn btn-ghost sm"
      >
        Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="btn btn-ghost sm"
      >
        Next
      </button>

      <style jsx>{`
        .pager {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 18px;
        }
      `}</style>
    </div>
  )
}
