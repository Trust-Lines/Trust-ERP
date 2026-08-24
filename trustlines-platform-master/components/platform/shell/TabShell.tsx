'use client';

import * as React from 'react';
import { useTabs, HOME_TAB_ID } from './TabContext';

interface TabShellProps {
  /** The children (e.g. Home launcher) rendered in the primary Home tab */
  children: React.ReactNode;
}

export function TabShell({ children }: TabShellProps) {
  const { tabs, activeTabId } = useTabs();
  const loadedIframes = React.useRef<Set<string>>(new Set());

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-neutral-50/50 text-neutral-900">
      {/* ── Home Tab Panel (Direct React DOM rendering) ───────────── */}
      <div
        role="tabpanel"
        aria-label="Home"
        className={`absolute inset-0 overflow-y-auto ${
          activeTabId === HOME_TAB_ID ? 'block' : 'hidden'
        }`}
      >
        {children}
      </div>

      {/* ── Dynamic Module & Dashboard Tabs (Loaded inside isolated viewports) ── */}
      {tabs
        .filter(t => !t.pinned)
        .map(tab => {
          const isActive = tab.id === activeTabId;
          if (isActive) loadedIframes.current.add(tab.id);
          const isLoaded = loadedIframes.current.has(tab.id);

          return (
            <div
              key={tab.id}
              role="tabpanel"
              aria-label={tab.label}
              className={`absolute inset-0 w-full h-full bg-white ${
                isActive ? 'block' : 'hidden'
              }`}
            >
              {isLoaded && (
                <iframe
                  src={tab.href}
                  title={tab.label}
                  className="w-full h-full border-none block"
                />
              )}
            </div>
          );
        })}
    </div>
  );
}
