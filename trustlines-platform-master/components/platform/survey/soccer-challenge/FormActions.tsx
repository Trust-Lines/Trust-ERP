"use client";

/** Back / "Kick off" / "Next play" / "Confirm & score" buttons under steps 1–5. */
export function FormActions({ step, scoring, submitting, uploadProgress, errors, onBack, onScore }: {
  step: number;
  scoring: boolean;
  submitting: boolean;
  uploadProgress: string | null;
  errors: string[];
  onBack: () => void;
  onScore: () => void;
}) {
  return (
            <div className="form-actions-wrapper">
              <div className="form-actions">
                {step > 0 ? (
                  <button type="button" className="secondary-btn" disabled={scoring} onClick={onBack}>
                    <svg className="btn-arrow left" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                ) : (
                  <span />
                )}
                {step === 4 ? (
                  <button type="button" className="primary-btn score-action" disabled={scoring || submitting} onClick={onScore}>
                    {scoring || submitting ? (
                      <>
                        <span className="spinner" />
                        {submitting ? uploadProgress ?? "Sending…" : "Shooting…"}
                      </>
                    ) : (
                      <>
                        Confirm & score
                        <svg className="btn-arrow right" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>
                ) : (
                  <button type="submit" className="primary-btn">
                    {step === 0 ? "Kick off" : "Next play"}
                    <svg className="btn-arrow right" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              {errors.length > 0 && !errors.includes("team") && (
                <p className="error action-error" role="alert">
                  Please complete all required fields before continuing.
                </p>
              )}
            </div>
  );
}
