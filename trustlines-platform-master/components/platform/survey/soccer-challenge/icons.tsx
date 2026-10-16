"use client";

import { MiniFootball3D } from "../MiniFootball3D";

export function TeamIcon({ name }: { name: string }) {
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

export function FootballIcon() {
  return (
    <span className="football-badge" aria-hidden="true">
      <MiniFootball3D />
    </span>
  );
}

export function StepIcon({ index, complete }: { index: number; complete: boolean }) {
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
