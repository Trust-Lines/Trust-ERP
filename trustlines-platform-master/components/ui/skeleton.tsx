import * as React from "react"

import { cn } from "@/lib/utils"

/** One grey placeholder shape. Size it with className (h-4 w-32, size-8 rounded-full …). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("rounded-tag bg-primary-100 motion-safe:animate-pulse", className)}
      {...props}
    />
  )
}

/** Wrapper that tells screen readers the area is loading; the shapes inside stay hidden. */
function SkeletonGroup({ label = "Loading…", className, children, ...props }: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

// Line widths vary a little so a block of text doesn't look like a grid.
const LINE_WIDTHS = ["100%", "92%", "96%", "84%", "90%", "70%"]

/** Paragraph placeholder; the last line is shorter, like real text. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 && lines > 1 ? "60%" : LINE_WIDTHS[i % LINE_WIDTHS.length] }} />
      ))}
    </SkeletonGroup>
  )
}

/** Card placeholder: icon square + title + two text lines (KPI cards, quick-view sections). */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <SkeletonGroup className={cn("flex gap-4 rounded-card border border-ui-divider bg-ui-surface-elevated p-4 shadow-01", className)}>
      <Skeleton className="size-12 shrink-0 rounded-card" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
    </SkeletonGroup>
  )
}

/** Table placeholder: header row + `rows` rows of avatar, two lines and two pills. */
function SkeletonTable({ rows = 8, columns = 6, className }: { rows?: number; columns?: number; className?: string }) {
  const headerWidths = ["22%", "18%", "14%", "14%", "12%", "10%", "10%", "10%"].slice(0, columns)
  return (
    <SkeletonGroup className={cn("overflow-hidden rounded-card border border-ui-divider bg-ui-surface-elevated", className)}>
      <div className="flex gap-4 border-b border-ui-divider px-4 py-3">
        {headerWidths.map((w, i) => (
          <Skeleton key={i} className="h-2.5" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-ui-divider px-4 py-3 last:border-b-0">
          <Skeleton className="size-7 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3" style={{ width: `${45 + ((r * 7) % 35)}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${25 + ((r * 5) % 25)}%` }} />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </SkeletonGroup>
  )
}

export { Skeleton, SkeletonGroup, SkeletonText, SkeletonCard, SkeletonTable }
