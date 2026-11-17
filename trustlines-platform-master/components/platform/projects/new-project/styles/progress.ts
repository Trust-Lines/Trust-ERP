// Horizontal step progress bar.
export const PROGRESS_STYLES = `
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
`;
