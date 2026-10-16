"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldBase, optionBase, popupBase } from "@/components/ui/field-styles"

type SelectOption = { value: string; label: string; disabled?: boolean }

const EMPTY = "__select_empty__"

type SelectProps = {
  options: SelectOption[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  name?: string
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

/** Figma "Dropdown": single choice from a fixed list. Keyboard: Space/Enter opens, arrows move, Enter picks, Esc closes. */
function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  disabled,
  name,
  id,
  className,
  ...aria
}: SelectProps) {
  // base-ui treats "" as "nothing selected" (shows the placeholder), but filters commonly use
  // "" for an "All …" option. Swap it for a sentinel internally and back out in the callback.
  // If the list has no "" option, "" just means "nothing picked yet" → show the placeholder.
  const hasEmptyOption = options.some((o) => o.value === "")
  const toInner = (v: string | null | undefined) => (v === "" ? (hasEmptyOption ? EMPTY : null) : v)
  const items = React.useMemo(() => options.map((o) => ({ ...o, value: toInner(o.value) as string })), [options])
  return (
    <SelectPrimitive.Root
      items={items}
      value={value === undefined ? undefined : toInner(value)}
      defaultValue={defaultValue === undefined ? undefined : toInner(defaultValue)}
      onValueChange={(v) => onValueChange?.(v === EMPTY ? "" : (v as string | null))}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"]}
        className={cn(fieldBase, "flex h-8 items-center justify-between gap-3 text-left", className)}
      >
        <SelectPrimitive.Value
          placeholder={placeholder}
          className="truncate data-placeholder:text-primary-700"
        />
        <SelectPrimitive.Icon className="shrink-0 transition-transform group-data-popup-open:rotate-180">
          <ChevronDownIcon className="size-4" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50 outline-none" sideOffset={2} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup
            data-slot="select-content"
            className={cn(popupBase, "min-w-(--anchor-width)")}
          >
            <SelectPrimitive.List className="max-h-(--available-height) overflow-y-auto p-1.5">
              {items.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(optionBase, "justify-between")}
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
export type { SelectOption, SelectProps }
