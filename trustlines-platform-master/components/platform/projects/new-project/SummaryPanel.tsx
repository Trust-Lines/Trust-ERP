'use client';

import { TriangleAlert } from 'lucide-react';

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
  const rows: { key: string; value: string | undefined; mono?: boolean }[] = [
    { key: 'Project Number', value: watchedCode, mono: true },
    { key: 'Region', value: regionName },
    { key: 'Company', value: companyName },
    { key: 'Categories', value: selectedCats.join(', ') },
    { key: 'Total Deal Value', value: calculatedTotal > 0 ? `${watchedCurrency} ${calculatedTotal.toLocaleString('en-US')}` : undefined },
    { key: 'Dropbox Folder', value: undefined },
    { key: 'Status', value: 'Under Working' },
    { key: 'Client type', value: clientType || 'Individuals' },
  ];

  return (
    <aside className="summary-sidebar-card" aria-label="Project summary">
      <div className="summary-head">
        <h3 className="np-card-title">Project Summary</h3>
        <span className="np-status-badge">
          <TriangleAlert size={16} aria-hidden /> Not Saved yet!
        </span>
      </div>

      {rows.map(r => (
        <div key={r.key} className="summary-row">
          <span className="summary-row-key">{r.key}</span>
          <span className={`summary-row-val${r.mono && r.value ? ' summary-row-val-mono' : ''}`}>{r.value || '-'}</span>
        </div>
      ))}

      <div className="summary-row">
        <span className="summary-row-key">Required fields</span>
        <span className="summary-row-val">{completedRequiredCount} of {totalRequiredCount}</span>
      </div>
    </aside>
  );
}
