import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

// Figma: DAY 02 › Approval (Task 6) › Dashboard — "Approvals 14 +3.5%", "Projects 32 −1.3%",
// and the wide "Tasks 2" card with a list beside it.
// Card 145px high, 16px radius, 14px padding; 55px icon tile (8px radius); label 14px; value 30px semibold.
const kpiCardVariants = cva(
  "relative flex min-h-[145px] gap-3.5 rounded-modal p-3.5 text-primary-50 shadow-02",
  {
    variants: {
      tone: {
        default: "bg-primary-800",
        muted: "bg-primary-700",
      },
    },
    defaultVariants: { tone: "default" },
  }
)

type Trend = {
  /** Percentage change, e.g. 3.5 or -1.3. Shown as "+ 3.5%" / "- 1.3%". */
  value: number
  /** Which direction is good news. Default "up" (more approvals = green). Use "down" for e.g. overdue items. */
  goodWhen?: "up" | "down"
  /** Screen-reader text, e.g. "versus last month". */
  context?: string
}

type KpiCardProps = VariantProps<typeof kpiCardVariants> & {
  /** Lucide icon element. Drawn in the card colour on the light tile. */
  icon: React.ReactNode
  label: string
  /** Already formatted, e.g. 14, "$277K". */
  value: React.ReactNode
  trend?: Trend
  /** Small status chip in the trend spot when a % change doesn't apply, e.g. { label: "3 overdue", tone: "error" }. */
  badge?: { label: string; tone: "success" | "error" | "warning" | "neutral" }
  /** Makes the whole card a link (e.g. to the list behind the number). */
  href?: string
  /** Shows placeholders instead of label / value / trend. */
  loading?: boolean
  /** Extra content on the right — e.g. <KpiCardRow> items, as in the Figma "Tasks" card. */
  children?: React.ReactNode
  className?: string
}

function TrendChip({ value, goodWhen = "up", context }: Trend) {
  const up = value >= 0
  const good = value === 0 ? null : up === (goodWhen === "up")
  return (
    <span
      className={cn(
        "inline-flex h-[21px] shrink-0 items-center rounded-tag px-1.5 text-caption",
        good === null && "bg-grey-100 text-grey-700",
        good === true && "bg-success-light text-success-dark",
        good === false && "bg-error-light text-error-dark"
      )}
    >
      <span aria-hidden>{`${up ? "+" : "-"} ${Math.abs(value)}%`}</span>
      <span className="sr-only">{`${up ? "Up" : "Down"} ${Math.abs(value)} percent${context ? ` ${context}` : ""}`}</span>
    </span>
  )
}

const BADGE_TONE = {
  success: "bg-success-light text-success-dark",
  error: "bg-error-light text-error-dark",
  warning: "bg-warning-light text-warning-dark",
  neutral: "bg-grey-100 text-grey-700",
} as const

function KpiCard({ icon, label, value, trend, badge, href, loading = false, tone, children, className }: KpiCardProps) {
  const iconTone = tone === "muted" ? "text-primary-700" : "text-primary-800"
  const body = (
    <>
      <div className={cn("flex min-w-0 flex-col", !children && "w-full flex-1")}>
        <span aria-hidden className={cn("grid size-[55px] shrink-0 place-items-center rounded-control bg-primary-50 [&_svg]:size-6", iconTone)}>
          {icon}
        </span>
        {loading ? (
          <div role="status" aria-busy="true" className="mt-auto space-y-2 pt-2.5">
            <span className="sr-only">Loading {label}</span>
            <Skeleton className="h-3.5 w-20 bg-primary-600" />
            <Skeleton className="h-7 w-12 bg-primary-600" />
          </div>
        ) : (
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <dl className="min-w-0">
              <dt className="truncate text-body-sm">{label}</dt>
              <dd className="text-h2 leading-[1.1] tabular-nums">{value}</dd>
            </dl>
            {trend && !children && <TrendChip {...trend} />}
            {badge && !trend && !children && (
              <span className={cn("inline-flex h-[21px] shrink-0 items-center rounded-tag px-1.5 text-caption", BADGE_TONE[badge.tone])}>{badge.label}</span>
            )}
          </div>
        )}
      </div>
      {children && <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>}
    </>
  )

  const classes = cn(kpiCardVariants({ tone }), children ? "flex-row" : "flex-col", className)
  if (href) {
    return (
      <Link
        href={href}
        data-slot="kpi-card"
        className={cn(classes, "outline-none transition-shadow hover:shadow-03 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring")}
      >
        {body}
      </Link>
    )
  }
  return <div data-slot="kpi-card" className={classes}>{body}</div>
}

// Row inside a wide KPI card (Figma "High Priority · Provision - Approval Request · 10/09/2026").
const rowTileTone = {
  error: "bg-error-light text-error-dark",
  warning: "bg-warning-light text-warning-dark",
  info: "bg-info-light text-info-dark",
  neutral: "bg-grey-100 text-grey-700",
} as const

type KpiCardRowProps = {
  icon: React.ReactNode
  tone?: keyof typeof rowTileTone
  title: string
  subtitle?: string
  meta?: string
  href?: string
}

function KpiCardRow({ icon, tone = "neutral", title, subtitle, meta, href }: KpiCardRowProps) {
  const inner = (
    <>
      <span aria-hidden className={cn("grid size-[41px] shrink-0 place-items-center rounded-tag [&_svg]:size-6", rowTileTone[tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-bold">{title}</span>
        {subtitle && <span className="block truncate text-caption">{subtitle}</span>}
      </span>
      {meta && <span className="shrink-0 self-start text-caption">{meta}</span>}
    </>
  )
  const cls = "flex min-h-[55px] items-center gap-2.5 rounded-control bg-primary-600 px-1.5 py-1.5 pr-3.5 text-primary-50"
  return href ? (
    <Link href={href} className={cn(cls, "outline-none hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring")}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

export { KpiCard, KpiCardRow, kpiCardVariants }
export type { KpiCardProps, KpiCardRowProps, Trend }
