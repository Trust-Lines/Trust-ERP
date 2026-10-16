import * as React from "react"

import { cn } from "@/lib/utils"

type CurrencyCellProps = {
  amount: number | null | undefined
  currency?: string
  /** Show "$ ********" instead of the figure (Figma second state). */
  hidden?: boolean
  /** "pill" = Figma look (dark 40px chip); "plain" = right-aligned table text. */
  variant?: "pill" | "plain"
  className?: string
}

function format(amount: number, currency: string) {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).formatToParts(amount)
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency
  const number = parts.filter((p) => p.type !== "currency" && p.type !== "literal").map((p) => p.value).join("")
  return { symbol, number }
}

/**
 * Money value, formatted as Figma "$ 1,000.98". Carries data-money, so the app-wide
 * "Hide amounts" privacy mode (lib/privacy/hideAmounts.ts) also masks it.
 */
function CurrencyCell({ amount, currency = "USD", hidden = false, variant = "pill", className }: CurrencyCellProps) {
  const label =
    amount == null ? "—" : hidden ? `${format(0, currency).symbol} ********` : (() => {
      const { symbol, number } = format(amount, currency)
      return `${symbol} ${number}`
    })()
  return (
    <span
      data-slot="currency-cell"
      data-money={hidden || amount == null ? undefined : ""}
      aria-label={hidden ? "Amount hidden" : undefined}
      className={cn(
        "tabular-nums whitespace-nowrap",
        variant === "pill"
          ? "inline-flex h-10 items-center rounded-[6px] bg-primary-700 px-3 text-[14px] font-semibold leading-[1.5] text-primary-50"
          : "block text-right text-[13px] text-primary-800",
        className
      )}
    >
      {label}
    </span>
  )
}

export { CurrencyCell }
export type { CurrencyCellProps }
