// Page-scoped styles for the New / Edit project wizard.
// Figma "Project Detail" (node 253:11944): semantic --ui-* / --status-t* tokens, so light and
// dark both come from app/globals.css instead of hard-coded slate colours.
export const NEW_PROJECT_STYLES = `
      .new-project-wrapper {
        display: flex;
        flex-direction: column;
        gap: 32px;
        color: var(--ui-body);
      }
      .np-top-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .np-top-header-left {
        display: flex;
        flex-direction: column;
        gap: 5px;
        line-height: 1.35;
      }
      .np-title {
        font-size: 28px;
        font-weight: 600;
        line-height: 1.35;
        margin: 0;
        color: var(--color-secondary-700);
      }
      .np-subtitle {
        font-size: 13px;
        color: var(--ui-body);
        margin: 0;
      }
      .np-cancel-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 24px 0 14px;
        border-radius: 6px;
        border: 1px solid var(--status-t10-bg);
        background: var(--status-t10-bg);
        color: var(--status-t10-fg);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      .np-cancel-btn:hover { filter: brightness(0.97); }

      /* Shared card shell */
      .np-card {
        background: var(--ui-page-bg);
        border: 1px solid var(--ui-divider);
        border-radius: 8px;
        padding: 20px;
      }
      .np-card-title {
        font-size: 20px;
        font-weight: 600;
        line-height: 1.45;
        color: var(--color-secondary-700);
        margin: 0;
      }

      /* Quick Creation */
      .np-quick-card {
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      .np-quick-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 517px);
        gap: 32px;
      }
      .np-quick-pattern {
        background: var(--ui-surface-elevated);
        border: 1px solid var(--ui-divider);
        border-radius: 8px;
        padding: 20px 24px;
        min-height: 196px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        text-align: center;
      }
      .np-quick-pattern.wide { padding: 20px 40px; }
      .np-quick-symbol {
        display: flex;
        padding: 16px;
        border-radius: 12px;
        background: var(--ui-surface);
        color: var(--ui-body);
      }
      .np-quick-title {
        font-size: 20px;
        font-weight: 600;
        line-height: 1.45;
        color: var(--ui-body);
        margin: 0;
      }
      .np-quick-sub {
        font-size: 14px;
        line-height: 1.45;
        color: var(--ui-text-secondary);
        margin: 0;
      }
      .np-quick-msg { font-size: 12px; }
      .np-quick-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--color-secondary-700);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      /* Step 2 category chips */
      .np-cat-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .np-cat-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        padding: 12px;
        border: 1px solid var(--ui-input-border);
        border-radius: 6px;
        background: var(--ui-input-bg);
        color: var(--color-secondary-700);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: -0.022em;
        white-space: nowrap;
        cursor: pointer;
      }
      .np-cat-chip:hover { background: var(--ui-hover-bg); }
      .np-cat-chip.selected {
        padding-right: 22px;
        border-color: var(--color-secondary-700);
        background: var(--color-secondary-700);
        color: #ffffff;
        font-size: 12px;
      }
      .np-cat-chip.dashed {
        padding-right: 16px;
        border: 2px dashed var(--ui-input-border);
        color: var(--ui-body);
      }
      /* Evidence box (Capture New Contact → Classification) */
      .np-evidence {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px 20px;
        border: 1px solid var(--ui-divider);
        border-radius: 8px;
        background: var(--ui-surface-elevated);
      }
      .np-evidence-drop {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        text-align: center;
      }
      .np-evidence-file {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        max-width: 420px;
        padding: 6px 10px;
        border: 1px solid var(--ui-input-border);
        border-radius: 6px;
        font-size: 13px;
        color: var(--ui-body);
      }

      /* Dial-code + number phone input */
      .np-phone {
        display: flex;
        align-items: stretch;
        min-height: 42px;
        border: 1px solid var(--ui-input-border);
        border-radius: 6px;
        background: var(--ui-input-bg);
        overflow: hidden;
      }
      .np-phone:focus-within { border-color: var(--border-focus); box-shadow: var(--shadow-focus); }
      .np-phone-code {
        width: 65px;
        flex-shrink: 0;
        border: 0;
        border-right: 1px solid var(--ui-input-border);
        border-radius: 0;
        padding: 0 8px 0 14px;
        background: var(--ui-input-bg);
        color: var(--color-secondary-700);
        font-size: 11px;
        font-weight: 600;
      }
      .np-phone-number {
        flex: 1;
        min-width: 0;
        border: 0;
        padding: 0 16px;
        background: transparent;
        color: var(--ui-body);
        font: inherit;
        font-size: 14px;
        outline: none;
      }
      .dark .np-phone-code { color: var(--ui-heading); }

      .np-cat-value-label { color: var(--color-secondary-700); }

      .np-value-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px 32px;
      }

      .btn-primary-navy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        background: var(--color-secondary-700);
        color: #ffffff !important;
        border: 1px solid var(--color-secondary-700) !important;
        border-radius: 6px !important;
        padding: 10px 32px !important;
        font-weight: 500 !important;
        font-size: 13px !important;
        line-height: normal;
        cursor: pointer !important;
      }
      .btn-primary-navy:hover:not(:disabled) { filter: brightness(1.1); }
      .btn-primary-navy:disabled { opacity: 0.6; cursor: not-allowed !important; }

      .btn-outline-custom {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--color-secondary-700);
        background: var(--ui-input-bg);
        color: var(--color-secondary-700);
        font-size: 13px;
        font-weight: 500;
        line-height: normal;
        padding: 10px 32px;
        border-radius: 6px;
        cursor: pointer;
      }
      .btn-outline-custom.muted {
        border-color: var(--ui-divider);
        color: var(--ui-body);
      }
      .btn-outline-custom:hover { background: var(--ui-hover-bg); }

      /* Horizontal form progress */
      .np-progress {
        display: flex;
        gap: 8px;
        overflow-x: auto;
      }
      .np-progress-step {
        flex: 1 0 0;
        min-width: 140px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 8px;
        border: 0;
        border-radius: 6px;
        background: var(--ui-surface);
        color: var(--ui-body);
        font: inherit;
        font-size: 13px;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
      }
      .np-progress-step.active {
        background: var(--ui-selected-bg);
        color: var(--color-secondary-700);
        font-weight: 600;
      }
      .np-progress-marker {
        width: 24px;
        height: 24px;
        border-radius: 12px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ui-input-bg);
        color: var(--ui-text-secondary);
        font-size: 12px;
        font-weight: 600;
      }
      .np-progress-step.active .np-progress-marker {
        background: var(--color-secondary-700);
        color: #ffffff;
      }
      .np-progress-step.completed { color: var(--color-secondary-700); }
      .np-progress-step.completed .np-progress-marker {
        background: var(--color-secondary-700);
        color: #ffffff;
      }

      /* Form + summary */
      .np-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .np-main-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 365px;
        gap: 24px;
        align-items: stretch;
      }
      .step-content-card {
        min-height: 480px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 32px;
      }
      .step-card-header { margin-bottom: 32px; }

      .new-project-wrapper .form-label {
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        color: var(--ui-body);
        margin-bottom: 7px;
      }
      .new-project-wrapper .form-input {
        min-height: 42px;
        padding: 10px 12px;
        font-size: 14px;
        line-height: 1.4;
        border-color: var(--ui-input-border);
        border-radius: 6px;
        background-color: var(--ui-input-bg);
        color: var(--ui-body);
      }
      .new-project-wrapper .form-input::placeholder { color: var(--ui-body); opacity: 0.8; }

      .form-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px 32px;
        margin-bottom: 16px;
      }
      .form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .input-with-badge {
        position: relative;
        display: flex;
        align-items: center;
      }
      .auto-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: var(--ui-selected-bg);
        color: var(--color-secondary-700);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 8px;
      }

      .step-footer-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .step-footer-right {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-left: auto;
      }

      /* Summary */
      .summary-sidebar-card {
        background: var(--ui-surface);
        border: 1px solid var(--ui-divider);
        border-radius: 8px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        align-self: start;
      }
      .summary-head {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .np-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 2px 20px 2px 12px;
        border-radius: 4px;
        background: var(--status-t7-bg);
        color: var(--status-t7-fg);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: -0.022em;
      }
      .summary-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .summary-row-key {
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        color: var(--ui-body);
      }
      .summary-row-val {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;
        letter-spacing: -0.022em;
        color: var(--color-secondary-700);
        overflow-wrap: anywhere;
      }
      .summary-row-val-mono {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
      }

      .new-project-wrapper .form-hint { display: block; }

      /* Side summary needs ~760px for the form beside it (304px app sidebar + 365px panel). */
      @media (max-width: 1400px) {
        .np-quick-grid,
        .np-main-grid { grid-template-columns: minmax(0, 1fr); }
      }

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
