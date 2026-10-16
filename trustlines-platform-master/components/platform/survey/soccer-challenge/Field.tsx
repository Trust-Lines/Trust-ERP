"use client";

import { ReactNode } from "react";
import { NOTE_MAX, REQUIRED_FIELDS } from "./constants";

export function Field({
  label,
  name,
  value,
  update,
  type = "text",
  placeholder,
  children,
  wide = false
}: {
  label: string;
  name: string;
  value: string;
  update: (name: string, value: string) => void;
  type?: string;
  placeholder?: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span className="field-label">{label}{!REQUIRED_FIELDS.has(name) && <small> (optional)</small>}</span>
      {children ? (
        <div className="select-wrapper">
          <select name={name} value={value} onChange={(e) => update(name, e.target.value)} required={REQUIRED_FIELDS.has(name)}>
            {children}
          </select>
          <svg className="select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : type === "textarea" ? (
        <textarea name={name} value={value} placeholder={placeholder} maxLength={name === "mainChallenges" ? NOTE_MAX : undefined} onChange={(e) => update(name, e.target.value)} required={REQUIRED_FIELDS.has(name)} />
      ) : (
        <input name={name} value={value} type={type} placeholder={placeholder} onChange={(e) => update(name, e.target.value)} required={REQUIRED_FIELDS.has(name)} />
      )}
    </label>
  );
}
