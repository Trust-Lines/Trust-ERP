"use client";

import { teams } from "./constants";
import { TeamIcon } from "./icons";

/** Step 1 — "Pick your team" (store category, optional). */
export function StepPickTeam({ team, errors, onPick }: { team: string; errors: string[]; onPick: (label: string) => void }) {
  return (
              <>
                <span className="overline-tag">Kickoff</span>
                <h1 className="step-heading">Pick your team</h1>
                <p className="intro">Select the store category that best describes your retail business (optional).</p>
                <div className="team-grid" role="radiogroup" aria-label="Store type">
                  {teams.map((label) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={team === label}
                      className={`team-card ${team === label ? "selected" : ""}`}
                      key={label}
                      onClick={() => onPick(label)}
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
  );
}
