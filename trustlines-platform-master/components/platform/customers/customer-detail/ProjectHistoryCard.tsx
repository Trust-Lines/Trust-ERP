import Link from 'next/link';
import type { ProjectRow } from './types';

export function ProjectHistoryCard({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="card">
      <div className="card-head"><div className="form-section-title">Project history ({projects.length})</div></div>
      <div className="card-body" style={{ padding: projects.length ? 0 : undefined }}>
        {projects.length === 0 ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
            No linked projects yet. Link this customer to a lead — on delivery the project appears here.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <Link href={`/projects/${p.id}`} style={{ fontWeight: 600 }}>{p.code}</Link>
                    <span style={{ color: 'var(--fg-subtle)', marginLeft: 8 }}>{p.name}</span>
                    {p.is_draft && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>Draft</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-subtle)', textTransform: 'capitalize' }}>
                    {(p.current_stage ?? '').replace(/_/g, ' ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
