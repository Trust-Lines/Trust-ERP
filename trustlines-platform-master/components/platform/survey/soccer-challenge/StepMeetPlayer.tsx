"use client";

import type { Dispatch, SetStateAction } from "react";
import { SURVEY_REPRESENTATIVES } from "@/lib/marketing/surveyRepresentatives";
import { CONTACT_METHODS, MAX_COMPANIONS, POSITIONS, type Companion, type SurveyData } from "./constants";
import { Field } from "./Field";

/** Step 2 — "Meet the player": representative, contact details and optional companions. */
export function StepMeetPlayer({ eventName, data, update, contactMethods, companions, setCompanions, updateCompanion }: {
  eventName: string;
  data: SurveyData;
  update: (name: string, value: string) => void;
  contactMethods: string[];
  companions: Companion[];
  setCompanions: Dispatch<SetStateAction<Companion[]>>;
  updateCompanion: (index: number, patch: Partial<Companion>) => void;
}) {
  return (
              <>
                <span className="overline-tag">Player details</span>
                <h1 className="step-heading">Meet the player</h1>
                <p className="intro">Tell us how our team can connect with you following {eventName}.</p>
                <div className="field-grid">
                  <Field label="Representative — who is entering this?" name="representative" value={data.representative} update={update} wide>
                    <option value="">Select your name</option>
                    {SURVEY_REPRESENTATIVES.map((r) => <option key={r}>{r}</option>)}
                  </Field>
                  <Field label="Full name" name="fullName" value={data.fullName} update={update} placeholder="e.g. Alex Morgan" />
                  <Field label="Position" name="position" value={data.position} update={update}>
                    <option value="">Select position</option>
                    {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                  </Field>
                  <Field label="Phone number" name="phone" value={data.phone} update={update} type="tel" placeholder="(555) 000-0000" />
                  <Field label="Email address" name="email" value={data.email} update={update} type="email" placeholder="name@company.com" />
                  <div className="field field-wide">
                    <span className="field-label">Preferred contact method <small>(optional — pick one or more)</small></span>
                    <div className="choice-chips" role="group" aria-label="Preferred contact method">
                      {CONTACT_METHODS.map((method, i) => {
                        const selected = contactMethods.includes(method);
                        return (
                          <button
                            type="button"
                            key={method}
                            name={i === 0 ? "contactPreference" : undefined}
                            aria-pressed={selected}
                            className={`choice-chip ${selected ? "selected" : ""}`}
                            onClick={() => update("contactPreference", (selected ? contactMethods.filter((m) => m !== method) : [...contactMethods, method]).join("|"))}
                          >
                            {selected && (
                              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                                <path d="M16.666 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="companion-block">
                  <div className="companion-head">
                    <div>
                      <strong>Is someone with you?</strong>
                      <p>Optional — we&apos;ll save them as a contact too.</p>
                    </div>
                    {companions.length < MAX_COMPANIONS && (
                      <button type="button" className="secondary-btn" onClick={() => setCompanions((c) => [...c, { name: "", title: "", phone: "", email: "" }])}>
                        + Add person
                      </button>
                    )}
                  </div>
                  {companions.map((c, i) => (
                    <div className="companion-card" key={i}>
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input value={c.name} placeholder="e.g. Sam Carter" autoComplete="off" onChange={(e) => updateCompanion(i, { name: e.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">Position (optional)</span>
                          <div className="select-wrapper">
                            <select value={c.title} onChange={(e) => updateCompanion(i, { title: e.target.value })}>
                              <option value="">Select position</option>
                              {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                            </select>
                            <svg className="select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </label>
                        <label className="field">
                          <span className="field-label">Phone (optional)</span>
                          <input value={c.phone} type="tel" placeholder="(555) 000-0000" autoComplete="off" onChange={(e) => updateCompanion(i, { phone: e.target.value })} />
                        </label>
                        <label className="field field-wide">
                          <span className="field-label">Email (optional)</span>
                          <input value={c.email} type="email" placeholder="name@company.com" autoComplete="off" onChange={(e) => updateCompanion(i, { email: e.target.value })} />
                        </label>
                      </div>
                      <button type="button" className="text-button" onClick={() => setCompanions((cur) => cur.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </>
  );
}
