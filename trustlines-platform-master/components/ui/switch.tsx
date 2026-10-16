"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Figma: 39×20 track, 4px radius. Off = grey-100 border, grey-200 thumb with "O" mark on the left.
// On = secondary-100 fill, primary-700 border, primary-700 thumb with "I" mark on the right.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-5 w-[39px] shrink-0 items-center rounded-[4px] border border-grey-100 bg-transparent p-px outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring data-checked:border-primary-700 data-checked:bg-secondary-100 data-disabled:cursor-not-allowed data-disabled:opacity-60",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="grid size-4 place-items-center rounded-[2px] bg-grey-200 transition-transform duration-150 data-checked:translate-x-[19px] data-checked:bg-primary-700">
        <span aria-hidden className="size-2 rounded-full border border-primary-50 group-data-checked/switch:h-2 group-data-checked/switch:w-0 group-data-checked/switch:rounded-none group-data-checked/switch:border-y-0 group-data-checked/switch:border-r-0" />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
