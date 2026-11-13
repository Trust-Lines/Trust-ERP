"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { optionBase, popupBase } from "@/components/ui/field-styles"

/**
 * App-wide action menu (row "…" menus, bulk-action menus, user menu).
 * Built on Base UI Menu: portalled (never clipped by table / card overflow), flips near the window
 * edge, closes on outside click / Escape, full keyboard support (arrows, Home/End, type-ahead).
 * Same panel + row look as Select (popupBase / optionBase), light and dark.
 *
 *   <Menu>
 *     <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions for X" />}>
 *       <Ellipsis />
 *     </MenuTrigger>
 *     <MenuContent>
 *       <MenuItem onClick={edit}><Pencil /> Edit</MenuItem>
 *       <MenuLinkItem render={<Link href="/x" />}><ExternalLink /> Open</MenuLinkItem>
 *       <MenuSeparator />
 *       <MenuItem variant="destructive" onClick={remove}><Trash2 /> Delete</MenuItem>
 *     </MenuContent>
 *   </Menu>
 */

/** Non-modal by default: the page keeps scrolling and stays interactive behind an open menu. */
function Menu({ modal = false, ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root modal={modal} {...props} />
}

const MenuTrigger = MenuPrimitive.Trigger

function MenuContent({
  className,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="z-[10050] outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(popupBase, "flex min-w-[180px] flex-col gap-px p-1", className)}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

const itemClass = (variant: "default" | "destructive" | undefined, className?: string) =>
  cn(
    optionBase,
    "cursor-pointer text-[13px] no-underline data-disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
    variant === "destructive" &&
      "text-error-normal data-highlighted:bg-error-light data-highlighted:text-error-dark dark:text-error-light dark:data-highlighted:bg-error-dark/30 dark:data-highlighted:text-error-light",
    className
  )

type ItemVariant = { variant?: "default" | "destructive"; className?: string }

function MenuItem({ className, variant, ...props }: Omit<MenuPrimitive.Item.Props, "className"> & ItemVariant) {
  return <MenuPrimitive.Item data-slot="menu-item" className={itemClass(variant, className)} {...props} />
}

/** A menu row that navigates. Pass the link via render, e.g. render={<Link href="…" />}. Closes on click. */
function MenuLinkItem({ className, variant, closeOnClick = true, ...props }: Omit<MenuPrimitive.LinkItem.Props, "className"> & ItemVariant) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="menu-item"
      closeOnClick={closeOnClick}
      className={itemClass(variant, className)}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-ui-divider", className)} {...props} />
}

const MenuGroup = MenuPrimitive.Group

function MenuGroupLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn("px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ui-text-secondary", className)}
      {...props}
    />
  )
}

/** Pick-one list inside a menu (e.g. "Change status"). */
const MenuRadioGroup = MenuPrimitive.RadioGroup

function MenuRadioItem({ className, children, ...props }: Omit<MenuPrimitive.RadioItem.Props, "className"> & { className?: string }) {
  return (
    <MenuPrimitive.RadioItem data-slot="menu-item" className={itemClass(undefined, cn("pr-8", className))} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className="absolute right-2.5 inline-flex">
        <CheckIcon className="size-4" />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  )
}

export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
}
