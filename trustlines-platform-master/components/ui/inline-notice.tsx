import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

const TONES = {
  info: "bg-info-light text-info-dark",
  success: "bg-success-light text-success-dark",
  error: "bg-error-light text-error-dark",
} as const

/** Tinted in-form message (status, success or error) with an optional leading icon. */
function InlineNotice({ tone, icon, className, children, ...props }: { tone: keyof typeof TONES; icon?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start gap-2 rounded-[6px] px-3 py-2 text-[14px]", TONES[tone], className)} {...props}>
      {icon}
      {children}
    </div>
  )
}

export { InlineNotice }
