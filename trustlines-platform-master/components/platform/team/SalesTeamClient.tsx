'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';

export interface SalesRepRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  sales_region_id: string | null;
}

export interface RegionClient {
  id: string;
  name: string;
  code: string | null;
}

interface Props {
  reps: SalesRepRow[];
  regionClients: RegionClient[];
  nextNumber: number;
}

export function SalesTeamClient({ reps, regionClients, nextNumber }: Props) {
  const router = useRouter();

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail]           = useState('');
  const [fullName, setFullName]     = useState('');
  const [regionId, setRegionId]     = useState('');
  const [inviting, setInviting]     = useState(false);
  const [savingRegion, setSavingRegion] = useState<string | null>(null);

  async function handleInvite() {
    if (!email.trim() || !fullName.trim()) { toast.error('Name and email are required'); return; }
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          role: 'sales_rep',
          sales_region_id: regionId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(data.alreadyExisted ? 'Existing user re-invited.' : 'Sales rep invited.');
      setEmail(''); setFullName(''); setRegionId(''); setShowInvite(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  }

  async function handleRegionChange(userId: string, newRegionId: string) {
    setSavingRegion(userId);
    try {
      const res = await fetch('/api/sales-team/assign-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sales_region_id: newRegionId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update region');
      toast.success('Region updated.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update region');
    } finally {
      setSavingRegion(null);
    }
  }

  const [nextEdit, setNextEdit] = useState(String(nextNumber));
  const [savingNext, setSavingNext] = useState(false);

  async function handleCounterSave() {
    const val = parseInt(nextEdit, 10);
    if (!Number.isFinite(val) || val < 1) { toast.error('Enter a valid number (1 or more)'); return; }
    setSavingNext(true);
    try {
      const res = await fetch('/api/sales/sequences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_number: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Saved — the next project number is ${data.nextNumber}.`);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update number'); }
    finally { setSavingNext(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Sales Team</h1>
          <p className="page-head-sub">{reps.length} sales rep{reps.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(v => !v)}>
          <UserPlus size={15} /> Invite sales rep
        </button>
      </div>

      {showInvite && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="form-label required">Full name</label>
                <input className="form-input" placeholder="e.g. Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="form-label required">Email</label>
                <input className="form-input" type="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 360 }}>
              <label className="form-label">Region</label>
              <select className="form-input form-select" value={regionId} onChange={e => setRegionId(e.target.value)}>
                <option value="">No region (assign later)</option>
                {regionClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={inviting || !email.trim() || !fullName.trim()}>
                {inviting ? 'Inviting…' : 'Send invite'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flush">
          {reps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
              No sales reps yet. Invite your first one above.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Email</th>
                  <th>Region</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reps.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={r.full_name} size="sm" />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{r.full_name}</span>
                      </span>
                    </td>
                    <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{r.email}</span></td>
                    <td>
                      <select
                        className="form-input form-select"
                        style={{ maxWidth: 240, fontSize: 13 }}
                        value={r.sales_region_id ?? ''}
                        disabled={savingRegion === r.id}
                        onChange={e => handleRegionChange(r.id, e.target.value)}
                      >
                        <option value="">— Unassigned</option>
                        {regionClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="pill" style={{
                        background: r.is_active ? 'var(--status-success-bg)' : 'var(--bg-subtle)',
                        color: r.is_active ? 'var(--status-success-fg)' : 'var(--fg-faint)',
                      }}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Project number</h2>
        <p className="page-head-sub" style={{ marginBottom: 12 }}>
          One running number for <b>all</b> projects (Trust &amp; Sales). The next project uses this number; every project after it increments by 1. Set the starting number here, or correct it if needed.
        </p>
        <div className="card">
          <div className="card-body">
            <label className="form-label">Next project number</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input" type="number" min="1" step="1"
                value={nextEdit}
                onChange={e => setNextEdit(e.target.value)}
                style={{ maxWidth: 160, fontFamily: 'var(--font-mono)' }}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={savingNext || nextEdit.trim() === String(nextNumber)}
                onClick={handleCounterSave}
              >
                {savingNext ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="form-hint" style={{ marginTop: 8 }}>
              e.g. set to <b>460</b> → the next project code becomes like <b>STW&nbsp;460</b>, then 461, 462… (the company + region only change the prefix).
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
