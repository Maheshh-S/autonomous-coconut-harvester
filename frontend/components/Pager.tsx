"use client"

import { useTranslations } from "next-intl"

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
  // V5.0: pager chrome comes from the common dictionary.
  const t = useTranslations("common")
  if (totalPages <= 1) return null

  return (
    <div className="pager">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        aria-label={t("prevPage")}
        className="btn btn-ghost sm"
      >
        {t("previous")}
      </button>
      <span className="muted">
        {t("pageOf", { page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label={t("nextPage")}
        className="btn btn-ghost sm"
      >
        {t("next")}
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
