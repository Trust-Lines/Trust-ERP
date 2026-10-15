import type { Potential } from './types';

export function PotentialsTab({ activePotentials, donePotentials }: { activePotentials: Potential[]; donePotentials: Potential[] }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
        System-created for a Need with future timing — never chosen manually.
      </p>
      {activePotentials.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
          No active Potentials{donePotentials.length > 0 ? ' — all attached evidence and became Opportunities' : ' yet'}.
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {activePotentials.map(p => (
            <div key={p.id} className="card"><div className="card-body">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                Status: {p.status}{p.target_contact_date && ` · Contact by ${p.target_contact_date}`}
              </div>
            </div></div>
          ))}
        </div>
      )}
      {donePotentials.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11.5, color: 'var(--fg-faint)', cursor: 'pointer' }}>
            {donePotentials.length} converted/closed Potential{donePotentials.length === 1 ? '' : 's'}
          </summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {donePotentials.map(p => (
              <div key={p.id} className="card" style={{ opacity: 0.7 }}><div className="card-body">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                  Status: {p.status}{p.converted_opportunity_id && ' · Converted to Opportunity'}
                </div>
              </div></div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
