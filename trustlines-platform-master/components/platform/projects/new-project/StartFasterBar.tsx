'use client';

import { Sparkles, Folder, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';

/** "Quick Creation" card: link an existing Dropbox project, or auto-fill from a deal email. */
export function StartFasterBar({ open, onToggleOpen, emailText, setEmailText, isExtracting, extractMsg, onExtract, onToggleDropboxBrowser }: {
  /** Collapsed to its title row once the user is past step 1 (Figma), reopenable any time. */
  open: boolean;
  onToggleOpen: () => void;
  emailText: string;
  setEmailText: (text: string) => void;
  isExtracting: boolean;
  extractMsg: string;
  onExtract: () => void;
  onToggleDropboxBrowser: () => void;
}) {
  return (
    <div className="np-card np-quick-card">
      <button type="button" className="np-quick-toggle" aria-expanded={open} onClick={onToggleOpen}>
        <h2 className="np-card-title">Quick Creation</h2>
        {open ? <ChevronDown size={22} aria-hidden /> : <ChevronRight size={22} aria-hidden />}
      </button>
      {open && (
      <div className="np-quick-grid">
        <div className="np-quick-pattern">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span className="np-quick-symbol"><FolderOpen size={32} strokeWidth={1.5} aria-hidden /></span>
            <p className="np-quick-title">Browse Existing Dropbox Projects</p>
          </div>
          <button type="button" className="btn-primary-navy" onClick={onToggleDropboxBrowser}>
            <Folder size={16} aria-hidden />
            <span>Browse</span>
          </button>
        </div>

        <div className="np-quick-pattern wide">
          <div>
            <p className="np-quick-title">Auto-fill</p>
            <p className="np-quick-sub">Paste deal email to auto-fill the form</p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Email"
            aria-label="Deal email"
            value={emailText}
            onChange={e => setEmailText(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary-navy"
            onClick={onExtract}
            disabled={isExtracting || !emailText.trim()}
          >
            <Sparkles size={15} aria-hidden />
            <span>{isExtracting ? 'Extracting...' : 'Extract from email'}</span>
          </button>
          {extractMsg && (
            <span
              className="np-quick-msg"
              style={{ color: extractMsg.includes('extracted') ? 'var(--status-t6-fg)' : 'var(--status-t10-fg)' }}
            >
              {extractMsg}
            </span>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
