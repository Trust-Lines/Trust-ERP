"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Figma: 20px box, 4px radius, primary-700 border. Checked = 16px primary-700 inner square + light tick.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-[4px] border border-primary-700 bg-primary-50 outline-none transition-colors hover:border-primary-950 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring data-checked:bg-transparent data-disabled:cursor-not-allowed data-disabled:border-grey-200 data-disabled:bg-grey-50 aria-invalid:border-error-normal",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid size-4 place-items-center rounded-[2px] bg-primary-700 text-primary-50 data-disabled:bg-grey-200">
        <CheckIcon className="size-3" strokeWidth={2} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
