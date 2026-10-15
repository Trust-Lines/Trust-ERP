'use client';

import { Sparkles, Folder } from 'lucide-react';

export function StartFasterBar({ emailText, setEmailText, isExtracting, extractMsg, onExtract, onToggleDropboxBrowser }: {
  emailText: string;
  setEmailText: (text: string) => void;
  isExtracting: boolean;
  extractMsg: string;
  onExtract: () => void;
  onToggleDropboxBrowser: () => void;
}) {
  return (
    <div className="start-faster-card">
      <span className="start-faster-label">Start faster</span>
      <button
        type="button"
        className="dropbox-btn"
        onClick={onToggleDropboxBrowser}
      >
        <Folder size={14} color="#7287b4ff" />
        <span>Browse existing Dropbox projects</span>
      </button>
      <div className="start-faster-input-container">
        <input
          type="text"
          className="start-faster-input"
          placeholder="Paste deal email to auto-fill the form"
          value={emailText}
          onChange={e => setEmailText(e.target.value)}
        />
        <button
          type="button"
          className="extract-btn"
          onClick={onExtract}
          disabled={isExtracting || !emailText.trim()}
        >
          <Sparkles size={13} />
          <span>{isExtracting ? 'Extracting...' : 'Extract from email'}</span>
        </button>
      </div>
      {extractMsg && (
        <span style={{ fontSize: 12, color: extractMsg.includes('extracted') ? '#16a34a' : '#dc2626' }}>
          {extractMsg}
        </span>
      )}
    </div>
  );
}
