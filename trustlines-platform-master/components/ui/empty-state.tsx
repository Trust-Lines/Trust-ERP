import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// What a list, card or page shows when it has nothing to display.
//  size "md" — centred block: icon, title, optional description and action (page / table level)
//  size "sm" — one quiet line inside a card ("No contacts yet.")
//  boxed     — dashed outline, for a standalone area such as an empty board column
const emptyStateVariants = cva("text-primary-500", {
  variants: {
    size: {
      sm: "flex items-center gap-2 py-2 text-meta",
      md: "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
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
  }

function EmptyState({ icon, title, description, action, size, boxed, className, ...props }: EmptyStateProps) {
  if (size === "sm") {
    return (
      <div data-slot="empty-state" role="status" className={cn(emptyStateVariants({ size, boxed }), className)} {...props}>
        {icon && <span aria-hidden className="shrink-0 text-primary-400 [&_svg]:size-4">{icon}</span>}
        <span>
          {title}
          {description && <span className="text-primary-400"> {description}</span>}
        </span>
      </div>
    )
  }
  return (
    <div data-slot="empty-state" role="status" className={cn(emptyStateVariants({ size, boxed }), className)} {...props}>
      {icon && (
        <span aria-hidden className="grid size-12 place-items-center rounded-full border border-ui-divider bg-primary-50 text-primary-400 shadow-01 [&_svg]:size-6">
          {icon}
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-body-sm font-semibold text-primary-800">{title}</p>
        {description && <p className="text-meta text-primary-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
export type { EmptyStateProps }
