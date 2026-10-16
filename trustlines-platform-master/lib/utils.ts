import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the Foundations tokens from app/globals.css (Figma Task 5). Without this
// it can't tell that `text-meta` is a font size (it drops it next to `text-primary-500`, thinking
// both are colours) or that `rounded-tag` / `shadow-01` conflict with other radius / shadow classes.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["tag", "control", "card", "modal"],
      shadow: ["01", "02", "03", "04"],
      text: ["caption", "meta", "body-sm", "body", "body-lg", "h1", "h2", "h3", "h4"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
