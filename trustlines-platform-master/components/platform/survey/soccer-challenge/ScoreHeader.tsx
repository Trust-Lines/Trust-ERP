"use client";

import Image from "next/image";
import { MiniFootball3D } from "../MiniFootball3D";

/** Top bar: event tag, T LINES logo and the live "Player level / Score" card. */
export function ScoreHeader({ level, score, eventName }: { level: string; score: number; eventName: string }) {
  return (
      <header className="topbar">
        <div className="header-left">
          <div className="event-tag">
            <span className="header-football-badge" aria-hidden="true">
              <MiniFootball3D />
            </span>
            <span className="event-tag-text">Soccer Challenge · {eventName}</span>
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
  );
}
