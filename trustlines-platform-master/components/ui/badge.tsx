import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Figma: DAY 03 › Other Components › Status (S/M/L) — 20/24/28px, 4px radius, regular 10/11/12px.
// Tones follow the Status Language table (Task 8): same meaning → same tone everywhere.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center rounded-[4px] leading-[1.5] whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-grey-100 text-grey-700 dark:bg-grey-700 dark:text-grey-100",
        info: "bg-info-light text-info-dark dark:bg-info-dark dark:text-info-light",
        accent: "bg-accent-50 text-accent-700 dark:bg-accent-800 dark:text-accent-200",
        warning: "bg-warning-light text-warning-dark dark:bg-warning-dark dark:text-warning-light",
        success: "bg-success-light text-success-dark dark:bg-success-dark dark:text-success-light",
        error: "bg-error-light text-error-dark dark:bg-error-dark dark:text-error-light",
      },
      size: {
        sm: "h-5 gap-1 px-2.5 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        md: "h-6 gap-1 px-3 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-7 gap-1.5 px-4 text-[12px] [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  }
)

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Optional Lucide icon, rendered before the label (Status Language: tone + icon + label). */
    icon?: React.ReactNode
  }

function Badge({ className, tone, size, icon, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
