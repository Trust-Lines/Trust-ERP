// Summary side panel.
export const SUMMARY_STYLES = `
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
`;
