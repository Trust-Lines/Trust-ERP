// Page-scoped styles for the New / Edit project wizard (moved verbatim from NewProjectForm.tsx).
export const NEW_PROJECT_STYLES = `
      .new-project-wrapper {
        display: flex;
        flex-direction: column;
        gap: 20px;
        color: #1e293b;
      }
      .np-top-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      .np-top-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .np-title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0;
        color: #0f172a;
      }
      .np-status-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 9999px;
        background: #f1f5f9;
        color: #64748b;
        font-size: 12px;
        font-weight: 500;
      }
      .np-top-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .np-user-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        color: #334155;
      }
      .np-user-avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #3a4869ff
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
      }

      /* Start faster Banner */
      .start-faster-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      }
      .start-faster-label {
        font-weight: 700;
        font-size: 14px;
        color: #0f172a;
        white-space: nowrap;
      }
      .dropbox-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border: 1.5px solid #0f172a
        border-radius: 8px;
        background: #ffffff;
        color: #0f172a;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .dropbox-btn:hover {
        background: #eff6ff;
      }
      .start-faster-input-container {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .start-faster-input {
        width: 100%;
        padding: 8px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13px;
        color: #0f172a;
      }
      .start-faster-input::placeholder {
        color: #94a3b8;
      }
      .extract-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease;
      }
      .extract-btn:hover:not(:disabled) {
        background: #0f172a;
      }
      .extract-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary-navy {
        background: #0f172a;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 8px 18px !important;
        font-weight: 600 !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: background 0.15s ease !important;
      }
      .btn-primary-navy:hover:not(:disabled) {
        background: #0f172a !important;
      }

      /* 3-Column Grid Dashboard */
      .np-dashboard-grid {
        display: grid;
        grid-template-columns: 240px 1fr 280px;
        gap: 20px;
        align-items: start;
      }

      /* Stepper Sidebar */
      .stepper-sidebar {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px 12px;
      }
      .step-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        position: relative;
        user-select: none;
      }
      .step-icon-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #cbd5e1;
        background: #ffffff;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .step-item.active .step-icon-circle {
        border-color: #0f172a;
        background: #0f172a;
        color: #ffffff;
        box-shadow: 0 0 0 5px #dbeafe;
      }
      .step-item.completed .step-icon-circle {
        border-color: #0f172a
        background: #eff6ff;
        color: #0f172a;
      }
      .step-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .step-title-text {
        font-size: 14px;
        font-weight: 600;
        color: #475569;
      }
      .step-item.active .step-title-text {
        color: #0f172a;
        font-weight: 700;
      }
      .step-subtitle-text {
        font-size: 11.5px;
        color: #94a3b8;
      }

      /* Step Content Card */
      .step-content-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        min-height: 480px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .step-card-header {
        margin-bottom: 20px;
      }
      .step-card-title {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
      .step-card-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }

      .form-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 16px;
      }
      .form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 16px;
      }

      /* Form elements customization */
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
        background: #eff6ff;
        color: #0f172a;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 8px;
      }

      .step-footer-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #f1f5f9;
      }

      /* Summary Sidebar */
      .summary-sidebar-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      }
      .summary-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f1f5f9;
      }
      .summary-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .summary-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      .summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
      }
      .summary-row-key {
        color: #64748b;
      }
      .summary-row-val {
        font-weight: 600;
        color: #0f172a;
        text-align: right;
      }
      .summary-row-val-mono {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
      }

      .summary-footer-box {
        padding-top: 16px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .summary-info-text {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #0f172a;
        background: #eff6ff;
        padding: 8px 12px;
        border-radius: 8px;
      }
      .progress-label-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 6px;
      }
      .progress-bar-bg {
        width: 100%;
        height: 6px;
        background: #e2e8f0;
        border-radius: 9999px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: #0f172a;
        border-radius: 9999px;
        transition: width 0.3s ease;
      }

      .btn-outline-custom {
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
      }
      .btn-outline-custom:hover {
        background: #f8fafc;
      }
      /* ── Dark theme (html.dark) ───────────────────────────────── */
      .dark .new-project-wrapper { color: var(--ui-body); }
      .dark .np-top-header { border-bottom-color: var(--ui-divider); }
      .dark .np-title,
      .dark .start-faster-label,
      .dark .step-card-title,
      .dark .summary-title { color: var(--ui-heading); }
      .dark .np-status-badge { background: color-mix(in srgb, var(--color-error-dark) 45%, transparent); color: #F2A7AC; }
      .dark .np-user-badge { background: var(--bg-subtle); border-color: var(--ui-divider-strong); color: var(--ui-body); }
      .dark .np-user-avatar { background: var(--color-secondary-600); }

      .dark .start-faster-card,
      .dark .step-content-card,
      .dark .summary-sidebar-card { background: var(--ui-surface-elevated); border-color: var(--ui-divider); box-shadow: 0 1px 2px rgba(0,0,0,0.4); }
      .dark .dropbox-btn { background: transparent; border: 1.5px solid var(--ui-divider-strong); color: var(--ui-heading); }
      .dark .dropbox-btn:hover { background: rgba(255,255,255,0.05); }
      .dark .start-faster-input { background: var(--bg-sunken); border-color: var(--ui-divider-strong); color: var(--ui-heading); }
      .dark .start-faster-input::placeholder { color: var(--ui-text-secondary); }
      .dark .extract-btn { background: var(--bg-subtle); border: 1px solid var(--ui-divider-strong); color: var(--ui-heading); }
      .dark .extract-btn:hover:not(:disabled) { background: #2A3340; }

      .dark .btn-primary-navy { background: var(--ui-tab-badge); }
      .dark .btn-primary-navy:hover:not(:disabled) { background: #3A7BE0 !important; }
      .dark .btn-outline-custom { background: transparent; border-color: var(--ui-divider-strong); color: var(--ui-heading); }
      .dark .btn-outline-custom:hover { background: rgba(255,255,255,0.05); }

      .dark .step-icon-circle { background: var(--bg-subtle); border-color: var(--ui-divider-strong); color: var(--ui-text-secondary); }
      .dark .step-item.active .step-icon-circle { background: #2A3A52; border-color: var(--ui-tab-active); color: var(--ui-heading); box-shadow: 0 0 0 5px rgba(143,193,255,0.18); }
      .dark .step-item.completed .step-icon-circle { background: #1E2C40; border-color: var(--ui-tab-active); color: var(--ui-tab-active); }
      .dark .step-title-text { color: var(--ui-body); }
      .dark .step-item.active .step-title-text { color: var(--ui-heading); }
      .dark .step-subtitle-text,
      .dark .step-card-subtitle,
      .dark .summary-row-key,
      .dark .progress-label-row { color: var(--ui-text-secondary); }

      .dark .auto-badge { background: #2A3A52; color: var(--ui-tab-active); }
      .dark .step-footer-actions,
      .dark .summary-head,
      .dark .summary-footer-box { border-color: var(--ui-divider); }
      .dark .summary-row-val { color: var(--ui-heading); }
      .dark .summary-info-text { background: #1E2C40; color: #CFE2FF; }
      .dark .progress-bar-bg { background: #2C3542; }
      .dark .progress-bar-fill { background: var(--ui-tab-active); }

    `;
