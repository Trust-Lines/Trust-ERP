"use client";

import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FootballPhoneScene } from "./FootballPhoneScene";
import { MiniFootball3D } from "./MiniFootball3D";

type SurveyData = Record<string, string>;

const steps = ["Pick your team", "Meet the player", "Your business", "Store status", "Final review", "Victory card"];
const teams = ["Convenience Stores", "Grocery Stores", "Truck Stop", "Other"];
const initialData: SurveyData = {
  fullName: "",
  position: "",
  phone: "",
  email: "",
  contactPreference: "",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  storeStatus: "",
  storeSize: "",
  storeNeed: "",
  storeType: "",
  mainChallenges: "",
  projectTimeline: "",
  companyWebsite2: ""
};

const requiredByStep = [
  [],
  ["fullName", "position", "phone", "email", "contactPreference"],
  ["companyName", "companyAddress", "companyPhone"],
  ["storeStatus", "storeSize", "storeNeed", "storeType", "mainChallenges", "projectTimeline"]
];

const TIMING_MAP: Record<string, string> = {
  "ASAP (Next 3 months)": "0_3_months",
  "3-6 Months": "3_6_months",
  "6-12 Months": "6_12_months",
  "Still Planning": "12_plus_months"
};
const PROJECT_TYPE_MAP: Record<string, string[]> = {
  "I want to remodel my existing store": ["small_remodel"],
  "I have a new store coming up": ["new_construction"],
  "Both - remodel and new store": ["small_remodel", "new_construction"]
};

function buildSubmissionPayload(team: string, data: SurveyData, submissionToken: string, consentTextVersion: string) {
  const [firstName, ...rest] = (data.fullName || "").trim().split(/\s+/);
  const notesLines = [
    team ? `Team: ${team}` : null,
    data.contactPreference ? `Preferred contact: ${data.contactPreference}` : null,
    data.companyPhone ? `Store phone: ${data.companyPhone}` : null,
    data.storeStatus ? `Store status: ${data.storeStatus}` : null,
    data.storeSize ? `Store size: ${data.storeSize}` : null,
    data.storeType ? `Store type: ${data.storeType}` : null,
    data.storeNeed ? `Project scope: ${data.storeNeed}` : null,
    data.mainChallenges ? `Main challenges: ${data.mainChallenges}` : null
  ].filter(Boolean);

  return {
    leadType: "organization" as const,
    organizationName: data.companyName || undefined,
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    email: data.email || undefined,
    phone: data.phone || undefined,
    jobTitle: data.position || undefined,
    city: data.companyAddress || undefined,
    storeAddress: data.companyAddress || undefined,
    team: team || undefined,
    projectTypes: PROJECT_TYPE_MAP[data.storeNeed] ?? [],
    timing: TIMING_MAP[data.projectTimeline] ?? undefined,
    notes: notesLines.join("\n") || undefined,
    consentAccepted: true,
    consentTextVersion,
    submissionToken,
    honeypot: data.companyWebsite2 || ""
  };
}

async function submitSurveyResponse(campaignSlug: string, team: string, data: SurveyData, submissionToken: string, consentTextVersion: string) {
  const res = await fetch(`/api/public/campaigns/${campaignSlug}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSubmissionPayload(team, data, submissionToken, consentTextVersion))
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Something went wrong — please try again.");
  }
  return body as { ok: true; submissionId: string; status: string };
}

function TeamIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "Convenience Stores":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="team-card-icon" {...common}>
          <path d="M4 10h16v10H4z" />
          <path d="m3 10 2-6h14l2 6M8 20v-6h5v6M3 10c1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0" />
        </svg>
      );
    case "Grocery Stores":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="team-card-icon" {...common}>
          <path d="M3 4h2l2.4 10h9.8l2-7H6" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="17" cy="19" r="1" />
        </svg>
      );
    case "Truck Stop":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="team-card-icon" {...common}>
          <path d="M5 21V4h10v17M4 21h12M8 8h4" />
          <path d="M15 7h2l2 3v7a1.5 1.5 0 0 0 3 0v-6l-2-2" />
        </svg>
      );
    case "Other":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="team-card-icon" {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
  }
}

function FootballIcon() {
  return (
    <span className="football-badge" aria-hidden="true">
      <MiniFootball3D />
    </span>
  );
}

function StepIcon({ index, complete }: { index: number; complete: boolean }) {
  if (complete) {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="step-svg-icon check" aria-hidden="true">
        <path d="M16.666 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  switch (index) {
    case 0:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polygon points="12 8 13.5 11 17 11.5 14.5 14 15 17.5 12 15.5 9 17.5 9.5 14 7 11.5 10.5 11 12 8" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <path d="M3 9l2-5h14l2 5M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18" />
          <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
        </svg>
      );
    case 4:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <path d="M11 5h10v4h-4.5L14 13H8a5 5 0 0 1-5-5V5a2 2 0 0 1 2-2h6v2z" />
          <circle cx="8" cy="8" r="1.5" />
          <path d="M10 13l3 8" />
        </svg>
      );
    case 5:
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="step-svg-icon">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16M12 15v7M6 4h12v6a6 6 0 0 1-12 0V4z" />
        </svg>
      );
  }
}

function Field({
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
      <span className="field-label">{label}</span>
      {children ? (
        <div className="select-wrapper">
          <select name={name} value={value} onChange={(e) => update(name, e.target.value)} required>
            {children}
          </select>
          <svg className="select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : type === "textarea" ? (
        <textarea name={name} value={value} placeholder={placeholder} onChange={(e) => update(name, e.target.value)} required />
      ) : (
        <input name={name} value={value} type={type} placeholder={placeholder} onChange={(e) => update(name, e.target.value)} required />
      )}
    </label>
  );
}

const FIREWORK_PALETTE = ["#154528", "#fde047", "#a16207", "#ffffff", "#dff2e6"];

function VictoryFireworks({ reduceMotion }: { reduceMotion: boolean }) {
  const bursts = useMemo(() => {
    if (reduceMotion) return [];
    return Array.from({ length: 4 }, (_, b) => {
      const cx = 12 + b * 24 + Math.random() * 10;
      const cy = 14 + Math.random() * 16;
      const rocketDelay = 0.15 + b * 0.42;
      const rocketDuration = 0.5 + Math.random() * 0.12;
      const burstDelay = rocketDelay + rocketDuration - 0.04;
      const size = 15 + Math.floor(Math.random() * 6);
      return {
        id: b,
        cx,
        cy,
        rocketDelay,
        rocketDuration,
        burstDelay,
        color: FIREWORK_PALETTE[b % FIREWORK_PALETTE.length],
        particles: Array.from({ length: size }, (_, i) => {
          const angle = (i / size) * Math.PI * 2 + Math.random() * 0.25;
          const radius = 46 + Math.random() * 46;
          return {
            id: i,
            dx: Math.cos(angle) * radius,
            dy: Math.sin(angle) * radius,
            color: FIREWORK_PALETTE[(b + i) % FIREWORK_PALETTE.length],
            size: 4 + Math.random() * 3
          };
        })
      };
    });
  }, [reduceMotion]);

  if (!bursts.length) return null;

  return (
    <div className="firework-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <div key={burst.id} className="firework-origin" style={{ left: `${burst.cx}%`, top: `${burst.cy}%` }}>
          <motion.span
            className="firework-rocket"
            style={{ background: `linear-gradient(to top, ${burst.color}, transparent)` }}
            initial={{ y: 130, opacity: 0, scaleY: 0.5 }}
            animate={{ y: 0, opacity: [0, 1, 1, 0], scaleY: 1 }}
            transition={{ duration: burst.rocketDuration, delay: burst.rocketDelay, ease: "easeOut" }}
          />
          <motion.span
            className="firework-glow"
            style={{ background: `radial-gradient(circle, ${burst.color}55 0%, transparent 70%)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 2.4, 3.2], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.6, delay: burst.burstDelay, ease: "easeOut" }}
          />
          {burst.particles.map((p) => (
            <motion.span
              key={p.id}
              className="firework-particle"
              style={{ background: p.color, width: p.size, height: p.size }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{
                x: [0, p.dx * 0.9, p.dx * 1.08],
                y: [0, p.dy * 0.75, p.dy + 46],
                opacity: [0, 1, 0],
                scale: [0.6, 1, 0.5]
              }}
              transition={{ duration: 1.35, delay: burst.burstDelay, ease: [0.16, 0.8, 0.3, 1], times: [0, 0.45, 1] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const CONFETTI_PALETTE = ["#154528", "#fde047", "#a16207", "#ffffff", "#dff2e6", "#0d2417"];

function VictoryConfetti({ reduceMotion }: { reduceMotion: boolean }) {
  const pieces = useMemo(() => {
    if (reduceMotion) return [];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.8 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 90,
      rotate: 180 + Math.random() * 360,
      width: 5 + Math.random() * 4,
      height: 9 + Math.random() * 6,
      color: CONFETTI_PALETTE[i % CONFETTI_PALETTE.length],
      round: i % 4 === 0
    }));
  }, [reduceMotion]);

  if (!pieces.length) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: p.round ? "50%" : "1px"
          }}
          initial={{ y: -24, x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: 560, x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

export function SoccerChallenge({ campaignSlug, consentTextVersion }: { campaignSlug: string; consentTextVersion: string }) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [team, setTeam] = useState("");
  const [showTeamPopup, setShowTeamPopup] = useState(false);
  const [data, setData] = useState<SurveyData>(initialData);
  const [errors, setErrors] = useState<string[]>([]);
  const [scoring, setScoring] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionToken] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const contentRef = useRef<HTMLElement>(null);
  const completedFields = useMemo(() => Object.values(data).filter(Boolean).length, [data]);
  const score = completedFields * 5;
  const level = completedFields > 11 ? "Champion" : completedFields > 8 ? "Star player" : completedFields > 4 ? "First team" : team ? "Kickoff" : "Warm-up";

  function update(name: string, value: string) {
    setData((current) => ({ ...current, [name]: value }));
    setErrors((current) => current.filter((item) => item !== name));
  }

  useEffect(() => {
    if (!showTeamPopup) return;
    const timer = setTimeout(() => {
      setShowTeamPopup(false);
      if (step === 0) {
        goNext();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [showTeamPopup, step, team]);

  function goNext() {
    if (step === 0 && !team) {
      setErrors(["team"]);
      return;
    }
    const missing = (requiredByStep[step] ?? []).filter((name) => !data[name]?.trim());
    if (missing.length) {
      setErrors(missing);
      contentRef.current?.querySelector<HTMLElement>(`[name="${missing[0]}"]`)?.focus();
      return;
    }
    setErrors([]);
    setStep((current) => Math.min(current + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    goNext();
  }

  function reset() {
    setStep(0);
    setTeam("");
    setShowTeamPopup(false);
    setData(initialData);
    setErrors([]);
    setConsentAccepted(false);
    setSubmitError(null);
  }

  async function confirmAndScore() {
    if (scoring || submitting) return;
    if (!consentAccepted) {
      setSubmitError("Please check the consent box to submit.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitSurveyResponse(campaignSlug, team, data, submissionToken, consentTextVersion);
      setScoring(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function finishGoal() {
    window.setTimeout(() => {
      setStep(5);
      setScoring(false);
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }, reduceMotion ? 80 : 300);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="header-left">
          <div className="event-tag">
            <span className="header-football-badge" aria-hidden="true">
              <MiniFootball3D />
            </span>
            <span className="event-tag-text">Soccer Challenge · NACS 2026</span>
          </div>
        </div>

        <div className="brand">
          <Image src="/nacs/t-lines-logo.svg" alt="T LINES" width={280} height={90} priority className="brand-logo" />
        </div>

        <div className="scorecard">
          <div className="score-stat">
            <small>Player level</small>
            <strong>
              <svg className="stat-icon level-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.8 19 5.2v5.4c0 4.6-2.7 8.3-7 10.6-4.3-2.3-7-6-7-10.6V5.2L12 2.8Z" />
                <path d="m8.4 9.2 2.1 1.4-.8 2.5 2.3-1.5 2.3 1.5-.8-2.5 2.1-1.4H13l-1-2.5-1 2.5H8.4Z" />
              </svg>
              {level}
            </strong>
          </div>
          <div className="score-stat">
            <small>Score</small>
            <strong>
              <svg className="stat-icon score-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4h8v3.7a4 4 0 0 1-8 0V4Z" />
                <path d="M8 6H4.8v1.2A3.8 3.8 0 0 0 8.6 11M16 6h3.2v1.2a3.8 3.8 0 0 1-3.8 3.8M12 12v4M8.5 20h7M9.5 16h5v4" />
              </svg>
              {score} <span className="unit">goals</span>
            </strong>
          </div>
        </div>
      </header>

      <section className="survey-panel" ref={contentRef} aria-live="polite">
        <section className="match-pitch-progress" aria-label={`Match progress: stage ${step + 1} of 6`}>
          <header className="pitch-header">
            <div className="pitch-title-group">
              <span className="pitch-label">Match Progress</span>
              <span className="pitch-stage-badge">Stage {step + 1} of 6</span>
            </div>
            <div className="pitch-level-indicator">
              <span className="level-dot" />
              <span className="level-name">{level}</span>
            </div>
          </header>
          <div className="pitch-track" aria-hidden="true">
            <i className="goal goal-left" />
            <i className="penalty-area area-left" />
            <i className="halfway-line" />
            <i className="center-circle" />
            <i className="penalty-area area-right" />
            <i className="goal goal-right" />
            <div className="pitch-progress-line" />
            <ol className="pitch-steps">
              {steps.map((label, index) => (
                <li key={label} className={index < step ? "complete" : index === step ? "active" : ""}>
                  <span className="step-node" aria-label={`Step ${index + 1}: ${label}`}>
                    <StepIcon index={index} complete={index < step} />
                  </span>
                  <b className="step-label">{label}</b>
                </li>
              ))}
            </ol>
            <span className="pitch-ball" style={{ left: `${8.33 + step * 16.67}%` }}>
              <motion.span
                className="football-motion"
                initial={false}
                animate={{ x: 0, y: 0, rotate: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              >
                <FootballIcon />
              </motion.span>
            </span>
          </div>
        </section>

        <form onSubmit={submit} noValidate>
          <input
            type="text"
            name="companyWebsite2"
            value={data.companyWebsite2}
            onChange={(e) => update("companyWebsite2", e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />
          <section key={step} className="step-container">
            {step === 0 && (
              <>
                <span className="overline-tag">Kickoff</span>
                <h1 className="step-heading">Pick your team</h1>
                <p className="intro">Select the store category that best describes your retail business.</p>
                <div className="team-grid" role="radiogroup" aria-label="Store type">
                  {teams.map((label) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={team === label}
                      className={`team-card ${team === label ? "selected" : ""}`}
                      key={label}
                      onClick={() => {
                        setTeam(label);
                        setErrors([]);
                        setShowTeamPopup(true);
                      }}
                    >
                      <div className="team-card-inner">
                        <div className="team-icon-circle">
                          <TeamIcon name={label} />
                        </div>
                        <strong className="team-title">{label}</strong>
                        <p className="team-desc">
                          {label === "Convenience Stores"
                            ? "Neighborhood and quick-service retail"
                            : label === "Grocery Stores"
                              ? "Supermarkets and fresh food markets"
                              : label === "Truck Stop"
                                ? "Travel plazas and fueling centers"
                                : "Custom retail and special formats"}
                        </p>
                        <div className="team-arrow-circle">
                          <svg className="team-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M4.167 10h11.666M10 4.167L15.833 10 10 15.833" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.includes("team") && (
                  <p className="error" role="alert">
                    Please select a team to begin.
                  </p>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <span className="overline-tag">Player details</span>
                <h1 className="step-heading">Meet the player</h1>
                <p className="intro">Tell us how our team can connect with you following NACS 2026.</p>
                <div className="field-grid">
                  <Field label="Full name" name="fullName" value={data.fullName} update={update} placeholder="e.g. Alex Morgan" />
                  <Field label="Position / job title" name="position" value={data.position} update={update} placeholder="e.g. Store Owner, Operations Manager" />
                  <Field label="Phone number" name="phone" value={data.phone} update={update} type="tel" placeholder="(555) 000-0000" />
                  <Field label="Email address" name="email" value={data.email} update={update} type="email" placeholder="name@company.com" />
                  <Field label="Preferred contact method" name="contactPreference" value={data.contactPreference} update={update} wide>
                    <option value="">Select contact method</option>
                    <option>Phone Call</option>
                    <option>WhatsApp Text Message</option>
                    <option>Email</option>
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <span className="overline-tag">Business details</span>
                <h1 className="step-heading">Your business</h1>
                <p className="intro">Share the key details about your store.</p>
                <div className="field-grid">
                  <Field label="Store name" name="companyName" value={data.companyName} update={update} placeholder="Store Name" />
                  <Field label="Store phone number" name="companyPhone" value={data.companyPhone} update={update} type="tel" placeholder="Store Phone Number" />
                  <Field label="Store address" name="companyAddress" value={data.companyAddress} update={update} type="textarea" placeholder="Street address, City, State, ZIP" wide />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <span className="overline-tag">Project details</span>
                <h1 className="step-heading">Store status</h1>
                <p className="intro">Help us understand your project scope and upcoming timelines.</p>
                <div className="field-grid">
                  <Field label="Store status" name="storeStatus" value={data.storeStatus} update={update}>
                    <option value="">Select store status</option>
                    <option>New Store (Planning)</option>
                    <option>Existing Store (Operating)</option>
                    <option>Expansion Plan</option>
                  </Field>
                  <Field label="Store size" name="storeSize" value={data.storeSize} update={update}>
                    <option value="">Select square footage</option>
                    <option>Small (0 - 2,000 sqft)</option>
                    <option>Medium (2,000 - 5,000 sqft)</option>
                    <option>Large (5,000+ sqft)</option>
                  </Field>
                  <Field label="Project type" name="storeNeed" value={data.storeNeed} update={update} wide>
                    <option value="">Select project scope</option>
                    <option>I want to remodel my existing store</option>
                    <option>I have a new store coming up</option>
                    <option>Both - remodel and new store</option>
                    <option>I'm considering it</option>
                    <option>Not right now</option>
                  </Field>
                  <Field label="Store type" name="storeType" value={data.storeType} update={update}>
                    <option value="">Select store category</option>
                    <option>C-Store</option>
                    <option>Truck Stop</option>
                    <option>Grocery Market</option>
                    <option>Other</option>
                  </Field>
                  <Field label="Project timeline" name="projectTimeline" value={data.projectTimeline} update={update}>
                    <option value="">Select target timeline</option>
                    <option>ASAP (Next 3 months)</option>
                    <option>3-6 Months</option>
                    <option>6-12 Months</option>
                    <option>Still Planning</option>
                  </Field>
                  <Field label="Main challenges or needs" name="mainChallenges" value={data.mainChallenges} update={update} type="textarea" placeholder="What key goals or improvements would you like to achieve?" wide />
                </div>
              </>
            )}

            {step === 4 && (
              <div className={`final-review-layout ${scoring ? "is-scoring" : ""}`}>
                <div className="scene-container">
                  <FootballPhoneScene shoot={scoring} reducedMotion={Boolean(reduceMotion)} onGoal={finishGoal} />
                </div>
                <div className="review">
                  <span className="overline-tag">Final Whistle</span>
                  <h1 className="step-heading">Ready for the final kick?</h1>
                  <p className="intro">Review your match summary before taking the shot on goal.</p>
                  <dl className="review-dl">
                    {[
                      ["Team", team, 0],
                      ["Player", data.fullName, 1],
                      ["Business", data.companyName, 2],
                      ["Project", data.storeNeed, 3],
                      ["Timeline", data.projectTimeline, 3]
                    ].map(([label, value, target]) => (
                      <div className="review-row" key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{value || <span className="empty-val">—</span>}</dd>
                        <button type="button" className="edit-btn" onClick={() => setStep(Number(target))}>
                          Edit
                        </button>
                      </div>
                    ))}
                  </dl>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => { setConsentAccepted(e.target.checked); setSubmitError(null); }}
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
            )}

            {step === 5 && (
              <div className="victory-layout">
                <VictoryConfetti reduceMotion={Boolean(reduceMotion)} />
                <VictoryFireworks reduceMotion={Boolean(reduceMotion)} />
                <div className="scene-container">
                  <FootballPhoneScene shoot={false} scored reducedMotion={Boolean(reduceMotion)} />
                </div>
                <motion.div
                  className="victory"
                  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <motion.span
                    className="overline-tag badge-gold"
                    initial={reduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 0.8, 0.3, 1] }}
                  >
                    Full Time
                  </motion.span>
                  <h1 className="step-heading">Goal scored!</h1>
                  <p className="intro">Thanks, {data.fullName}. You successfully completed the T LINES Soccer Challenge. Please collect your gift ball from our host at the booth.</p>
                  <div className="victory-actions">
                    <button type="button" className="text-button" onClick={reset}>
                      Start a new match
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </section>

          {step < 5 && (
            <div className="form-actions-wrapper">
              <div className="form-actions">
                {step > 0 ? (
                  <button type="button" className="secondary-btn" disabled={scoring} onClick={() => setStep(step - 1)}>
                    <svg className="btn-arrow left" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                ) : (
                  <span />
                )}
                {step === 4 ? (
                  <button type="button" className="primary-btn score-action" disabled={scoring || submitting} onClick={confirmAndScore}>
                    {scoring || submitting ? (
                      <>
                        <span className="spinner" />
                        {submitting ? "Sending…" : "Shooting…"}
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
          )}
        </form>
        {step > 0 && step < 5 && <p className="data-note">Your progress stays on this device.</p>}
      </section>

      <AnimatePresence>
        {showTeamPopup && team && (
          <motion.div
            className="kickoff-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTeamPopup(false)}
          >
            <motion.div
              className="kickoff-popup-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kickoff-popup-title"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="kickoff-popup-close"
                aria-label="Close popup"
                onClick={() => setShowTeamPopup(false)}
              >
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>

              <div className="kickoff-popup-body">
                <div className="congrats-ball-wrapper">
                  <FootballIcon />
                </div>
                <div className="congrats-text">
                  <h3 id="kickoff-popup-title" className="congrats-title">
                    Kickoff!
                  </h3>
                  <p className="congrats-subtitle">
                    Match underway! You selected <strong>{team}</strong>.
                  </p>
                </div>
              </div>

              <div className="kickoff-popup-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowTeamPopup(false)}
                >
                  Change Team
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    setShowTeamPopup(false);
                    goNext();
                  }}
                >
                  Continue to Match
                  <svg className="btn-arrow right" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <div className="kickoff-timer-track" aria-hidden="true">
                <motion.div
                  className="kickoff-timer-bar"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 2, ease: "linear" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
