"use client";

import { motion } from "motion/react";
import { FootballPhoneScene } from "../FootballPhoneScene";
import { VictoryConfetti, VictoryFireworks } from "./VictoryEffects";

/** Step 6 — "Victory card": confetti, thank-you text and "Start a new match". */
export function StepVictory({ reduceMotion, fullName, uploadFailures, onReset }: {
  reduceMotion: boolean | null;
  fullName: string;
  uploadFailures: string[];
  onReset: () => void;
}) {
  return (
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
                  <p className="intro">Thanks, {fullName}. You successfully completed the T LINES Soccer Challenge. Please collect your gift ball from our host at the booth.</p>
                  {uploadFailures.length > 0 && (
                    <p className="error" role="alert">
                      Your answers were saved, but we couldn&apos;t upload: {uploadFailures.join(", ")}. Please show it to our host at the booth.
                    </p>
                  )}
                  <div className="victory-actions">
                    <button type="button" className="text-button" onClick={onReset}>
                      Start a new match
                    </button>
                  </div>
                </motion.div>
              </div>
  );
}
