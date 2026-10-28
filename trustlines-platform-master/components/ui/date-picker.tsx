"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldBase, popupBase } from "@/components/ui/field-styles"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** Figma shows dates as d/M/yyyy, e.g. 22/5/2026. */
function formatDate(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** 6×7 grid of dates for the month containing `month`, weeks starting Monday. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

type DatePickerProps = {
  value?: Date | null
  onValueChange?: (value: Date | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

/**
 * Figma "Start Date" / "22/5/2026" field. Keyboard: Enter/Space opens; arrows move by day/week,
 * PageUp/PageDown by month, Home/End to week start/end, Enter picks, Esc closes.
 */
function DatePicker({
  value = null,
  onValueChange,
  placeholder = "Select date",
  disabled,
  id,
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [focused, setFocused] = React.useState<Date>(() => value ?? new Date())
  const gridRef = React.useRef<HTMLDivElement>(null)
  const today = React.useMemo(() => new Date(), [])

  React.useEffect(() => {
    if (open) setFocused(value ?? new Date())
  }, [open, value])

  // Keep DOM focus on the active day while the popup is open.
  React.useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open, focused])

  const pick = (d: Date) => {
    onValueChange?.(d)
    setOpen(false)
  }

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => new Date(focused.getFullYear(), focused.getMonth() - 1, focused.getDate()),
      PageDown: () => new Date(focused.getFullYear(), focused.getMonth() + 1, focused.getDate()),
      Home: () => addDays(focused, -((focused.getDay() + 6) % 7)),
      End: () => addDays(focused, 6 - ((focused.getDay() + 6) % 7)),
    }
    const move = moves[e.key]
    if (move) {
      e.preventDefault()
      setFocused(move())
    }
  }

  const days = monthGrid(focused)
  const monthLabel = focused.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
  const shiftMonth = (n: number) => setFocused(new Date(focused.getFullYear(), focused.getMonth() + n, 1))

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        disabled={disabled}
        data-slot="date-picker"
        aria-label={aria["aria-label"] ?? (value ? `Date: ${formatDate(value)}` : placeholder)}
        aria-invalid={aria["aria-invalid"]}
        className={cn(fieldBase, "flex h-8 w-[120px] items-center gap-2.5 text-left", className)}
      >
        <CalendarDaysIcon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.5} />
        <span className="truncate">{value ? formatDate(value) : placeholder}</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} align="start" className="z-[10050]">
          <PopoverPrimitive.Popup className={cn(popupBase, "w-64 p-3")}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-[4px] hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
                <ChevronLeftIcon className="size-4" />
              </button>
              <span aria-live="polite" className="text-[12px] font-semibold">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="grid size-7 place-items-center rounded-[4px] hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
            <div ref={gridRef} role="grid" aria-label={monthLabel} onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} role="columnheader" className="py-1 text-[10px] font-semibold text-primary-400 dark:text-primary-300">{w}</span>
              ))}
              {days.map((d) => {
                const inMonth = d.getMonth() === focused.getMonth()
                const selected = sameDay(d, value)
                const isFocused = sameDay(d, focused)
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    role="gridcell"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused}
                    aria-selected={selected}
                    aria-label={d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    onClick={() => pick(d)}
                    className={cn(
                      "h-7 rounded-[4px] text-[11px] outline-none hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring",
                      !inMonth && "text-primary-300",
                      sameDay(d, today) && !selected && "font-semibold text-accent-600 dark:text-accent-200",
                      selected && "bg-primary-700 text-primary-50 hover:bg-primary-700"
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DatePicker, formatDate }
export type { DatePickerProps }
