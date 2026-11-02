"use client"

import * as React from "react"

// Profile photos for the whole app: who has one (/api/avatars), looked up by user id or, where a
// screen only has the person's name, by full name. Mounted once in AppShell; Avatar and
// PersonFace use it, so any place that shows a person shows their photo when there is one.

type Entry = { id: string; name: string; v: number }
type Directory = { byId: Map<string, string>; byName: Map<string, string> }

const EMPTY: Directory = { byId: new Map(), byName: new Map() }
const AvatarDirectoryContext = React.createContext<Directory>(EMPTY)

/** Fire after a photo changes so every avatar on screen picks it up. */
export const AVATARS_CHANGED_EVENT = "avatars:changed"

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")

function build(entries: Entry[]): Directory {
  const byId = new Map<string, string>()
  const byName = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const e of entries) {
    const url = `/api/avatar/${e.id}?v=${e.v}`
    byId.set(e.id, url)
    const k = norm(e.name)
    if (!k) continue
    seen.set(k, (seen.get(k) ?? 0) + 1)
    byName.set(k, url)
  }
  // Two people with the same name: a name alone can't tell whose photo it is.
  for (const [k, n] of seen) if (n > 1) byName.delete(k)
  return { byId, byName }
}

export function AvatarDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [dir, setDir] = React.useState<Directory>(EMPTY)
  React.useEffect(() => {
    let live = true
    const load = () =>
      fetch("/api/avatars", { cache: "no-store" })
        .then(r => (r.ok ? r.json() : { avatars: [] }))
        .then((b: { avatars?: Entry[] }) => { if (live) setDir(build(b.avatars ?? [])) })
        .catch(() => {})
    void load()
    window.addEventListener(AVATARS_CHANGED_EVENT, load)
    return () => { live = false; window.removeEventListener(AVATARS_CHANGED_EVENT, load) }
  }, [])
  return <AvatarDirectoryContext.Provider value={dir}>{children}</AvatarDirectoryContext.Provider>
}

/** The photo URL for this person, or null (no photo, or not inside the provider). */
export function useAvatarSrc(person: { userId?: string | null; name?: string | null }): string | null {
  const dir = React.useContext(AvatarDirectoryContext)
  if (person.userId && dir.byId.has(person.userId)) return dir.byId.get(person.userId)!
  if (person.name) return dir.byName.get(norm(person.name)) ?? null
  return null
}

/**
 * For hand-built initials badges: the person's photo filling the badge, else `fallback` (their
 * initials). The badge keeps its own size and shape.
 */
export function PersonFace({ name, userId, fallback }: { name?: string | null; userId?: string | null; fallback: React.ReactNode }) {
  const src = useAvatarSrc({ userId, name })
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => { setFailed(false) }, [src])
  if (!src || failed) return <>{fallback}</>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name ?? ""} onError={() => setFailed(true)} className="size-full rounded-[inherit] object-cover" />
}
