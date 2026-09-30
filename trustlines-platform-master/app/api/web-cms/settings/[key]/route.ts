import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { PAGE_DEFAULTS, SETTINGS_KEYS, isImageKitUrl, type SettingsKey } from '@/lib/web-cms/config';
import { pingWebsite } from '@/lib/web-cms/revalidate';

type Params = { params: Promise<{ key: string }> };
const isKey = (k: string): k is SettingsKey => (SETTINGS_KEYS as readonly string[]).includes(k);

export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { key } = await params;
  if (!isKey(key)) return NextResponse.json({ error: 'Unknown setting' }, { status: 404 });
  const { data, error } = await admin.from('web_settings').select('value, updated_at').eq('key', key).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ value: { ...PAGE_DEFAULTS[key], ...(data?.value ?? {}) }, updated_at: data?.updated_at ?? null });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { key } = await params;
  if (!isKey(key)) return NextResponse.json({ error: 'Unknown setting' }, { status: 404 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const image = s(b?.hero_image_url);
  if (image && !isImageKitUrl(image)) return NextResponse.json({ error: 'Hero image must be an ImageKit URL' }, { status: 400 });
  const value = {
    eyebrow: s(b?.eyebrow), heading: s(b?.heading) || PAGE_DEFAULTS[key].heading,
    description: s(b?.description), hero_image_url: image, hero_image_alt: s(b?.hero_image_alt),
  };

  const { error } = await admin.from('web_settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_settings.updated', resource: `web_settings:${key}`, newValue: value });
  const refreshed = await pingWebsite();
  return NextResponse.json({ value, refreshed });
}
