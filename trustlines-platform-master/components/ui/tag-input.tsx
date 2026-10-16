"use client"

import * as React from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type TagInputProps = {
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Max tags; further entries are ignored. */
  max?: number
  id?: string
  className?: string
  "aria-label"?: string
}

// Figma: "add tag.." chip — 20px, 4px radius, success-normal outline + text, 10px.
const chip =
  "inline-flex h-5 items-center gap-1.5 rounded-[4px] border border-success-normal px-2.5 text-[10px] leading-[1.5] text-success-normal"

/**
 * Type a word, press Enter or comma to add it as a tag. Backspace in the empty box removes the last tag.
 * Each tag has its own remove button, so everything is reachable with Tab + Enter.
 */
function TagInput({ value, onValueChange, placeholder = "add tag..", disabled, max, id, className, ...aria }: TagInputProps) {
  const [draft, setDraft] = React.useState("")

  const add = () => {
    const t = draft.trim()
    if (!t || value.includes(t) || (max !== undefined && value.length >= max)) return setDraft("")
    onValueChange([...value, t])
    setDraft("")
  }
  const remove = (t: string) => onValueChange(value.filter((v) => v !== t))

  return (
    <div data-slot="tag-input" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {value.map((t) => (
        <span key={t} className={chip}>
          {t}
          <button
            type="button"
            disabled={disabled}
            onClick={() => remove(t)}
            aria-label={`Remove ${t}`}
            className="grid size-3 place-items-center rounded-[2px] outline-none hover:bg-success-light focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
          >
            <XIcon className="size-2.5" />
          </button>
        </span>
      ))}
      <span className={cn(chip, "pr-1 focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-1 focus-within:outline-ui-focus-ring", disabled && "opacity-60")}>
        <input
          id={id}
          value={draft}
          disabled={disabled}
          aria-label={aria["aria-label"] ?? "Add tag"}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          onBlur={add}
          className="w-16 min-w-0 bg-transparent outline-none placeholder:text-success-normal"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={add}
          aria-label="Add tag"
          className="grid size-3.5 place-items-center rounded-[2px] outline-none hover:bg-success-light focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
        >
          <PlusIcon className="size-2.5" />
        </button>
      </span>
    </div>
  )
}

export { TagInput }
export type { TagInputProps }
