"use client";

// GeneralSurvey.tsx — the default, always-on public survey ("T Lines Store Passport").
// Ported from the standalone NACS-Tlines-main demo (which never actually sent its data
// anywhere — see its own Success screen copy) and wired into the real, already-live
// submission pipeline (lib/marketing/campaignSubmission.ts — the same one Soccer
// Challenge uses), so a real submission here creates/updates a real Prospect + Need in
// the CRM and runs the usual Lead/Potential/Opportunity classification.
//
// Field changes from the original demo (per 2026-08-28 request):
//  - Nationality question removed entirely.
//  - "Your role" moved off step 01 onto step 02, relabeled "Your role in company".
//  - Step 01 gets a compact WhatsApp/Email contact-preference tick instead of asking
//    a full question about it.
//  - "Business address" relabeled "Store address" (it IS the store, not a head office).
//  - The old step 03 ("Current position": store status/size) is gone as its own step —
//    its two fields now live at the bottom of the renamed step "03" (was step 04,
//    "Project vision").
//  - The old step 05 ("Timing & resources") is gone as its own step too. Its first
//    field — "when should we reach you" — is now a large, prominent picker at the top
//    of the final step. Picking one just selects it (like the other choice steps); an
//    explicit "Send" button beneath it is what actually submits. Budget was dropped.
//  - A short, required consent tick sits under the timing picker (has to be checked
//    before Send will work).
//
// Data mapping happens in buildSubmissionPayload() below, onto the exact same
// PublicSurveyDTO shape lib/marketing/campaignSubmission.ts already expects.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Building2, Check, Clock3, Expand, Fuel, Hammer, HardHat, Loader2,
  MapPin, MessageCircle, Store, UserRound, Wrench, ShoppingBasket, Mail,
} from "lucide-react";

type FieldName =
  | "storeType" | "fullName" | "phone" | "email" | "contactPreference"
  | "companyName" | "role" | "storeAddress" | "businessPhone"
  | "projectType" | "challenges" | "storeStatus" | "storeSize"
  | "timeline" | "honeypot";

type SurveyData = Record<FieldName, string>;
type SurveyErrors = Partial<Record<FieldName, string>>;

const initialData: SurveyData = {
  storeType: "", fullName: "", phone: "", email: "", contactPreference: "",
  companyName: "", role: "", storeAddress: "", businessPhone: "",
  projectType: "", challenges: "", storeStatus: "", storeSize: "",
  timeline: "", honeypot: "",
};

const stepMeta = [
  { eyebrow: "Project profile", title: "Choose your store format", description: "Select the format that best describes your business." },
  { eyebrow: "01 — Project lead", title: "Tell us about yourself", description: "Start with the person leading this project." },
  { eyebrow: "02 — Business identity", title: "Tell us about your business", description: "Add the company details connected to this project." },
  { eyebrow: "03 — Project vision", title: "Define your project plan", description: "Tell us where the store stands today and what this project should solve." },
] as const;

const requiredByStep: Record<number, FieldName[]> = {
  0: ["storeType"],
  1: ["fullName", "phone", "email", "contactPreference"],
  2: ["companyName", "role", "storeAddress", "businessPhone"],
  3: ["projectType", "challenges", "storeStatus", "storeSize", "timeline"],
};

const storeOptions = [
  { value: "convenience", label: "Convenience store", detail: "Neighborhood and quick-service retail", icon: Store },
  { value: "grocery", label: "Grocery store", detail: "Food market and supermarket formats", icon: ShoppingBasket },
  { value: "truck-stop", label: "Truck stop", detail: "Travel center and fuel-led retail", icon: Fuel },
] as const;
const STORE_TYPE_TEAM_LABEL: Record<string, string> = {
  convenience: "Convenience Stores", grocery: "Grocery Stores", "truck-stop": "Truck Stop",
};

const projectOptions = [
  { value: "new-construction", label: "New construction", icon: HardHat },
  { value: "full-remodel", label: "Full remodel", icon: Hammer },
  { value: "small-remodel", label: "Small remodel", icon: Wrench },
  { value: "expansion", label: "Expansion", icon: Expand },
  { value: "new-branch", label: "New branch", icon: MapPin },
] as const;
const PROJECT_TYPE_MAP: Record<string, string[]> = {
  "new-construction": ["new_construction"], "full-remodel": ["full_remodel"], "small-remodel": ["small_remodel"],
  expansion: ["new_construction"], "new-branch": ["new_construction"],
};
const PROJECT_TYPE_NOTE_LABEL: Record<string, string> = {
  "new-construction": "New construction", "full-remodel": "Full remodel", "small-remodel": "Small remodel",
  expansion: "Expansion", "new-branch": "New branch",
};

const storeStatusOptions = [
  ["new", "New store — planning phase"], ["operating", "Existing store — operating"], ["expanding", "Planning an expansion"],
] as const;
const storeSizeOptions = [
  ["small", "Small — up to 2,000 sq. ft."], ["medium", "Medium — 2,000–5,000 sq. ft."], ["large", "Large — 5,000+ sq. ft."],
] as const;

const timingOptions = [
  { value: "asap", label: "ASAP", detail: "0–3 months" },
  { value: "soon", label: "Soon", detail: "3–6 months" },
  { value: "later", label: "Later", detail: "6–12 months" },
  { value: "planning", label: "Still planning", detail: "12+ months" },
] as const;
const TIMING_MAP: Record<string, string> = {
  asap: "0_3_months", soon: "3_6_months", later: "6_12_months", planning: "12_plus_months",
};

const labelOf = (opts: readonly (readonly [string, string])[], value: string) => opts.find(([v]) => v === value)?.[1] || value || "—";

function buildSubmissionPayload(data: SurveyData, submissionToken: string, consentTextVersion: string) {
  const [firstName, ...rest] = (data.fullName || "").trim().split(/\s+/);
  const notesLines = [
    data.challenges ? `Main challenges: ${data.challenges}` : null,
    data.projectType ? `Project type: ${PROJECT_TYPE_NOTE_LABEL[data.projectType] ?? data.projectType}` : null,
    data.contactPreference ? `Preferred contact: ${data.contactPreference === "whatsapp" ? "WhatsApp" : "Email"}` : null,
    data.businessPhone ? `Store phone: ${data.businessPhone}` : null,
    data.storeStatus ? `Store status: ${labelOf(storeStatusOptions, data.storeStatus)}` : null,
    data.storeSize ? `Store size: ${labelOf(storeSizeOptions, data.storeSize)}` : null,
  ].filter(Boolean);

  return {
    leadType: "organization" as const,
    organizationName: data.companyName || undefined,
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    email: data.email || undefined,
    phone: data.phone || undefined,
    jobTitle: data.role || undefined,
    storeAddress: data.storeAddress || undefined,
    team: STORE_TYPE_TEAM_LABEL[data.storeType] ?? undefined,
    projectTypes: PROJECT_TYPE_MAP[data.projectType] ?? [],
    timing: TIMING_MAP[data.timeline] ?? undefined,
    notes: notesLines.join("\n") || undefined,
    consentAccepted: true,
    consentTextVersion,
    submissionToken,
    honeypot: data.honeypot || "",
  };
}

async function submitSurveyResponse(campaignSlug: string, data: SurveyData, submissionToken: string, consentTextVersion: string) {
  const res = await fetch(`/api/public/campaigns/${campaignSlug}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSubmissionPayload(data, submissionToken, consentTextVersion)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Something went wrong — please try again.");
  return body as { ok: true; submissionId: string; status: string };
}

export function GeneralSurvey({ campaignSlug, consentTextVersion }: { campaignSlug: string; consentTextVersion: string }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<SurveyData>(initialData);
  const [errors, setErrors] = useState<SurveyErrors>({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submissionToken] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const mainRef = useRef<HTMLElement>(null);

  const update = (name: FieldName, value: string) => {
    setData(current => ({ ...current, [name]: value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  };

  useEffect(() => {
    if (done) return;
    mainRef.current?.querySelector<HTMLElement>("#gs-step-title")?.focus();
  }, [step, done]);

  const validateStep = () => {
    const next: SurveyErrors = {};
    for (const name of requiredByStep[step] ?? []) {
      if (!String(data[name]).trim()) next[name] = "Please complete this required answer.";
    }
    if (step === 1 && data.email && !/^\S+@\S+\.\S+$/.test(data.email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) {
      window.setTimeout(() => {
        document.getElementById("gs-error-summary")?.focus();
        const first = Object.keys(next)[0];
        document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] textarea`)?.focus();
      });
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep(current => Math.min(3, current + 1));
  };
  const back = () => { setErrors({}); setStep(current => Math.max(0, current - 1)); };

  async function handleSend() {
    if (!validateStep()) return;
    if (!consentAccepted) { setConsentError(true); return; }
    setConsentError(false);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitSurveyResponse(campaignSlug, data, submissionToken, consentTextVersion);
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <Success data={data} />;

  const displayStep = step + 1;
  const iconByStep = [Store, UserRound, Building2, Clock3];
  const ActiveIcon = iconByStep[step];

  return (
    <div className="gs-app">
      <style>{`.gs-spin{animation:gs-spin 1s linear infinite}@keyframes gs-spin{to{transform:rotate(360deg)}}`}</style>
      <div className="gs-survey-shell">
        <aside className="gs-brand-rail">
          <div className="gs-brand-lockup-centered">
            <Image src="/nacs/t-lines-logo.svg" alt="T Lines" width={190} height={190} priority style={{ width: "min(190px, 62%)", height: "auto" }} />
          </div>
          <div className="gs-rail-copy">
            <p className="gs-eyebrow gs-light">T Lines Store Passport</p>
            <h2>Start your store transformation.</h2>
            <p>A short project brief that lands straight in our team&apos;s pipeline — no back-and-forth needed to get started.</p>
          </div>
          <div className="gs-privacy-note">
            <span className="gs-status-dot" />We only use this to plan your project and follow up.
            <br /><small>T Lines · Store Fixture Manufacturing</small>
          </div>
        </aside>

        <main className="gs-survey-main" ref={mainRef}>
          <div className="gs-mobile-brand">
            <Image src="/nacs/t-lines-logo.svg" alt="T Lines" width={52} height={52} />
            <span>T Lines Store Passport</span>
          </div>

          <div className="gs-progress-wrap">
            <div className="gs-progress-meta"><span>Project journey</span><span>Step {displayStep} of 4</span></div>
            <div className="gs-progress-track"><span style={{ width: `${(displayStep / 4) * 100}%` }} /></div>
          </div>

          <section className="gs-survey-panel" aria-labelledby="gs-step-title">
            <div className="gs-section-marker" aria-hidden="true"><ActiveIcon size={18} strokeWidth={1.6} /></div>
            <header className="gs-step-header">
              <p className="gs-eyebrow">{stepMeta[step].eyebrow}</p>
              <h1 tabIndex={-1} id="gs-step-title">{stepMeta[step].title}</h1>
              <p className="gs-step-description">{stepMeta[step].description}</p>
            </header>
            <ErrorSummary errors={errors} />

            {step === 0 && <StoreTypeStep data={data} update={update} error={errors.storeType} />}
            {step === 1 && <LeaderStep data={data} update={update} errors={errors} />}
            {step === 2 && <BusinessStep data={data} update={update} errors={errors} />}
            {step === 3 && (
              <VisionAndSendStep
                data={data} update={update} errors={errors}
                consentAccepted={consentAccepted} onConsentChange={v => { setConsentAccepted(v); if (v) setConsentError(false); }}
                consentError={consentError}
              />
            )}

            {step < 3 && (
              <div className="gs-navigation">
                {step > 0 ? <button type="button" className="gs-button gs-button-secondary" onClick={back}>Back</button> : <span />}
                <button type="button" className="gs-button gs-button-primary" onClick={next}>
                  {step === 0 ? "Begin survey" : "Continue"}<span aria-hidden="true">→</span>
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="gs-navigation">
                <button type="button" className="gs-button gs-button-secondary" onClick={back} disabled={submitting}>Back</button>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  {submitError && <p className="gs-error-text" role="alert" style={{ margin: 0, textAlign: "right" }}>{submitError}</p>}
                  <button type="button" className="gs-button gs-button-primary" onClick={handleSend} disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="gs-spin" /> : "Send my Store Passport"}
                    {!submitting && <span aria-hidden="true">→</span>}
                  </button>
                </div>
              </div>
            )}
          </section>
          <footer><span>♢ &nbsp; Your answers go straight to the T Lines team.</span><span>Need help? &nbsp; <strong>Contact us&nbsp; →</strong></span></footer>
        </main>
      </div>
    </div>
  );
}

function ErrorSummary({ errors }: { errors: SurveyErrors }) {
  const values = Object.values(errors);
  if (!values.length) return null;
  return (
    <div className="gs-error-summary" role="alert" tabIndex={-1} id="gs-error-summary">
      <strong>Check the highlighted {values.length === 1 ? "answer" : "answers"}.</strong>
      <p>{values[0]}</p>
    </div>
  );
}

function Field({ id, label, hint, optional, error, children }: { id: string; label: string; hint?: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className={`gs-field ${error ? "gs-field-error" : ""}`} data-field={id}>
      <div className="gs-field-label-row"><label htmlFor={id}>{label}</label><span>{optional ? "Optional" : "Required"}</span></div>
      {hint && <p className="gs-field-hint">{hint}</p>}
      {children}
      {error && <p className="gs-error-text" role="alert">{error}</p>}
    </div>
  );
}

function StoreTypeStep({ data, update, error }: { data: SurveyData; update: (n: FieldName, v: string) => void; error?: string }) {
  return (
    <fieldset className={`gs-choice-fieldset ${error ? "gs-has-error" : ""}`} data-field="storeType">
      <legend className="gs-sr-only">Store type</legend>
      <div className="gs-choice-grid gs-store-grid">
        {storeOptions.map(({ value, label, detail, icon: Icon }) => (
          <label className="gs-choice-card" key={value}>
            <input type="radio" name="storeType" value={value} checked={data.storeType === value} onChange={e => update("storeType", e.target.value)} />
            <span className="gs-choice-check"><Check size={14} /></span>
            <Icon className="gs-choice-icon" strokeWidth={1.8} />
            <strong>{label}</strong><small>{detail}</small>
          </label>
        ))}
      </div>
      {error && <p className="gs-error-text" role="alert">{error}</p>}
    </fieldset>
  );
}

type StepProps = { data: SurveyData; update: (n: FieldName, v: string) => void; errors: SurveyErrors };
const bind = (data: SurveyData, update: StepProps["update"], name: FieldName) => ({
  value: data[name],
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update(name, e.target.value),
});

function LeaderStep({ data, update, errors }: StepProps) {
  return (
    <div className="gs-form-grid">
      <Field id="fullName" label="Full name" error={errors.fullName}>
        <input id="fullName" autoComplete="name" placeholder="Jane Smith" {...bind(data, update, "fullName")} />
      </Field>
      <Field id="phone" label="Phone number" error={errors.phone}>
        <input id="phone" type="tel" autoComplete="tel" placeholder="(555) 000-0000" {...bind(data, update, "phone")} />
      </Field>
      <Field id="email" label="Email address" error={errors.email}>
        <input id="email" type="email" autoComplete="email" placeholder="name@company.com" {...bind(data, update, "email")} />
      </Field>
      <div className={`gs-field ${errors.contactPreference ? "gs-field-error" : ""}`} data-field="contactPreference">
        <div className="gs-field-label-row"><label>How should we reach you?</label><span>Required</span></div>
        <div className="gs-tick-grid">
          <label className="gs-tick-card">
            <input type="radio" name="contactPreference" value="whatsapp" checked={data.contactPreference === "whatsapp"} onChange={e => update("contactPreference", e.target.value)} />
            <span className="gs-tick-box"><MessageCircle size={11} /></span>WhatsApp
          </label>
          <label className="gs-tick-card">
            <input type="radio" name="contactPreference" value="email" checked={data.contactPreference === "email"} onChange={e => update("contactPreference", e.target.value)} />
            <span className="gs-tick-box"><Mail size={11} /></span>Email
          </label>
        </div>
        {errors.contactPreference && <p className="gs-error-text" role="alert">{errors.contactPreference}</p>}
      </div>
    </div>
  );
}

function BusinessStep({ data, update, errors }: StepProps) {
  return (
    <div className="gs-form-grid">
      <Field id="companyName" label="Company name" error={errors.companyName}>
        <input id="companyName" autoComplete="organization" placeholder="Company or trading name" {...bind(data, update, "companyName")} />
      </Field>
      <Field id="role" label="Your role in company" error={errors.role}>
        <input id="role" autoComplete="organization-title" placeholder="Owner, operator, project lead…" {...bind(data, update, "role")} />
      </Field>
      <Field id="storeAddress" label="Store address" error={errors.storeAddress}>
        <textarea id="storeAddress" autoComplete="street-address" rows={3} placeholder="Street, city, state, ZIP" {...bind(data, update, "storeAddress")} />
      </Field>
      <Field id="businessPhone" label="Business phone" error={errors.businessPhone}>
        <input id="businessPhone" type="tel" autoComplete="tel" placeholder="(555) 000-0000" {...bind(data, update, "businessPhone")} />
      </Field>
    </div>
  );
}

function VisionAndSendStep({
  data, update, errors, consentAccepted, onConsentChange, consentError,
}: StepProps & {
  consentAccepted: boolean; onConsentChange: (v: boolean) => void; consentError: boolean;
}) {
  return (
    <div className="gs-form-grid">
      <fieldset className={`gs-choice-fieldset ${errors.projectType ? "gs-has-error" : ""}`} data-field="projectType">
        <legend>Project type <span>Required</span></legend>
        <div className="gs-project-grid">
          {projectOptions.map(({ value, label, icon: Icon }) => (
            <label className="gs-project-choice" key={value}>
              <input type="radio" name="projectType" value={value} checked={data.projectType === value} onChange={e => update("projectType", e.target.value)} />
              <span className="gs-project-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
              <strong>{label}</strong><Check size={15} />
            </label>
          ))}
        </div>
        {errors.projectType && <p className="gs-error-text" role="alert">{errors.projectType}</p>}
      </fieldset>

      <Field id="challenges" label="Main project challenges" hint="What should this project solve or improve?" error={errors.challenges}>
        <textarea id="challenges" rows={4} placeholder="Describe the operational, spatial, or customer experience challenge…" {...bind(data, update, "challenges")} />
      </Field>

      <Field id="storeStatus" label="Store status" error={errors.storeStatus}>
        <select id="storeStatus" {...bind(data, update, "storeStatus")}>
          <option value="">Choose a status</option>
          {storeStatusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field id="storeSize" label="Store size" error={errors.storeSize}>
        <select id="storeSize" {...bind(data, update, "storeSize")}>
          <option value="">Choose a size</option>
          {storeSizeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <div className={`gs-timing-panel ${errors.timeline ? "gs-has-error" : ""}`} data-field="timeline">
        <p className="gs-eyebrow">04 — When should we reach you?</p>
        <h2>Pick your timing, then send</h2>
        <p>This is the last step — pick when you&apos;d like us to follow up, then hit Send to submit your Store Passport to the T Lines team.</p>
        <div className="gs-timing-grid">
          {timingOptions.map(t => (
            <label className="gs-timing-card" key={t.value}>
              <input type="radio" name="timeline" value={t.value} checked={data.timeline === t.value} onChange={e => update("timeline", e.target.value)} />
              <strong>{t.label}</strong>
              <span>{t.detail}</span>
            </label>
          ))}
        </div>
        {errors.timeline && <p className="gs-error-text" role="alert" style={{ color: "#f3c7c2" }}>{errors.timeline}</p>}
        <label className="gs-consent-row">
          <input type="checkbox" checked={consentAccepted} onChange={e => onConsentChange(e.target.checked)} />
          I agree to be contacted by T Lines about this project, and for my answers to be stored for that purpose.
        </label>
        {consentError && <p className="gs-error-text" role="alert" style={{ color: "#f3c7c2" }}>Please check the consent box before sending.</p>}
      </div>
    </div>
  );
}

function Success({ data }: { data: SurveyData }) {
  const timingLabel = timingOptions.find(t => t.value === data.timeline)?.label ?? data.timeline;
  return (
    <div className="gs-app">
      <main className="gs-success-page">
        <section className="gs-passport">
          <div className="gs-passport-top">
            <Image src="/nacs/t-lines-logo.svg" alt="T Lines" width={170} height={100} />
            <span>Store Passport</span>
          </div>
          <div className="gs-success-mark"><Check size={26} /></div>
          <h1>Thanks — you&apos;re on our radar.</h1>
          <p className="gs-success-copy">Your project brief has been sent to the T Lines team. Based on your timing, we&apos;ll follow up by {data.contactPreference === "whatsapp" ? "WhatsApp" : "email"}.</p>
          <div className="gs-passport-facts">
            <div><span>Store format</span><strong>{storeOptions.find(o => o.value === data.storeType)?.label ?? "—"}</strong></div>
            <div><span>Timing</span><strong>{timingLabel}</strong></div>
          </div>
        </section>
      </main>
    </div>
  );
}
