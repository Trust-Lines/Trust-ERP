"use client";

import { motion } from "motion/react";
import { steps } from "./constants";
import { FootballIcon, StepIcon } from "./icons";

/** The pitch-shaped progress bar: 6 stages with the ball moving along the halfway line. */
export function MatchProgress({ step, level, reduceMotion }: { step: number; level: string; reduceMotion: boolean | null }) {
  return (
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
  );
}
