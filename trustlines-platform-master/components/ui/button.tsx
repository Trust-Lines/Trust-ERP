import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// Figma: DAY 03 › Components › Buttons. Colours are 2026 palette tokens only.
// Sizes S/M/L = 32/40/48px. The Figma "Ghost" column is the disabled look.
const buttonVariantsBase = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center border border-transparent font-semibold leading-[1.5] whitespace-nowrap transition-colors select-none outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:pointer-events-none aria-busy:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-950 text-primary-50 hover:bg-primary-700 active:bg-primary-700 disabled:bg-grey-100 disabled:text-grey-200",
        secondary:
          "border-primary-950 bg-transparent text-primary-950 hover:border-primary-700 hover:text-primary-700 active:border-primary-700 active:text-primary-700 disabled:border-grey-200 disabled:text-grey-200",
        outline:
          "border-primary-700 bg-transparent text-primary-700 hover:bg-primary-50 disabled:border-grey-200 disabled:text-grey-200",
        ghost:
          "bg-transparent text-primary-700 hover:bg-ui-hover-bg disabled:text-grey-200",
        destructive:
          "bg-error-normal text-primary-50 hover:bg-error-dark disabled:bg-grey-100 disabled:text-grey-200",
        link: "h-auto! border-0 p-0! text-ui-link underline-offset-4 hover:underline",
        // Legacy shadcn name, kept so existing callers keep working.
        default:
          "bg-primary-950 text-primary-50 hover:bg-primary-700 disabled:bg-grey-100 disabled:text-grey-200",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-[4px] px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        md: "h-10 gap-2 rounded-[6px] px-4 text-[14px] [&_svg:not([class*='size-'])]:size-[18px]",
        lg: "h-12 gap-2.5 rounded-[8px] px-5 text-[16px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8 rounded-[4px] [&_svg:not([class*='size-'])]:size-5",
        "icon-md": "size-10 rounded-[6px] [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-12 rounded-[8px] [&_svg:not([class*='size-'])]:size-6",
        // Legacy shadcn sizes (sheet / sidebar use icon-sm).
        default: "h-8 gap-1.5 rounded-[4px] px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-6 rounded-[4px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[4px] [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  }
)

/** Button classes, conflict-resolved — safe to put on a <Link> or <a> directly. */
const buttonVariants = (props?: Parameters<typeof buttonVariantsBase>[0]) => cn(buttonVariantsBase(props))

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariantsBase> & {
    /** Figma "Loading" state: a spinner replaces the content and the width stays the same. */
    loading?: boolean
  }

function Button({
  className,
  variant = "primary",
  size = "sm",
  loading = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-[inherit]">{children}</span>
          <Loader2Icon aria-hidden className="absolute animate-spin" />
          <span className="sr-only">Loading</span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
