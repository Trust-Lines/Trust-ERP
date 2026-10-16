import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldBase } from "@/components/ui/field-styles"

function Textarea({ className, rows = 6, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(fieldBase, "min-h-28 resize-y py-3", className)}
      {...props}
    />
  )
}

export { Textarea }
