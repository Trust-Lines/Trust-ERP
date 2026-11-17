import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Label + control + optional hint: the form row used in dialogs. */
function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-ui-body">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-ui-text-secondary">{hint}</span>}
    </div>
  )
}

export { Field }
