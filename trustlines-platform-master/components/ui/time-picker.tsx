"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldBase, popupBase } from "@/components/ui/field-styles"

const pad = (n: number) => String(n).padStart(2, "0")
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const PERIODS = ["AM", "PM"] as const

type Period = (typeof PERIODS)[number]
type Draft = { hour: number | null; minute: number | null; period: Period | null }

function parse(value: string): Draft {
  const [h, m] = value.split(":").map(Number)
  if (!value || Number.isNaN(h) || Number.isNaN(m)) return { hour: null, minute: null, period: null }
  return { hour: h % 12 || 12, minute: m, period: h < 12 ? "AM" : "PM" }
}

function to24(d: Draft): string {
  const hour = d.hour ?? 12
  const h = d.period === "PM" ? (hour % 12) + 12 : hour % 12
  return `${pad(h)}:${pad(d.minute ?? 0)}`
}

const CELL =
  "h-9 w-full shrink-0 cursor-pointer rounded-[4px] border-0 bg-transparent text-[13px] font-medium text-ui-body outline-none hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring"
/** Selected cell, same navy as the primary form actions. */
const CELL_ON =
  "bg-[var(--color-secondary-700)] font-semibold text-white hover:bg-[var(--color-secondary-700)] dark:bg-primary-50 dark:text-primary-950 dark:hover:bg-primary-50"

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  // Up/Down walks the column, like the browser's own time picker.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const cells = Array.from(e.currentTarget.querySelectorAll("button"))
    const next = cells.indexOf(document.activeElement as HTMLButtonElement) + (e.key === "ArrowDown" ? 1 : -1)
    cells[next]?.focus()
  }
  return (
    <div role="group" aria-label={label} onKeyDown={onKeyDown} data-column className="flex h-60 w-[60px] flex-col gap-0.5 overflow-y-auto pr-0.5">
      {children}
    </div>
  )
}

type TimePickerProps = {
  /** 24-hour "HH:MM", or "" for no time. */
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

/**
 * Hour / minute / AM-PM columns in the platform's own popup. The browser's <input type="time">
 * popup can't be styled, so this replaces it with the same layout. A time is set once an hour is
 * picked; minutes default to 00 and the period to AM until chosen.
 */
function TimePicker({ value, onValueChange, disabled, id, className, ...aria }: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(() => parse(value))
  const popupRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    setDraft(parse(value))
    // Bring the chosen cells into view; scrollIntoView would also move the dialog behind.
    const raf = requestAnimationFrame(() => {
      popupRef.current?.querySelectorAll<HTMLElement>("[data-column]").forEach((col) => {
        const on = col.querySelector<HTMLElement>('[aria-pressed="true"]')
        if (on) col.scrollTop = on.offsetTop - col.offsetTop - col.clientHeight / 2 + on.clientHeight / 2
      })
    })
    return () => cancelAnimationFrame(raf)
    // Only when it opens: a pick must not re-centre the column under the pointer.
  }, [open])

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (next.hour != null) onValueChange(to24(next))
  }

  const shown = parse(value)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        disabled={disabled}
        data-slot="time-picker"
        aria-label={aria["aria-label"]}
        className={cn(fieldBase, "flex h-8 items-center justify-between gap-2.5 text-left", className)}
      >
        <span className={cn("truncate", !value && "text-ui-text-secondary")}>
          {value ? `${pad(shown.hour ?? 12)}:${pad(shown.minute ?? 0)} ${shown.period}` : "--:-- --"}
        </span>
        <ClockIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} align="start" className="z-[10050]">
          <PopoverPrimitive.Popup ref={popupRef} className={cn(popupBase, "p-2")}>
            <div className="flex gap-1">
              <Column label="Hour">
                {HOURS.map((h) => (
                  <button key={h} type="button" aria-pressed={draft.hour === h} className={cn(CELL, draft.hour === h && CELL_ON)} onClick={() => update({ hour: h })}>{pad(h)}</button>
                ))}
              </Column>
              <Column label="Minute">
                {MINUTES.map((m) => (
                  <button key={m} type="button" aria-pressed={draft.minute === m} className={cn(CELL, draft.minute === m && CELL_ON)} onClick={() => update({ minute: m })}>{pad(m)}</button>
                ))}
              </Column>
              <Column label="AM or PM">
                {PERIODS.map((p) => (
                  <button key={p} type="button" aria-pressed={draft.period === p} className={cn(CELL, draft.period === p && CELL_ON)} onClick={() => update({ period: p })}>{p}</button>
                ))}
              </Column>
            </div>
            <div className="mt-2 flex justify-between border-t border-ui-divider pt-2">
              <button
                type="button"
                className="cursor-pointer rounded-[4px] border-0 bg-transparent px-2 py-1 text-[12px] font-medium text-ui-body outline-none hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
                onClick={() => { setDraft(parse("")); onValueChange(""); setOpen(false) }}
              >
                Clear
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-[4px] border-0 bg-transparent px-2 py-1 text-[12px] font-semibold text-ui-body outline-none hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { TimePicker }
export type { TimePickerProps }
