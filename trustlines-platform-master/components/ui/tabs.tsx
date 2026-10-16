"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

/** Keyboard: Tab focuses the active tab, arrow keys move between tabs. */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3", className)} {...props} />
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("inline-flex w-fit items-stretch", className)} {...props} />
}

// Figma: 78×32 tabs on primary-50; active tab = primary-700 bottom border, medium 12px; others regular 11px.
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-8 min-w-[78px] items-center justify-center border-b border-transparent bg-primary-50 px-3 text-[11px] leading-[1.5] text-primary-700 outline-none transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring data-active:border-primary-700 data-active:text-[12px] data-active:font-medium data-disabled:text-grey-200",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
