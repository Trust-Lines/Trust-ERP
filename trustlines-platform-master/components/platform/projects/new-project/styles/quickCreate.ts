// Quick Creation card: pattern tiles and the collapse toggle.
export const QUICK_CREATE_STYLES = `
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
`;
