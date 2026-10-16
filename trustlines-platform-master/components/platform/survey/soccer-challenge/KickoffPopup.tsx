"use client";

import { motion, AnimatePresence } from "motion/react";
import { FootballIcon } from "./icons";

/** "Kickoff!" popup shown for 2 seconds after a team is picked (the auto-advance timer lives in SoccerChallenge). */
export function KickoffPopup({ show, team, onClose, onContinue }: {
  show: boolean;
  team: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
      <AnimatePresence>
        {show && team && (
          <motion.div
            className="kickoff-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                onClick={onClose}
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
                  onClick={onClose}
                >
                  Change Team
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={onContinue}
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
  );
}
