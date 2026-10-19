"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Page numbers to show: always first + last, up to one neighbour each side of the current page, "…" for gaps. */
function pageList(page: number, pageCount: number): (number | "gap")[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount))
  const sorted = [...keep].sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap")
    out.push(p)
  })
  return out
}

const box =
  "grid size-8 place-items-center rounded-[4px] text-[13px] leading-[1.5] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"

type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

// Figma: 32px squares, 2px gap. Current page = accent-500 fill, semibold 15px. Other pages = primary-50 + primary-700 border.
// Prev/next: disabled = grey-100 fill, grey-200 chevron; enabled = primary-700 fill, primary-50 chevron.
function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null
  const arrow = (dir: -1 | 1) => {
    const target = page + dir
    const disabled = target < 1 || target > pageCount
    const Icon = dir < 0 ? ChevronLeftIcon : ChevronRightIcon
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPageChange(target)}
        aria-label={dir < 0 ? "Previous page" : "Next page"}
        className={cn(box, "bg-primary-700 text-primary-50 hover:bg-primary-950 dark:bg-primary-100 dark:text-primary-950 dark:hover:bg-primary-50 disabled:bg-grey-100 disabled:text-grey-200 dark:disabled:bg-primary-700 dark:disabled:text-primary-500")}
      >
        <Icon className="size-4" />
      </button>
    )
  }
  return (
    <nav aria-label="Pagination" data-slot="pagination" className={className}>
      <ul className="flex items-center gap-0.5">
        <li>{arrow(-1)}</li>
        {pageList(page, pageCount).map((p, i) => (
          <li key={p === "gap" ? `gap-${i}` : p}>
            {p === "gap" ? (
              <span aria-hidden className={cn(box, "border border-primary-700 dark:border-primary-500 bg-primary-50 dark:bg-primary-800 text-primary-700 dark:text-primary-100")}>..</span>
            ) : (
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  box,
                  p === page
                    ? "bg-accent-500 text-[15px] font-semibold text-primary-50"
                    : "border border-primary-700 dark:border-primary-500 bg-primary-50 dark:bg-primary-800 text-primary-700 dark:text-primary-100 hover:bg-primary-100 dark:hover:bg-primary-700"
                )}
              >
                {p}
              </button>
            )}
          </li>
        ))}
        <li>{arrow(1)}</li>
      </ul>
    </nav>
  )
}

export { Pagination, pageList }
export type { PaginationProps }
