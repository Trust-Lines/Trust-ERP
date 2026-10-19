'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Pencil, Trash2, MapPin } from 'lucide-react';
import { LocationForm } from './LocationForm';
import { locationLabel, type ProspectLocation } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function LocationsTab({
  locations, canEdit, addingLocation, setAddingLocation, editingLocationId, setEditingLocationId,
  onSave, onUpdate, onDelete,
}: {
  locations: ProspectLocation[];
  canEdit?: boolean;
  addingLocation: boolean;
  setAddingLocation: Dispatch<SetStateAction<boolean>>;
  editingLocationId: string | null;
  setEditingLocationId: (id: string | null) => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setAddingLocation(s => !s)}>+ Add location</button>
        </div>
      )}
      {addingLocation && canEdit && (
        <div style={{ marginBottom: 12 }}>
          <LocationForm onSave={onSave} onCancel={() => setAddingLocation(false)} />
        </div>
      )}
      {locations.length === 0 ? (
        <div className="card"><EmptyState size="sm" className="justify-center px-4 py-8" icon={<MapPin />} title="No locations yet." /></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {locations.map(l => {
            if (editingLocationId === l.id) {
              return <LocationForm key={l.id} initial={l} onSave={payload => onUpdate(l.id, payload)} onCancel={() => setEditingLocationId(null)} />;
            }
            return (
            <div key={l.id} className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{locationLabel(l)}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                  {[l.address_line_1, l.city, l.state, l.postal_code, l.country].filter(Boolean).join(', ') || '—'}
                </div>
                {l.store_status && <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Status: {l.store_status}</div>}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingLocationId(l.id)}><Pencil size={12} /> Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDelete(l.id)}><Trash2 size={13} /></button>
                </div>
              )}
            </div></div>
            );
          })}
        </div>
      )}
    </div>
  );
}
