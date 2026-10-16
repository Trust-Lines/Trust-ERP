"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldGroupBase, optionBase, popupBase } from "@/components/ui/field-styles"

type ComboboxOption = { value: string; label: string }

type ComboboxProps = {
  options: ComboboxOption[]
  value?: ComboboxOption | null
  defaultValue?: ComboboxOption | null
  onValueChange?: (value: ComboboxOption | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

/** Figma "Combo box": type to filter a list, then pick. Keyboard: type, arrows move, Enter picks, Esc closes. */
function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Search…",
  emptyText = "No results",
  disabled,
  id,
  className,
  ...aria
}: ComboboxProps) {
  return (
    <ComboboxPrimitive.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as ComboboxOption | null)}
      itemToStringLabel={(o: ComboboxOption) => o.label}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxPrimitive.InputGroup data-slot="combobox" className={cn(fieldGroupBase, "h-8 pr-1", className)}>
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          aria-label={aria["aria-label"]}
          aria-invalid={aria["aria-invalid"]}
          className="h-full min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-primary-700"
        />
        <ComboboxPrimitive.Clear aria-label="Clear" className="grid size-6 place-items-center rounded-[2px] hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
          <XIcon className="size-3.5" />
        </ComboboxPrimitive.Clear>
        <ComboboxPrimitive.Trigger aria-label="Open list" className="grid size-6 place-items-center rounded-[2px] hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
          <ChevronDownIcon className="size-4" strokeWidth={1.5} />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="z-[10050] outline-none" sideOffset={2}>
          <ComboboxPrimitive.Popup className={cn(popupBase, "w-(--anchor-width) max-w-(--available-width)")}>
            <ComboboxPrimitive.Empty className="px-3 py-2 text-primary-400">{emptyText}</ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto p-1.5 data-empty:p-0">
              {(o: ComboboxOption) => (
                <ComboboxPrimitive.Item key={o.value} value={o} className={cn(optionBase, "justify-between")}>
                  <span>{o.label}</span>
                  <ComboboxPrimitive.ItemIndicator>
                    <CheckIcon className="size-3.5" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
export type { ComboboxOption, ComboboxProps }
