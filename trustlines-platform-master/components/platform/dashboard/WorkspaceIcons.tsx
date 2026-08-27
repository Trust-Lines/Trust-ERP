'use client';

import * as React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// ── 1. CRM: Blue Contact Profile Card ──────────────────────────────────────
export function IconCRM({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="15" y="10" width="34" height="44" rx="6" stroke="#3B82F6" strokeWidth="2.8" fill="#EFF6FF" />
      <circle cx="27" cy="25" r="4.5" fill="#3B82F6" />
      <path d="M20 37C20 33.5 23 31.5 27 31.5C31 31.5 34 33.5 34 37" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="23" x2="43" y2="23" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="28" x2="43" y2="28" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 2. Projects: Blue Folder with Checkmark Badge ─────────────────────────
export function IconProjects({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 22C12 18.6863 14.6863 16 18 16H27L32 21H46C49.3137 21 52 23.6863 52 27V42C52 45.3137 49.3137 48 46 48H18C14.6863 48 12 45.3137 12 42V22Z" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="45" cy="41" r="9" fill="#3B82F6" />
      <path d="M41 41L44 44L49 38" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 3. Customers: Teal Trio of Avatars ────────────────────────────────────
export function IconCustomers({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="21" cy="24" r="4" fill="#5EEAD4" />
      <path d="M14 38C14 33 17 31 21 31C25 31 28 33 28 38" fill="#5EEAD4" />
      <circle cx="43" cy="24" r="4" fill="#5EEAD4" />
      <path d="M36 38C36 33 39 31 43 31C47 31 50 33 50 38" fill="#5EEAD4" />
      <circle cx="32" cy="23" r="5.5" fill="#0D9488" />
      <path d="M22 41C22 35 26.5 32.5 32 32.5C37.5 32.5 42 35 42 41" fill="#0D9488" />
    </svg>
  );
}

// ── 4. Operations: Purple Hierarchy Tree Node ─────────────────────────────
export function IconOperations({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="26" y="12" width="12" height="10" rx="2.5" stroke="#7C3AED" strokeWidth="2.6" fill="#F5F3FF" />
      <path d="M32 22V31M21 31H43M21 31V38M43 31V38" stroke="#7C3AED" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="38" width="12" height="10" rx="2.5" stroke="#7C3AED" strokeWidth="2.6" fill="#F5F3FF" />
      <rect x="37" y="38" width="12" height="10" rx="2.5" stroke="#7C3AED" strokeWidth="2.6" fill="#F5F3FF" />
    </svg>
  );
}

// ── 5. Design: Magenta / Purple Bezier Vector Pen Nib ─────────────────────
export function IconDesign({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M14 26C14 26 23 15 32 15C41 15 50 26 50 26" stroke="#C084FC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="14" cy="26" r="3" fill="#A855F7" />
      <circle cx="50" cy="26" r="3" fill="#A855F7" />
      <circle cx="32" cy="15" r="3" fill="#A855F7" />
      <path d="M32 23L40 33L32 50L24 33L32 23Z" fill="#9333EA" />
      <line x1="32" y1="36" x2="32" y2="50" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="32" cy="35" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}

// ── 6. Sales: Green Growth Chart with Arrow ────────────────────────────────
export function IconSales({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16 38L30 25L38 31L48 16" stroke="#16A34A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 16H48V23" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="42" width="6" height="10" rx="1.5" fill="#86EFAC" />
      <rect x="29" y="34" width="6" height="18" rx="1.5" fill="#4ADE80" />
      <rect x="38" y="27" width="6" height="25" rx="1.5" fill="#22C55E" />
    </svg>
  );
}

// ── 7. Finance & Banking: Teal Classical Bank Building ────────────────────
export function IconFinance({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M14 24L32 12L50 24H14Z" fill="#99F6E4" stroke="#0D9488" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="32" cy="19" r="2" fill="#0D9488" />
      <rect x="16" y="24" width="32" height="3" fill="#0D9488" />
      <line x1="20" y1="27" x2="20" y2="43" stroke="#0D9488" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="28" y1="27" x2="28" y2="43" stroke="#0D9488" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="36" y1="27" x2="36" y2="43" stroke="#0D9488" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="44" y1="27" x2="44" y2="43" stroke="#0D9488" strokeWidth="2.8" strokeLinecap="round" />
      <rect x="14" y="43" width="36" height="3.5" fill="#0D9488" />
      <line x1="10" y1="49" x2="54" y2="49" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 8. Inventory / Containers: Orange 3D Stacked Cubes ────────────────────
export function IconInventory({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Top Cube */}
      <g transform="translate(32, 20)">
        <polygon points="0,-9 9,-3 0,3 -9,-3" fill="#FB923C" />
        <polygon points="-9,-3 0,3 0,13 -9,7" fill="#EA580C" />
        <polygon points="0,3 9,-3 9,7 0,13" fill="#C2410C" />
      </g>
      {/* Bottom Left Cube */}
      <g transform="translate(23, 36)">
        <polygon points="0,-9 9,-3 0,3 -9,-3" fill="#FBBF24" />
        <polygon points="-9,-3 0,3 0,13 -9,7" fill="#F59E0B" />
        <polygon points="0,3 9,-3 9,7 0,13" fill="#D97706" />
      </g>
      {/* Bottom Right Cube */}
      <g transform="translate(41, 36)">
        <polygon points="0,-9 9,-3 0,3 -9,-3" fill="#FDBA74" />
        <polygon points="-9,-3 0,3 0,13 -9,7" fill="#FB923C" />
        <polygon points="0,3 9,-3 9,7 0,13" fill="#EA580C" />
      </g>
    </svg>
  );
}

export const IconContainers = IconInventory;

// ── 9. Procurement: Amber Shopping Cart ───────────────────────────────────
export function IconProcurement({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 16H18L23 38H45L50 22H21" stroke="#D97706" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="#FEF3C7" />
      <circle cx="26" cy="46" r="3.2" stroke="#D97706" strokeWidth="2.5" fill="#FFFFFF" />
      <circle cx="43" cy="46" r="3.2" stroke="#D97706" strokeWidth="2.5" fill="#FFFFFF" />
    </svg>
  );
}

// ── 10. HRM: Coral / Rose Employee Lanyard Badge ──────────────────────────
export function IconHRM({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="28" y="11" width="8" height="6" rx="1.5" fill="#FDA4AF" />
      <rect x="18" y="15" width="28" height="36" rx="5" stroke="#F43F5E" strokeWidth="2.6" fill="#FFF1F2" />
      <rect x="23" y="23" width="10" height="10" rx="2" fill="#F43F5E" />
      <circle cx="28" cy="27" r="2" fill="#FFFFFF" />
      <path d="M25 33C25 31.5 26.5 30.5 28 30.5C29.5 30.5 31 31.5 31 33" fill="#FFFFFF" />
      <line x1="36" y1="25" x2="41" y2="25" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="29" x2="41" y2="29" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="33" x2="41" y2="33" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ── 11. Reports: Purple Document with Pie Chart ───────────────────────────
export function IconReports({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M18 12C18 10.3431 19.3431 9 21 9H37L46 18V49C46 50.6569 44.6569 52 43 52H21C19.3431 52 18 50.6569 18 49V12Z" stroke="#8B5CF6" strokeWidth="2.6" fill="#F5F3FF" strokeLinejoin="round" />
      <path d="M37 9V18H46" stroke="#8B5CF6" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="32" cy="36" r="8" fill="#8B5CF6" />
      <path d="M32 36L32 28A8 8 0 0 1 40 36Z" fill="#C4B5FD" />
    </svg>
  );
}

// ── 12. Setup & Overview: Slate Equalizer Sliders ─────────────────────────
export function IconSetup({ size = 48, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <line x1="16" y1="20" x2="48" y2="20" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="26" cy="20" r="4.5" stroke="#475569" strokeWidth="2.6" fill="#FFFFFF" />
      <line x1="16" y1="32" x2="48" y2="32" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="38" cy="32" r="4.5" stroke="#475569" strokeWidth="2.6" fill="#FFFFFF" />
      <line x1="16" y1="44" x2="48" y2="44" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30" cy="44" r="4.5" stroke="#475569" strokeWidth="2.6" fill="#FFFFFF" />
    </svg>
  );
}
