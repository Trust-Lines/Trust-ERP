// Wizard buttons: navy primary and outline.
export const BUTTON_STYLES = `
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
`;
