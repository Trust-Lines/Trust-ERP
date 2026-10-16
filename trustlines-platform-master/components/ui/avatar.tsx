"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { UserRoundIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Figma "Avatar Sizes": 24/32/40/48/64px rounded squares, primary-700 fill, person icon in primary-50.
const avatarVariants = cva(
  "relative inline-grid shrink-0 place-items-center overflow-hidden bg-primary-700 font-semibold text-primary-50 select-none",
  {
    variants: {
      size: {
        xs: "size-6 rounded-[4px] text-[10px] [&_svg]:size-4",
        sm: "size-8 rounded-[4px] text-[11px] [&_svg]:size-5",
        md: "size-10 rounded-[8px] text-[13px] [&_svg]:size-6",
        lg: "size-12 rounded-[8px] text-[15px] [&_svg]:size-7",
        xl: "size-16 rounded-[8px] text-[20px] [&_svg]:size-10",
      },
    },
    defaultVariants: { size: "sm" },
  }
)

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

type AvatarProps = VariantProps<typeof avatarVariants> & {
  /** Person's name: used for alt text and the initials fallback. */
  name?: string
  src?: string | null
  className?: string
}

/** Photo if `src` loads, else initials from `name`, else the Figma person icon. */
function Avatar({ name, src, size, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={cn(avatarVariants({ size }), className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name ?? ""} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback aria-label={name} role={name ? "img" : undefined}>
        {name ? initials(name) : <UserRoundIcon aria-hidden strokeWidth={1.75} />}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export { Avatar, avatarVariants }
export type { AvatarProps }
