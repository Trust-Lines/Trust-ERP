import * as React from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type BreadcrumbItem = { label: string; href?: string }

// Figma: Settings › Others › Personal information — 11px primary-700, chevrons, current page medium 12px.
function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px] leading-[1.5] text-primary-700">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-[12px] font-medium")}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-[2px] outline-none hover:text-primary-950 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
                >
                  {item.label}
                </Link>
              )}
              {!last && <ChevronRightIcon aria-hidden className="size-3" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumb }
export type { BreadcrumbItem }
