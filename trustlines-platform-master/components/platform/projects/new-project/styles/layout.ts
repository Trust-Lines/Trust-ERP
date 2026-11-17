// Page wrapper, top header (title, subtitle, cancel) and the shared card shell.
export const LAYOUT_STYLES = `
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
`;
