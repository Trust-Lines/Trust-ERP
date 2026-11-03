import * as React from "react"

/**
 * Row "…" menus inside a table's scroll box get clipped (overflow-x-auto also clips vertically).
 * This pins the open menu to the window under its button — flipping up when there isn't room
 * below — and closes it when the page scrolls or resizes so it never drifts away from its row.
 *
 *   const menu = useFixedMenu()
 *   <button onClick={e => menu.toggle(row.id, e.currentTarget)} aria-expanded={menu.openId === row.id} />
 *   {menu.openId === row.id && <div role="menu" className="fixed z-30 …" style={menu.style}>…</div>}
 */
export function useFixedMenu(menuHeight = 112) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [style, setStyle] = React.useState<React.CSSProperties>({})

  React.useEffect(() => {
    if (!openId) return
    const close = () => setOpenId(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [openId])

  const toggle = React.useCallback((id: string, anchor: HTMLElement) => {
    if (openId === id) { setOpenId(null); return }
    const r = anchor.getBoundingClientRect()
    const right = window.innerWidth - r.right
    setStyle(r.bottom + menuHeight > window.innerHeight
      ? { right, bottom: window.innerHeight - r.top + 4 }
      : { right, top: r.bottom + 4 })
    setOpenId(id)
  }, [openId, menuHeight])

  const close = React.useCallback(() => setOpenId(null), [])

  return { openId, style, toggle, close }
}
