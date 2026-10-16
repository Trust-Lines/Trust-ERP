"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Pop-up dialog. Foundations: modals use the 16px radius and Shadow/04.
// Keyboard (from base-ui): focus moves inside on open and is trapped there, Esc closes,
// focus returns to the button that opened it.

const backdropClass =
  "fixed inset-0 z-50 bg-primary-950/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0"

const popupVariants = cva(
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-modal border border-ui-divider bg-ui-surface-elevated text-primary-800 shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
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
        <div className="flex items-start gap-3 border-b border-ui-divider px-5 py-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <DialogPrimitive.Title className="text-body-lg font-semibold text-primary-950">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="text-meta text-primary-500">{description}</DialogPrimitive.Description>}
          </div>
          {showClose && (
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-1.5 -mt-0.5" />}>
              <XIcon />
            </DialogPrimitive.Close>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-body-sm">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ui-divider px-5 py-3.5">{footer}</div>}
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
  /** "destructive" = red confirm button, for delete / purge / revoke. */
  tone?: "default" | "destructive"
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
          <div className="space-y-1.5 px-5 pt-5 pb-4">
            <AlertDialogPrimitive.Title className="text-body-lg font-semibold text-primary-950">{title}</AlertDialogPrimitive.Title>
            {description && <AlertDialogPrimitive.Description className="text-body-sm text-primary-500">{description}</AlertDialogPrimitive.Description>}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <AlertDialogPrimitive.Close render={<Button variant="secondary" disabled={busy} />}>{cancelLabel}</AlertDialogPrimitive.Close>
            <Button variant={tone === "destructive" ? "destructive" : "primary"} loading={busy} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { Modal, ModalTrigger, ModalClose, ModalContent, ConfirmModal }
export type { ModalContentProps, ConfirmModalProps }
