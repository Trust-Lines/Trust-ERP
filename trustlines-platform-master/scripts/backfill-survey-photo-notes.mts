// ── Put survey photos that never reached the Activity feed onto it ───────────────────────
// A photo uploaded at the end of the NACS survey always lands in Dropbox + the Prospect's Files
// tab, but the Activity entry (a note on a Contact) was skipped for Prospects that had no
// Contact (survey filled in without a brand name). The upload route now creates the Contact
// itself; this script repairs the ones that already happened.
//
// For every survey-uploaded image with no Activity note yet: make sure the Prospect has a
// Contact (named after the person) and add the "Photo added" note pointing at the SAME Dropbox
// file. Nothing in Dropbox is touched; nothing is deleted or overwritten.
//
// Dry run (default, writes nothing):  npx tsx scripts/backfill-survey-photo-notes.mts
// Real write:                         npx tsx scripts/backfill-survey-photo-notes.mts --apply

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SURVEY_FOLDER_PREFIX = '/marketing/nacs26 contacts/'; // Dropbox path_lower of SURVEY_ATTACHMENTS_ROOT
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes('--apply');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  const { data: files, error } = await admin.from('prospect_files')
    .select('id, prospect_id, dropbox_path, file_name, created_at')
    .is('uploaded_by', null).like('dropbox_path', `${SURVEY_FOLDER_PREFIX}%`).limit(5000);
  if (error) { console.error(error.message); process.exit(1); }

  const images = ((files ?? []) as { id: string; prospect_id: string; dropbox_path: string; file_name: string; created_at: string }[])
    .filter(f => IMAGE_EXT.includes(f.file_name.split('.').pop()?.toLowerCase() ?? ''));

  const { data: existingNotes } = await admin.from('prospect_contact_notes')
    .select('image_path').in('image_path', images.map(f => f.dropbox_path).slice(0, 1000));
  const noted = new Set(((existingNotes ?? []) as { image_path: string }[]).map(n => n.image_path));
  const missing = images.filter(f => !noted.has(f.dropbox_path));

  console.log(`Survey images: ${images.length} · already on Activity: ${images.length - missing.length} · missing: ${missing.length}`);
  if (!missing.length) return;

  let done = 0;
  for (const f of missing) {
    const { data: prospect } = await admin.from('prospects')
      .select('id, display_name, person_name, created_by').eq('id', f.prospect_id).is('deleted_at', null).maybeSingle();
    if (!prospect) { console.log(`- skip ${f.file_name}: Prospect ${f.prospect_id} not found / deleted`); continue; }

    const { data: contacts } = await admin.from('prospect_contacts')
      .select('id').eq('prospect_id', prospect.id).order('is_primary', { ascending: false }).order('created_at', { ascending: true }).limit(1);
    const needsContact = !contacts?.[0];
    console.log(`- ${prospect.display_name}: ${f.file_name}${needsContact ? '  (creates a Contact too)' : ''}`);
    if (!apply) continue;

    let contactId = contacts?.[0]?.id as string | undefined;
    if (!contactId) {
      const { data: created, error: cErr } = await admin.from('prospect_contacts').insert({
        prospect_id: prospect.id, name: prospect.person_name || prospect.display_name || 'Contact',
        is_primary: true, created_by: prospect.created_by,
      }).select('id').single();
      if (cErr) { console.error(`  contact failed: ${cErr.message}`); continue; }
      contactId = created.id as string;
    }
    const { error: nErr } = await admin.from('prospect_contact_notes').insert({
      prospect_contact_id: contactId, author_name: 'Survey', body: 'Photo added at NACS 2026.',
      image_path: f.dropbox_path, source_created_at: f.created_at,
    });
    if (nErr) console.error(`  note failed: ${nErr.message}`); else done++;
  }
  console.log(apply ? `\nAdded ${done} Activity note(s).` : '\nDry run — nothing written. Re-run with --apply.');
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
