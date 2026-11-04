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
  /** Draw an option (trigger + list) yourself, e.g. as a <StatusBadge>. Defaults to its label. */
  renderOption?: (option: SelectOption) => React.ReactNode
  /** Extra classes for the open list — e.g. larger text and a capped height for long lists. */
  popupClassName?: string
  listClassName?: string
  optionClassName?: string
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
  renderOption,
  popupClassName,
  listClassName,
  optionClassName,
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
          className="truncate data-placeholder:text-primary-700 dark:data-placeholder:text-primary-400"
        >
          {renderOption
            ? (v: string | null) => {
                const o = items.find((i) => i.value === v)
                return o ? renderOption({ ...o, value: o.value === EMPTY ? "" : o.value }) : null
              }
            : undefined}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 transition-transform group-data-popup-open:rotate-180">
          <ChevronDownIcon className="size-4" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-[10050] outline-none" sideOffset={2} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup
            data-slot="select-content"
            className={cn(popupBase, "min-w-(--anchor-width)", popupClassName)}
          >
            {/* Long lists stop at ~10 rows and scroll, instead of running down the whole screen. */}
            <SelectPrimitive.List className={cn("max-h-[min(380px,var(--available-height))] overflow-y-auto p-1.5", listClassName)}>
              {items.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(
                    optionBase,
                    "justify-between",
                    // A drawn option (e.g. a status chip) keeps its own colours: a light hover row, not the
                    // solid dark highlight that plain-text options use.
                    renderOption && "py-1 data-highlighted:bg-ui-hover-bg data-highlighted:text-inherit dark:data-highlighted:bg-white/10 dark:data-highlighted:text-inherit dark:data-selected:bg-ui-hover-bg dark:data-selected:text-inherit",
                    optionClassName,
                  )}
                >
                  <SelectPrimitive.ItemText>
                    {renderOption ? renderOption({ ...o, value: o.value === EMPTY ? "" : o.value }) : o.label}
                  </SelectPrimitive.ItemText>
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
