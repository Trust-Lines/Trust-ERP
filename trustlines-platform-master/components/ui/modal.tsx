"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleXIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Pop-up dialog. Foundations: modals use the 16px radius and Shadow/04.
// Keyboard (from base-ui): focus moves inside on open and is trapped there, Esc closes,
// focus returns to the button that opened it.

const backdropClass =
  "fixed inset-0 z-50 bg-primary-950/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0"

// Dialog patterns (Figma "Dialog patterns": information / form / delete confirmation):
// 8px radius, no header rule, 20px heading, inset divider above the footer.
const popupVariants = cva(
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[8px] border border-ui-divider bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[13px] leading-[1.5] text-ui-body shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
  {
    variants: {
      size: {
        sm: "max-w-[400px]",
        md: "max-w-[480px]",
        lg: "max-w-[640px]",
      },
    },
    defaultVariants: { size: "md" },
  }
)

const titleClass = "text-[20px] font-semibold leading-[1.3] text-ui-heading"
const descriptionClass = "text-[13px] text-ui-text-secondary"
const footerClass = "mx-5 flex flex-wrap items-center justify-end gap-2 border-t border-ui-divider py-4"

/** Light-outline "Cancel" / "Not now" button used in dialog footers. */
const modalSecondaryButtonClass = "border-ui-divider bg-ui-surface-elevated text-ui-body hover:border-primary-200 hover:bg-primary-50 hover:text-ui-body dark:border-primary-600 dark:hover:border-primary-400 dark:hover:bg-primary-700"
/** Soft destructive confirm ("Move to Trash"): light red fill, dark red text. */
const modalDangerButtonClass = "bg-error-light text-error-dark hover:bg-error-light hover:brightness-95 dark:bg-error-dark dark:text-error-light dark:hover:bg-error-dark dark:hover:brightness-110"

const Modal = DialogPrimitive.Root
const ModalTrigger = DialogPrimitive.Trigger
const ModalClose = DialogPrimitive.Close

type ModalContentProps = VariantProps<typeof popupVariants> & {
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons for the bottom bar, e.g. <ModalClose render={<Button variant="secondary" />}>Cancel</ModalClose> + a primary action. */
  footer?: React.ReactNode
  /** Show the × button in the header. Default true. */
  showClose?: boolean
  className?: string
  children?: React.ReactNode
}

function ModalContent({ title, description, footer, showClose = true, size, className, children }: ModalContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={backdropClass} />
      <DialogPrimitive.Popup data-slot="modal" className={cn(popupVariants({ size }), className)}>
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1 space-y-1">
            <DialogPrimitive.Title className={titleClass}>{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className={descriptionClass}>{description}</DialogPrimitive.Description>}
          </div>
          {showClose && (
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-1.5 text-ui-body" />}>
              <XIcon />
            </DialogPrimitive.Close>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">{children}</div>}
        {footer && <div className={footerClass}>{footer}</div>}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

type ConfirmModalProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional element that opens the dialog (rendered as the trigger). */
  trigger?: React.ReactElement
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "destructive" = soft red confirm button, for delete / purge / revoke. */
  tone?: "default" | "destructive"
  /** Red banner stating the impact, e.g. "Team members will lose access." */
  warning?: React.ReactNode
  /** Record details shown under the banner (name, what moves with it, recovery window). */
  children?: React.ReactNode
  /** May be async; the confirm button shows a spinner until it settles, then the dialog closes. Throw to keep it open. */
  onConfirm: () => void | Promise<void>
}

/**
 * "Are you sure?" dialog. Uses AlertDialog: clicking the backdrop does NOT dismiss it,
 * so a misclick can't skip the decision — the user must pick Cancel or Confirm (or press Esc).
 */
function ConfirmModal({
  open: openProp,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  warning,
  children,
  onConfirm,
}: ConfirmModalProps) {
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setOpenState(o)
    onOpenChange?.(o)
  }
  const [busy, setBusy] = React.useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // Caller shows its own error (e.g. a toast); keep the dialog open so they can retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      {trigger && <AlertDialogPrimitive.Trigger render={trigger} />}
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className={backdropClass} />
        <AlertDialogPrimitive.Popup data-slot="confirm-modal" className={popupVariants({ size: "sm" })}>
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0 flex-1 space-y-1">
              <AlertDialogPrimitive.Title className={titleClass}>{title}</AlertDialogPrimitive.Title>
              {description && <AlertDialogPrimitive.Description className={descriptionClass}>{description}</AlertDialogPrimitive.Description>}
            </div>
            <AlertDialogPrimitive.Close
              render={<Button variant="ghost" size="icon-sm" aria-label="Close" disabled={busy} className="-mr-1.5 text-ui-body" />}
            >
              <XIcon />
            </AlertDialogPrimitive.Close>
          </div>
          {(warning || children) && (
            <div className="space-y-4 px-5 pt-2 pb-5">
              {warning && (
                <div role="alert" className="flex items-start gap-2.5 rounded-md bg-error-light px-3 py-3 text-error-dark dark:bg-error-dark/60 dark:text-error-light">
                  <CircleXIcon className="mt-px size-4 shrink-0" aria-hidden />
                  <div>{warning}</div>
                </div>
              )}
              {children}
            </div>
          )}
          <div className={footerClass}>
            <AlertDialogPrimitive.Close render={<Button variant="secondary" disabled={busy} className={modalSecondaryButtonClass} />}>{cancelLabel}</AlertDialogPrimitive.Close>
            <Button
              variant="primary"
              loading={busy}
              onClick={confirm}
              className={tone === "destructive" ? modalDangerButtonClass : undefined}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { Modal, ModalTrigger, ModalClose, ModalContent, ConfirmModal, modalSecondaryButtonClass, modalDangerButtonClass }
export type { ModalContentProps, ConfirmModalProps }
