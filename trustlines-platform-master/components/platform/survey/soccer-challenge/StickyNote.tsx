"use client";

import { NOTE_MAX } from "./constants";

// A sticky note pinned to every page of the survey. It lives OUTSIDE the step container, so moving
// between steps never resets it: what was typed stays, and it stays open or minimised as left.
// The text is the same "Notes" answer as before — it still goes to the Contact's X-note and Activity.
export function StickyNote({ value, open, onToggle, onChange }: { value: string; open: boolean; onToggle: () => void; onChange: (v: string) => void }) {
  return (
    <aside className={`sticky-note${open ? " is-open" : ""}`} aria-label="Notes">
      {open ? (
        <>
          <div className="sticky-note-head">
            <strong>Notes</strong>
            <span className="sticky-note-hint">Stays with you on every page</span>
            <button type="button" className="sticky-note-min" aria-label="Minimise notes" onClick={onToggle}>–</button>
          </div>
          <textarea
            autoFocus
            value={value}
            maxLength={NOTE_MAX}
            rows={5}
            placeholder="Anything else we should know?"
            aria-label="Notes"
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="sticky-note-count">{value.length}/{NOTE_MAX}</span>
        </>
      ) : (
        <button type="button" className="sticky-note-tab" aria-expanded={false} onClick={onToggle}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l1-4L14.5 2.5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L7 16l-4 1z" />
          </svg>
          Notes
          {value.trim() && <span className="sticky-note-dot" aria-label="has text" />}
        </button>
      )}
    </aside>
  );
}
