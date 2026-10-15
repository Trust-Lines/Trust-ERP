"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { FootballPhoneScene } from "../FootballPhoneScene";
import type { Companion, SurveyData } from "./constants";

/** Step 5 — "Final review": summary, photo/file attachments, consent and the goal scene. */
export function StepFinalReview({
  scoring, submitting, reduceMotion, onGoal, team, data, companions, onEditStep,
  attachments, setAttachments, onAddAttachments, attachmentError, photoInputRef, fileInputRef,
  consentAccepted, onConsentChange, submitError,
}: {
  scoring: boolean;
  submitting: boolean;
  reduceMotion: boolean | null;
  onGoal: () => void;
  team: string;
  data: SurveyData;
  companions: Companion[];
  onEditStep: (step: number) => void;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  onAddAttachments: (list: FileList | null) => Promise<void>;
  attachmentError: string | null;
  photoInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  consentAccepted: boolean;
  onConsentChange: (checked: boolean) => void;
  submitError: string | null;
}) {
  return (
              <div className={`final-review-layout ${scoring ? "is-scoring" : ""}`}>
                <div className="scene-container">
                  <FootballPhoneScene shoot={scoring} reducedMotion={Boolean(reduceMotion)} onGoal={onGoal} />
                </div>
                <div className="review">
                  <span className="overline-tag">Final Whistle</span>
                  <h1 className="step-heading">Ready for the final kick?</h1>
                  <p className="intro">Review your match summary before taking the shot on goal.</p>
                  <dl className="review-dl">
                    {[
                      ["Team", team, 0],
                      ["Player", data.fullName, 1],
                      ...(companions.some((c) => c.name.trim())
                        ? [["With you", companions.map((c) => c.name.trim()).filter(Boolean).join(", "), 1]]
                        : []),
                      ["Business", data.companyName, 2],
                      ["Project", data.storeNeed, 3],
                      ["Timeline", data.projectTimeline, 3]
                    ].map(([label, value, target]) => (
                      <div className="review-row" key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{value || <span className="empty-val">—</span>}</dd>
                        <button type="button" className="edit-btn" onClick={() => onEditStep(Number(target))}>
                          Edit
                        </button>
                      </div>
                    ))}
                  </dl>
                  <div className="attach-block">
                    <strong>Add a photo or file</strong>
                    <p>Optional — snap a business card or store photo, or attach a document.</p>
                    <div className="attach-actions">
                      <button type="button" className="secondary-btn" disabled={scoring || submitting} onClick={() => photoInputRef.current?.click()}>
                        Take photo
                      </button>
                      <button type="button" className="secondary-btn" disabled={scoring || submitting} onClick={() => fileInputRef.current?.click()}>
                        Upload file
                      </button>
                    </div>
                    <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden
                      onChange={(e) => { void onAddAttachments(e.target.files); e.target.value = ""; }} />
                    <input ref={fileInputRef} type="file" multiple hidden
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.dwg"
                      onChange={(e) => { void onAddAttachments(e.target.files); e.target.value = ""; }} />
                    {attachments.length > 0 && (
                      <ul className="attach-list">
                        {attachments.map((f, i) => (
                          <li key={`${f.name}-${i}`}>
                            <span>{f.name}</span>
                            <button type="button" className="text-button" disabled={scoring || submitting}
                              onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {attachmentError && <p className="error" role="alert">{attachmentError}</p>}
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => onConsentChange(e.target.checked)}
                    />
                    <span>I agree that T LINES may contact me about this project using the details above.</span>
                  </label>
                  <p className="privacy-note">
                    Your details are sent to T LINES when you take the final shot. By completing the challenge, you agree that T LINES may contact you about this project.
                  </p>
                  {submitError && (
                    <p className="error" role="alert">
                      {submitError}
                    </p>
                  )}
                </div>
              </div>
  );
}
