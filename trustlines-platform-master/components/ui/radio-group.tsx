"use client"

import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

/** Keyboard: Tab enters the group, arrow keys move and select. */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("flex gap-3", className)} {...props} />
}

// Figma draws radios like the checkbox (20px rounded square); selected = filled 16px inner square.
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-[4px] border border-primary-700 dark:border-primary-500 bg-primary-50 dark:bg-primary-800 outline-none transition-colors hover:border-primary-950 dark:hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring data-checked:bg-transparent data-disabled:cursor-not-allowed data-disabled:border-grey-200 data-disabled:bg-grey-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-4 rounded-[2px] bg-primary-700 data-disabled:bg-grey-200" />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
