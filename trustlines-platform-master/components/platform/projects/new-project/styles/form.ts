// Step form: layout grid, step card, labels / inputs, form grids, auto badge, footer.
export const FORM_STYLES = `
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

      .new-project-wrapper .form-hint { display: block; }
`;
