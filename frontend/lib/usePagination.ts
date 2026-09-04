import { useMemo, useState } from "react"

export const PAGE_SIZE = 8

/**
 * Client-side pagination over an in-memory list.
 * Behavior-preserving: it only slices what is rendered; it never mutates the
 * source array. The pager auto-hides when totalPages <= 1.
 */
export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  function go(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)))
  }

  return {
    page: safePage,
    totalPages,
    slice,
    pageSize,
    prev: () => go(safePage - 1),
    next: () => go(safePage + 1),
    go,
  }
}
