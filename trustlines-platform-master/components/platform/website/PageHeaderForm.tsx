'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PAGE_DEFAULTS, type ProjectsPageSettings, type SettingsKey } from '@/lib/web-cms/config';
import { ImageField } from './ImageField';

interface Props {
  settingsKey: SettingsKey;
  initial: ProjectsPageSettings;
  canEdit: boolean;
  /** ImageKit folder for the hero image, e.g. /store-maker/pages/blog-page */
  folder: string;
}

const field = (label: string, node: React.ReactNode, hint?: string) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
    {node}
    {hint && <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 3 }}>{hint}</div>}
  </div>
);

// Hero text + image of one public page (projects_page / blog_page in web_settings).
export function PageHeaderForm({ settingsKey, initial, canEdit, folder }: Props) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const defaults = PAGE_DEFAULTS[settingsKey];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/web-cms/settings/${settingsKey}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      setSettings(b.value);
      toast.success(b.refreshed ? 'Saved — website refreshed' : 'Saved — website updates within a minute');
    } finally { setSaving(false); }
  }

  return (
    <div className="card"><div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28 }}>
      <div>
        {field('Small label above the title', (
          <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.eyebrow} placeholder={defaults.eyebrow}
            onChange={e => setSettings(s => ({ ...s, eyebrow: e.target.value }))} />
        ))}
        {field('Heading', (
          <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.heading} placeholder={defaults.heading}
            onChange={e => setSettings(s => ({ ...s, heading: e.target.value }))} />
        ))}
        {field('Description', (
          <textarea className="form-input" style={{ width: '100%', minHeight: 110 }} disabled={!canEdit} value={settings.description}
            onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} />
        ), 'Leave empty to hide the paragraph.')}
        {field('Image description (alt text)', (
          <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.hero_image_alt}
            onChange={e => setSettings(s => ({ ...s, hero_image_alt: e.target.value }))} />
        ))}
        {canEdit && <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save header'}</button>}
      </div>
      <div>
        {field('Background image', (
          <ImageField value={settings.hero_image_url} height={260} disabled={!canEdit} label="Hero image" folder={folder}
            onChange={url => setSettings(s => ({ ...s, hero_image_url: url }))} />
        ), 'If empty, the website keeps showing its built-in photo.')}
      </div>
    </div></div>
  );
}
