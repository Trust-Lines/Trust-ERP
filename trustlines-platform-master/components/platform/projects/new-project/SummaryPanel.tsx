'use client';

import { Info } from 'lucide-react';

export function SummaryPanel({
  watchedCode, regionName, companyName, selectedCats, watchedCurrency, calculatedTotal, clientType,
  completedRequiredCount, totalRequiredCount,
}: {
  watchedCode: string | undefined;
  regionName: string | undefined;
  companyName: string | undefined;
  selectedCats: string[];
  watchedCurrency: string;
  calculatedTotal: number;
  clientType: string | undefined;
  completedRequiredCount: number;
  totalRequiredCount: number;
}) {
  return (
    <div className="summary-sidebar-card">
      <div className="summary-head">
        <h3 className="summary-title">Project summary</h3>
        <span className="np-status-badge">Not saved yet</span>
      </div>

      <div className="summary-list">
        <div className="summary-row">
          <span className="summary-row-key">Project number</span>
          <span className="summary-row-val">{watchedCode || 'Pending'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Region</span>
          <span className="summary-row-val">{regionName || 'Not selected'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Company</span>
          <span className="summary-row-val">{companyName || 'Not selected'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Categories</span>
          <span className="summary-row-val">{selectedCats.length > 0 ? selectedCats.join(', ') : 'None'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Total deal value</span>
          <span className="summary-row-val">{watchedCurrency} {calculatedTotal.toLocaleString('en-US')}</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Dropbox folder</span>
          <span className="summary-row-val summary-row-val-mono">—</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Status</span>
          <span className="summary-row-val">Under Working</span>
        </div>

        <div className="summary-row">
          <span className="summary-row-key">Client type</span>
          <span className="summary-row-val">{clientType || 'Individuals'}</span>
        </div>
      </div>

      <div className="summary-footer-box">
        <div className="summary-info-text">
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>Select Region, Company and location to continue</span>
        </div>

        <div>
          <div className="progress-label-row">
            <span>{completedRequiredCount} of {totalRequiredCount} required fields</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${(completedRequiredCount / totalRequiredCount) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
