// Special inputs: category chips, evidence box, phone input, value row.
export const FIELD_STYLES = `
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
`;
