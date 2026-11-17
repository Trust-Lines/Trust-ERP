import { useId, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Same label + control + hint row, in the three spacings the screens use.
const VARIANT = {
  /** PR workspace, email campaigns. */
  default: { root: "gap-1", label: "text-ui-body" },
  /** Figma form field: 7px gap, 16px label line (Design job sheet, Project types). */
  loose: { root: "min-w-0 gap-[7px]", label: "leading-4 text-ui-body" },
  /** Dialog forms with heading-coloured labels (HR, Trust Stock). */
  form: { root: "min-w-0 gap-1.5", label: "text-ui-heading" },
} as const

/**
 * Label + control + optional hint: the form row used in dialogs.
 * Pass `children` as a function to get a generated id for the control; the label then points at it.
 */
function Field({ label, htmlFor, hint, variant = "default", className, children }: {
  label: string
  htmlFor?: string
  hint?: string
  variant?: keyof typeof VARIANT
  className?: string
  children: ReactNode | ((id: string) => ReactNode)
}) {
  const autoId = useId()
  const v = VARIANT[variant]
  const id = typeof children === "function" ? autoId : htmlFor
  return (
    <div className={cn("flex flex-col", v.root, className)}>
      <label htmlFor={id} className={cn("text-[12px] font-medium", v.label)}>{label}</label>
      {typeof children === "function" ? children(autoId) : children}
      {hint && <span className="text-[11px] text-ui-text-secondary">{hint}</span>}
    </div>
  )
}

export { Field }
