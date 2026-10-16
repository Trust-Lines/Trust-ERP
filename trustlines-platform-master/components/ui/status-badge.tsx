import * as React from "react"

import { cn } from "@/lib/utils"
import { findStatusTag, type StatusGroup } from "@/lib/status/tags"

const SIZE = {
  sm: "h-5 gap-1 px-2 text-[10px] [&_svg]:size-3",
  md: "h-6 gap-1 px-2.5 text-[11px] [&_svg]:size-3.5",
  lg: "h-7 gap-1.5 px-3 text-[12px] [&_svg]:size-3.5",
} as const

type StatusBadgeProps = {
  group: StatusGroup
  /** Status key ("in_production") or label ("In Production"). */
  status: string
  size?: keyof typeof SIZE
  /** Icon on by default — colour is never the only signal. */
  showIcon?: boolean
  /** Show this text instead of the tag's own name (e.g. CRM keeps its ClickUp stage names). */
  label?: React.ReactNode
  className?: string
}

/**
 * Status tag from lib/status/tags.ts: its hue (soft tint) + Lucide icon + label.
 * An unknown status still renders (slate, raw text) so the screen doesn't break,
 * but it means a mapping row is missing in lib/status/tags.ts.
 */
function StatusBadge({ group, status, size = "md", showIcon = true, label, className }: StatusBadgeProps) {
  const tag = findStatusTag(group, status)
  const Icon = tag?.icon
  return (
    <span
      data-slot="status-badge"
      data-status={tag?.key ?? "unmapped"}
      className={cn("status-tag inline-flex w-fit shrink-0 items-center rounded-tag font-medium leading-[1.5] whitespace-nowrap", SIZE[size], className)}
      style={{ "--tag": `var(--color-tag-${tag?.hue ?? "slate"})` } as React.CSSProperties}
    >
      {showIcon && Icon && <Icon aria-hidden />}
      {label ?? tag?.label ?? status}
    </span>
  )
}

export { StatusBadge }
export type { StatusBadgeProps }
