"use client";

import { useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SURVEY_REPRESENTATIVES } from "@/lib/marketing/surveyRepresentatives";
import {
  EMAIL_PATTERN, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, initialData, newSubmissionToken, requiredByStep,
  type Companion, type SurveyData,
} from "./soccer-challenge/constants";
import { compressImage, submitSurveyResponse, uploadAttachment } from "./soccer-challenge/submission";
import { StickyNote } from "./soccer-challenge/StickyNote";
import { ScoreHeader } from "./soccer-challenge/ScoreHeader";
import { MatchProgress } from "./soccer-challenge/MatchProgress";
import { StepPickTeam } from "./soccer-challenge/StepPickTeam";
import { StepMeetPlayer } from "./soccer-challenge/StepMeetPlayer";
import { StepBusiness } from "./soccer-challenge/StepBusiness";
import { StepStoreStatus } from "./soccer-challenge/StepStoreStatus";
import { StepFinalReview } from "./soccer-challenge/StepFinalReview";
import { StepVictory } from "./soccer-challenge/StepVictory";
import { FormActions } from "./soccer-challenge/FormActions";
import { KickoffPopup } from "./soccer-challenge/KickoffPopup";

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
  const [submissionToken, setSubmissionToken] = useState(newSubmissionToken);
  const [noteOpen, setNoteOpen] = useState(false);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const contactMethods = data.contactPreference ? data.contactPreference.split("|") : [];
  const completedFields =useMemo(() => Object.values(data).filter(Boolean).length, [data]);
  const score = completedFields * 5;
  const level = completedFields > 11 ? "Champion" : completedFields > 8 ? "Star player" : completedFields > 4 ? "First team" : team ? "Kickoff" : "Warm-up";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nacs.representative");
      if (saved && (SURVEY_REPRESENTATIVES as readonly string[]).includes(saved)) setData((c) => ({ ...c, representative: saved }));
    } catch { /* storage unavailable — the dropdown still works */ }
  }, []);

  function update(name: string, value: string) {
    if (name === "representative") {
      try { localStorage.setItem("nacs.representative", value); } catch { /* ignore */ }
    }
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
    const missing = (requiredByStep[step] ?? []).filter((name) => !data[name]?.trim() || (name === "email" && !EMAIL_PATTERN.test(data[name].trim())));
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
    setData({ ...initialData, representative: data.representative }); // same person keeps entering the next one
    setErrors([]);
    setConsentAccepted(false);
    setSubmitError(null);
    setCompanions([]);
    setNoteOpen(false);
    setAttachments([]);
    setAttachmentError(null);
    setUploadFailures([]);
    setSubmissionToken(newSubmissionToken()); // a new match is a new submission — reusing the token made the server treat it as a duplicate and drop it
  }

  function updateCompanion(index: number, patch: Partial<Companion>) {
    setCompanions((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function addAttachments(list: FileList | null) {
    if (!list?.length) return;
    setAttachmentError(null);
    const accepted: File[] = [];
    for (const original of Array.from(list)) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        setAttachmentError(`You can add up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      const file = await compressImage(original);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`"${original.name}" is too large (max 200 MB).`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) setAttachments((current) => [...current, ...accepted]);
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
      const outcome = await submitSurveyResponse(campaignSlug, team, data, submissionToken, consentTextVersion, companions);
      // Attachments go up after the lead exists (they hang off the submission). A failed
      // upload never blocks the goal — it's reported on the victory screen instead.
      const failed: string[] = [];
      for (const [index, file] of attachments.entries()) {
        try {
          await uploadAttachment(campaignSlug, outcome.submissionId, submissionToken, file, (fraction) =>
            setUploadProgress(`Uploading file ${index + 1} of ${attachments.length} · ${Math.round(fraction * 100)}%`)
          );
        } catch {
          failed.push(file.name);
        }
      }
      setUploadProgress(null);
      setUploadFailures(failed);
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
      <ScoreHeader level={level} score={score} />

      <section className="survey-panel" ref={contentRef} aria-live="polite">
        <MatchProgress step={step} level={level} reduceMotion={reduceMotion} />

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
              <StepPickTeam
                team={team}
                errors={errors}
                onPick={(label) => {
                  setTeam(label);
                  setErrors([]);
                  setShowTeamPopup(true);
                }}
              />
            )}

            {step === 1 && (
              <StepMeetPlayer
                data={data}
                update={update}
                contactMethods={contactMethods}
                companions={companions}
                setCompanions={setCompanions}
                updateCompanion={updateCompanion}
              />
            )}

            {step === 2 && <StepBusiness data={data} update={update} />}

            {step === 3 && <StepStoreStatus data={data} update={update} />}

            {step === 4 && (
              <StepFinalReview
                scoring={scoring}
                submitting={submitting}
                reduceMotion={reduceMotion}
                onGoal={finishGoal}
                team={team}
                data={data}
                companions={companions}
                onEditStep={setStep}
                attachments={attachments}
                setAttachments={setAttachments}
                onAddAttachments={addAttachments}
                attachmentError={attachmentError}
                photoInputRef={photoInputRef}
                fileInputRef={fileInputRef}
                consentAccepted={consentAccepted}
                onConsentChange={(checked) => { setConsentAccepted(checked); setSubmitError(null); }}
                submitError={submitError}
              />
            )}

            {step === 5 && (
              <StepVictory reduceMotion={reduceMotion} fullName={data.fullName} uploadFailures={uploadFailures} onReset={reset} />
            )}
          </section>

          {step < 5 && (
            <FormActions
              step={step}
              scoring={scoring}
              submitting={submitting}
              uploadProgress={uploadProgress}
              errors={errors}
              onBack={() => setStep(step - 1)}
              onScore={confirmAndScore}
            />
          )}
        </form>
        {step > 0 && step < 5 && <p className="data-note">Your progress stays on this device.</p>}
      </section>

      {step < 5 && step !== 3 && (
        <StickyNote value={data.mainChallenges} open={noteOpen} onToggle={() => setNoteOpen((o) => !o)} onChange={(v) => update("mainChallenges", v)} />
      )}

      <KickoffPopup
        show={showTeamPopup}
        team={team}
        onClose={() => setShowTeamPopup(false)}
        onContinue={() => {
          setShowTeamPopup(false);
          goNext();
        }}
      />
    </main>
  );
}
