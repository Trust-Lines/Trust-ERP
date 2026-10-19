"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowRightIcon, CircleCheckIcon, CircleXIcon, InfoIcon, XIcon } from "lucide-react"

// Toast / transient feedback (Figma "Feedback patterns"):
//   success — "Changes saved" + optional "View project →" link
//   info    — reversible change, e.g. "Project moved to Trash" + "Undo move"
//   error   — failed action, e.g. "Upload interrupted" + "Retry upload"
// Rendered through sonner's <Toaster> in app/(platform)/layout.tsx.
//
// Usage:
//   feedback.success("Changes saved", { description: "Northstar is up to date.", action: { label: "View project", href: `/projects/${id}` } })
//   feedback.info("Lead moved to Trash", { description: "It can be restored for 30 days.", action: { label: "Undo move", onClick: undo } })
//   feedback.error("Upload interrupted", { description: `${file.name} could not be uploaded.`, action: { label: "Retry upload", onClick: retry } })

type Tone = "success" | "info" | "error"

type FeedbackAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never }

type FeedbackOptions = {
  description?: React.ReactNode
  action?: FeedbackAction
  /** ms; defaults to 4s, or 8s when there is an action to click. */
  duration?: number
}

// Status tones swap bg/fg in .dark (app/globals.css), so the tiles follow automatically.
const TONE: Record<Tone, { icon: React.ComponentType<{ className?: string }>; tile: string }> = {
  success: { icon: CircleCheckIcon, tile: "bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]" },
  info:    { icon: InfoIcon,        tile: "bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]" },
  error:   { icon: CircleXIcon,     tile: "bg-error-light text-error-normal dark:bg-error-dark dark:text-error-light" },
}

type FeedbackToastCardProps = FeedbackOptions & {
  tone: Tone
  title: React.ReactNode
  onDismiss?: () => void
  className?: string
}

/** The toast card itself. feedback.* renders it inside sonner; /dev/ui renders it inline as a preview. */
function FeedbackToastCard({ tone, title, description, action, onDismiss, className }: FeedbackToastCardProps) {
  const { icon: Icon, tile } = TONE[tone]
  const linkClass = "inline-flex items-center gap-1 font-semibold text-[var(--color-secondary-700)] dark:text-[var(--color-secondary-200)] hover:underline underline-offset-2"

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex w-[min(400px,calc(100vw-2rem))] items-start gap-3 rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-4 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] shadow-03 ${className ?? ""}`}
    >
      <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-md ${tile}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-semibold text-ui-heading">{title}</p>
        {description && <p className="text-ui-text-secondary">{description}</p>}
        {action && (
          <div className="pt-0.5">
            {action.href ? (
              <Link href={action.href} onClick={onDismiss} className={linkClass}>
                {action.label} <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            ) : (
              <button type="button" onClick={() => { onDismiss?.(); action.onClick?.() }} className={linkClass}>
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded text-ui-body hover:bg-primary-50 dark:hover:bg-primary-700"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

function show(tone: Tone, title: React.ReactNode, options: FeedbackOptions = {}) {
  return toast.custom(id => <FeedbackToastCard tone={tone} title={title} {...options} onDismiss={() => toast.dismiss(id)} />, {
    duration: options.duration ?? (options.action ? 8000 : 4000),
  })
}

const feedback = {
  success: (title: React.ReactNode, options?: FeedbackOptions) => show("success", title, options),
  info: (title: React.ReactNode, options?: FeedbackOptions) => show("info", title, options),
  error: (title: React.ReactNode, options?: FeedbackOptions) => show("error", title, options),
}

export { feedback, FeedbackToastCard }
export type { FeedbackOptions, FeedbackAction, FeedbackToastCardProps }
