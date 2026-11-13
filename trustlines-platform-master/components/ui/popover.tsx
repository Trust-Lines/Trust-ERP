"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

/**
 * App-wide popover: a small floating panel anchored to a trigger (pickers, quick editors, filter lists).
 * Built on Base UI Popover: portalled (never clipped by table / card overflow), flips near the window
 * edge, closes on outside click / Escape, returns focus to the trigger. For a list of actions use Menu.
 *
 *   <Popover open={open} onOpenChange={setOpen}>
 *     <PopoverTrigger render={<Button variant="outline" />}>Regions</PopoverTrigger>
 *     <PopoverContent aria-label="Regions">…form…</PopoverContent>
 *   </Popover>
 */

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverClose = PopoverPrimitive.Close

function PopoverContent({
  className,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  anchor,
  backdrop = false,
  onBackdropContextMenu,
  children,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className"> & {
  className?: string
  /** Invisible full-screen layer behind the popover: a click outside only closes it (it never reaches
   *  what is underneath). For popups that replaced a hand-made click-catcher overlay. */
  backdrop?: boolean
  /** With backdrop: a right-click outside is swallowed (no browser menu) and this runs. */
  onBackdropContextMenu?: () => void
} &
  // anchor: position against something other than the trigger, e.g. a table cell rect or a click point.
  Pick<PopoverPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "anchor">) {
  return (
    <PopoverPrimitive.Portal>
      {backdrop && (
        <PopoverPrimitive.Backdrop
          className="fixed inset-0 z-[10049]"
          onContextMenu={(e) => { e.preventDefault(); onBackdropContextMenu?.() }}
        />
      )}
      <PopoverPrimitive.Positioner
        className="z-[10050] outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
        anchor={anchor}
        collisionPadding={8}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "flex flex-col gap-2.5 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-3 text-left text-[13px] text-ui-body shadow-03 outline-none",
            "origin-(--transform-origin) transition-[scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: Omit<PopoverPrimitive.Title.Props, "className"> & { className?: string }) {
  return (
    <PopoverPrimitive.Title
      className={cn("m-0 text-[13px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading", className)}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverClose, PopoverContent, PopoverTitle }
