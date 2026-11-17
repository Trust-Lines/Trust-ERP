// Dark theme overrides (html.dark). Keep last so they win over the base rules.
export const DARK_THEME_STYLES = `
      /* ── Dark theme (html.dark) ───────────────────────────────── */
      .dark .np-title,
      .dark .np-card-title,
      .dark .summary-row-val { color: var(--ui-heading); }
      .dark .np-progress-step.active,
      .dark .np-progress-step.completed,
      .dark .np-quick-toggle,
      .dark .np-cat-chip { color: var(--ui-heading); }
      .dark .np-cat-chip.selected { background: var(--ui-tab-badge); border-color: var(--ui-tab-badge); }
      .dark .auto-badge { background: #2A3A52; color: var(--ui-tab-active); }
      .dark .np-cat-value-label { color: var(--ui-heading); }
      .dark .btn-primary-navy { background: var(--ui-tab-badge); border-color: var(--ui-tab-badge) !important; }
      .dark .btn-outline-custom { background: transparent; border-color: var(--ui-divider-strong); color: var(--ui-heading); }
`;
