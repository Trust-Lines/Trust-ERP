import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// What a list, card or page shows when it has nothing to display.
// Figma "Feedback patterns › Empty state / first use": explain the gap, offer the next useful action.
//  size "md" — centred block: icon tile, 20px title, description, action, hint (page / table level)
//  size "sm" — one quiet line inside a card ("No contacts yet.")
//  boxed     — dashed outline, for a standalone area such as an empty board column
const emptyStateVariants = cva("font-[family-name:var(--font-ui)] text-ui-body", {
  variants: {
    size: {
      sm: "flex items-center gap-2 py-2 text-[13px] leading-[1.4]",
      md: "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
    },
    boxed: {
      true: "rounded-card border border-dashed border-ui-input-border bg-ui-surface-elevated",
      false: "",
    },
  },
  defaultVariants: { size: "md", boxed: false },
})

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof emptyStateVariants> & {
    /** Lucide icon element, e.g. <InboxIcon />. Decorative: hidden from screen readers. */
    icon?: React.ReactNode
    title: React.ReactNode
    /** Extra hint, e.g. "Click “New customer” to add the first one." */
    description?: React.ReactNode
    /** Button(s) such as "New customer" or "Clear filters". Shown only at size "md". */
    action?: React.ReactNode
    /** Small line under the action, e.g. "PDF, DWG and images · Up to 25 MB". Shown only at size "md". */
    hint?: React.ReactNode
  }

function EmptyState({ icon, title, description, action, hint, size, boxed, className, ...props }: EmptyStateProps) {
  if (size === "sm") {
    return (
      <div data-slot="empty-state" role="status" className={cn(emptyStateVariants({ size, boxed }), className)} {...props}>
        {icon && <span aria-hidden className="shrink-0 text-ui-text-secondary [&_svg]:size-4">{icon}</span>}
        <span>
          {title}
          {description && <span className="text-ui-text-secondary"> {description}</span>}
        </span>
      </div>
    )
  }
  return (
    <div data-slot="empty-state" role="status" className={cn(emptyStateVariants({ size, boxed }), className)} {...props}>
      {icon && (
        <span aria-hidden className="mb-1 grid size-14 place-items-center rounded-[12px] bg-primary-50 text-ui-body dark:bg-primary-700 [&_svg]:size-6">
          {icon}
        </span>
      )}
      <div className="max-w-md space-y-2">
        <p className="text-[20px] font-semibold leading-[1.3] text-ui-heading">{title}</p>
        {description && <p className="text-[14px] leading-[1.6] text-ui-text-secondary">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
      {hint && <p className="text-caption text-ui-text-secondary">{hint}</p>}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
export type { EmptyStateProps }
