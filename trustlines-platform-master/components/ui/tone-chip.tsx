import { isValidElement, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Figma Status Chip: status tone (T0–T10 background + text from app/globals.css) + icon + label.
 * Use StatusBadge when the value is a status key from lib/status/tags.ts; use this for a free tone.
 * `icon` is a Lucide icon (drawn at `iconSize`) or a ready element.
 */
function ToneChip({ tone, icon, iconSize = 14, className, children }: {
  tone: string
  icon?: LucideIcon | ReactNode
  iconSize?: number
  className?: string
  children: ReactNode
}) {
  let iconNode: ReactNode = null
  if (isValidElement(icon)) iconNode = icon
  else if (icon) {
    const Icon = icon as LucideIcon
    iconNode = <Icon size={iconSize} aria-hidden />
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 whitespace-nowrap", className)}
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      {iconNode}
      {children}
    </span>
  )
}

export { ToneChip }
