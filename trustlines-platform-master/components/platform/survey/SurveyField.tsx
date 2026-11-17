import type { ReactNode } from "react";

/** Survey form row (gs-field styles): label + Required/Optional tag, hint, control, error. */
export function SurveyField({ id, label, hint, optional, error, children }: { id: string; label: string; hint?: string; optional?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={`gs-field ${error ? "gs-field-error" : ""}`} data-field={id}>
      <div className="gs-field-label-row"><label htmlFor={id}>{label}</label><span>{optional ? "Optional" : "Required"}</span></div>
      {hint && <p className="gs-field-hint">{hint}</p>}
      {children}
      {error && <p className="gs-error-text" role="alert">{error}</p>}
    </div>
  );
}
