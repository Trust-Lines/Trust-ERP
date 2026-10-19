import * as React from "react"
import { CircleXIcon, LockIcon, ShieldCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

// Figma "Feedback patterns" panels that sit where content would be (light + dark via tokens):
//   ErrorState      — recoverable failure: keep context, offer a safe retry
//   RestrictedState — show the access boundary without exposing protected content
//   LoadingState    — structural placeholders in the final layout, not a blank screen
// Toasts live in feedback-toast.tsx; "nothing here yet" lives in empty-state.tsx.

const panelClass =
  "rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-5 font-[family-name:var(--font-ui)] text-[13px] leading-[1.5] text-ui-body"
const titleClass = "text-[20px] font-semibold leading-[1.3] text-ui-heading"
const tagClass = "inline-flex w-fit items-center gap-1 rounded-[4px] px-2 py-0.5 text-[12px] font-medium"

type ErrorStateProps = {
  /** Short reason chip, e.g. "Connection issue". */
  label?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Small facts that help support, e.g. ["Last synced 16 Oct 2026, 09:40", "Reference: ACT-503"]. */
  meta?: React.ReactNode[]
  /** Retry + secondary action buttons. */
  actions?: React.ReactNode
  className?: string
}

function ErrorState({ label = "Something went wrong", title, description, meta, actions, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn(panelClass, "space-y-3", className)}>
      <span className={cn(tagClass, "bg-error-normal text-white")}>
        <CircleXIcon aria-hidden className="size-3.5" />
        {label}
      </span>
      <p className={titleClass}>{title}</p>
      {description && <p>{description}</p>}
      {meta && meta.length > 0 && (
        <div className="space-y-0.5 text-[12px] text-ui-text-secondary">
          {meta.map((m, i) => <p key={i}>{m}</p>)}
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
    </div>
  )
}

type RestrictedStateProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** Who can grant access, e.g. an avatar + "Maya Chen · Project owner". */
  owner?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

function RestrictedState({ title, description, owner, actions, className }: RestrictedStateProps) {
  return (
    <div className={cn(panelClass, "flex gap-4", className)}>
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-[12px] bg-primary-50 text-ui-body dark:bg-primary-700">
        <ShieldCheckIcon className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <span className={cn(tagClass, "bg-primary-100 text-primary-700 dark:bg-primary-600 dark:text-primary-50")}>
          <LockIcon aria-hidden className="size-3" />
          Restricted
        </span>
        <p className={titleClass}>{title}</p>
        {description && <p>{description}</p>}
        {owner && <div className="flex items-center gap-2 text-[12px] text-ui-text-secondary">{owner}</div>}
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  )
}

type LoadingStateProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Line under the placeholders, e.g. "Fetching the latest project data…". */
  caption?: React.ReactNode
  /** Custom placeholders; defaults to a header + detail rows + block shaped like a detail page. */
  children?: React.ReactNode
  className?: string
}

function LoadingState({ title, description, caption = "Loading…", children, className }: LoadingStateProps) {
  return (
    <SkeletonGroup label={typeof caption === "string" ? caption : "Loading…"} className={cn(panelClass, "space-y-5", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <p className={titleClass}>{title}</p>}
          {description && <p className="text-ui-text-secondary">{description}</p>}
        </div>
      )}
      {children ?? (
        <>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <div className="space-y-3">
            {["w-3/5", "w-2/5", "w-1/2"].map(w => (
              <div key={w} className="flex items-center gap-6">
                <Skeleton className="h-3 w-16" />
                <Skeleton className={cn("h-3", w)} />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-[6px]" />
        </>
      )}
      {caption && <p className="text-[12px] text-ui-text-secondary">{caption}</p>}
    </SkeletonGroup>
  )
}

export { ErrorState, RestrictedState, LoadingState }
export type { ErrorStateProps, RestrictedStateProps, LoadingStateProps }
