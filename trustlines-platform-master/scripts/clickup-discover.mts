// ── ClickUp workspace discovery — READ-ONLY, writes nothing to ClickUp or our DB ────
// Run once CLICKUP_API_TOKEN is in .env.local:
//   npm run clickup:discover
// Walks Team → Space → Folder/List → custom field schema, and pulls a handful of sample
// tasks from lists that look Customer/Project-related, so we can see the REAL shape of
// the user's ClickUp data before designing any import mapping — never guess column
// names ahead of this (see CLAUDE.md's "önce bir mini audit yap" rule, same principle
// applied to an external system instead of our own schema).
//
// Team/Space enumeration ONLY returns Spaces the caller is a full member of — a List
// individually shared with the caller ("Shared with Me" in the ClickUp sidebar, e.g. a
// list called "Opportunities NE") lives in a Space the walk never sees. For those, pass
// the ID from its browser URL directly (works whether it's a List id or a View id —
// inspectId() below tries both):
//   npm run clickup:discover -- dhdc7-54915 901304904957
// e.g. https://app.clickup.com/14202247/v/l/dhdc7-54915 → dhdc7-54915
//
// Output: printed to the console AND saved to scripts/clickup-discovery-output.json
// (gitignored — may contain real customer/project names) for easier review.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  getAuthorizedTeams, getSpaces, getFolders, getFolderlessLists, getFolder, getList, getListCustomFields, getAllListTasks,
  getView, getAllViewTasks,
  type ClickUpListSummary,
} from '../lib/clickup/client';

// Manual .env.local loader — same pattern as the one-off DB probes used earlier in this
// project (no dotenv dependency in this repo).
function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

// Lists whose name suggests they hold Customer or Project data get a deeper look
// (custom fields + a few sample tasks). Everything else is still listed for context,
// just not sampled — keeps output readable on a large workspace.
const INTERESTING_NAME_PATTERN = /customer|client|project|lead|deal|contact|account/i;
const SAMPLE_TASK_COUNT = 3;

interface DiscoveredList {
  id: string; name: string; path: string;
  customFields: { name: string; type: string; options?: string[] }[];
  taskCount: number | null;
  sampleTasks: { name: string; customFields: Record<string, unknown> }[];
}

/** `dropdown` values are an option INDEX; `labels` values are an array of option IDs.
 * Both resolve to readable text via the field's inlined option catalog — falls back to
 * the raw value untouched for every other field type. */
function resolveTaskFieldValue(cf: { type: string; value: unknown; type_config?: { options?: { id: string; name?: string; label?: string }[] } }): unknown {
  const options = cf.type_config?.options;
  if (!options) return cf.value;
  const nameOf = (o: { id: string; name?: string; label?: string }) => o.name ?? o.label ?? o.id;
  if (cf.type === 'drop_down' && typeof cf.value === 'number') return nameOf(options[cf.value]) ?? cf.value;
  if (cf.type === 'labels' && Array.isArray(cf.value)) {
    return cf.value.map(id => nameOf(options.find(o => o.id === id) ?? { id: String(id) }));
  }
  return cf.value;
}

/** Full inspection of one List — always used for an explicit List ID (given on the
 * command line), and for any List the hierarchy walk finds whose name looks
 * customer/project-related. */
async function inspectList(listId: string, name: string, path: string): Promise<DiscoveredList> {
  const fields = await getListCustomFields(listId);
  const tasks = await getAllListTasks(listId);
  console.log(`      custom fields: ${fields.map(f => `${f.name} (${f.type})`).join(', ') || '(none)'}`);
  console.log(`      ${tasks.length} task(s) total`);

  const sample = tasks.slice(0, SAMPLE_TASK_COUNT).map(t => ({
    name: t.name,
    customFields: Object.fromEntries(t.custom_fields.map(cf => [cf.name, resolveTaskFieldValue(cf)])),
  }));

  return {
    id: listId, name, path,
    customFields: fields.map(f => ({ name: f.name, type: f.type, options: f.type_config?.options?.map(o => (o.name ?? o.label ?? o.id)) })),
    taskCount: tasks.length,
    sampleTasks: sample,
  };
}

/** For an ID that came off a browser URL — could be a List ID, a View ID, or a Folder ID
 * depending on which URL shape it was copied from:
 *   /v/l/{id}   → usually a View id (ClickUp's "List ID invalid" error is the tell when
 *                 it's tried as a List first)
 *   /v/o/f/{id} → a Folder id — returns every List inside it, each inspected in turn
 * Tries List → View → Folder in that order. A View's `/task` endpoint works regardless
 * of what it's a view of; the custom field SCHEMA only comes along for the ride if the
 * view's parent turns out to be a List. */
async function inspectId(id: string): Promise<DiscoveredList[]> {
  try {
    const list = await getList(id);
    console.log(`  Resolved as List "${list.name}" (${id})`);
    return [await inspectList(id, list.name, `(shared with me) / ${list.name}`)];
  } catch { /* not a List id — keep trying */ }

  try {
    const view = await getView(id);
    console.log(`  Resolved as View "${view.name}" (${id})${view.parent ? `, parent list ${view.parent.id}` : ''}`);
    const tasks = await getAllViewTasks(id);
    console.log(`    ${tasks.length} task(s) total`);

    let customFields: DiscoveredList['customFields'] = [];
    if (view.parent?.id) {
      try {
        const fields = await getListCustomFields(view.parent.id);
        customFields = fields.map(f => ({ name: f.name, type: f.type, options: f.type_config?.options?.map(o => (o.name ?? o.label ?? o.id)) }));
        console.log(`    custom fields (from parent list ${view.parent.id}): ${customFields.map(f => `${f.name} (${f.type})`).join(', ') || '(none)'}`);
      } catch {
        console.log('    (parent is not directly a List — custom field schema unavailable, task-level values below still show them)');
      }
    }

    const sample = tasks.slice(0, SAMPLE_TASK_COUNT).map(t => ({
      name: t.name,
      customFields: Object.fromEntries(t.custom_fields.map(cf => [cf.name, resolveTaskFieldValue(cf)])),
    }));

    return [{ id, name: view.name, path: `(shared with me, view) / ${view.name}`, customFields, taskCount: tasks.length, sampleTasks: sample }];
  } catch { /* not a View id either — keep trying */ }

  const folder = await getFolder(id);
  console.log(`  Resolved as Folder "${folder.name}" (${id}) → ${folder.lists.length} list(s)`);
  const results: DiscoveredList[] = [];
  for (const list of folder.lists) {
    console.log(`    List "${list.name}" (${list.id})`);
    results.push(await inspectList(list.id, list.name, `(shared with me, folder ${folder.name}) / ${list.name}`));
  }
  return results;
}

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) {
    console.error('CLICKUP_API_TOKEN is not set in .env.local — add it first, then re-run this script.');
    process.exit(1);
  }

  const discovered: DiscoveredList[] = [];

  // Explicit List IDs passed on the command line (for "Shared with Me" lists the
  // Team/Space walk below can never see) — inspect exactly those and skip the walk.
  // ClickUp List IDs come in two shapes depending on workspace age: plain numeric
  // ("901304904957") or short alphanumeric-with-dash ("dhdc7-54915", taken straight off
  // a list's /v/l/{id} browser URL) — accept both, reject anything that's clearly not an
  // id-shaped token (spaces, slashes) so a stray CLI flag doesn't get treated as one.
  const explicitListIds = process.argv.slice(2).filter(a => /^[a-zA-Z0-9-]+$/.test(a));
  if (explicitListIds.length) {
    console.log(`Inspecting ${explicitListIds.length} explicitly-given ID(s), skipping the Team/Space walk...`);
    for (const id of explicitListIds) {
      discovered.push(...await inspectId(id));
    }
    writeFileSync('scripts/clickup-discovery-output.json', JSON.stringify(discovered, null, 2));
    console.log(`\nSaved discovery output to scripts/clickup-discovery-output.json (${discovered.length} list(s) recorded).`);
    console.log('Nothing was written to ClickUp or to the app database — this script only reads.');
    return;
  }

  const teams = await getAuthorizedTeams();
  console.log(`Found ${teams.length} team(s): ${teams.map(t => t.name).join(', ')}`);

  for (const team of teams) {
    const spaces = await getSpaces(team.id);
    console.log(`\nTeam "${team.name}" → ${spaces.length} space(s)`);

    for (const space of spaces) {
      console.log(`  Space "${space.name}"`);
      const [folders, folderlessLists] = await Promise.all([getFolders(space.id), getFolderlessLists(space.id)]);

      const allLists: { list: ClickUpListSummary; path: string }[] = [
        ...folderlessLists.map(l => ({ list: l, path: `${team.name} / ${space.name} / ${l.name}` })),
        ...folders.flatMap(f => f.lists.map(l => ({ list: l, path: `${team.name} / ${space.name} / ${f.name} / ${l.name}` }))),
      ];

      for (const { list, path } of allLists) {
        const interesting = INTERESTING_NAME_PATTERN.test(list.name);
        console.log(`    ${interesting ? '★' : '·'} List "${list.name}"${interesting ? '  (inspecting — name matches customer/project/lead)' : ''}`);

        if (!interesting) {
          discovered.push({ id: list.id, name: list.name, path, customFields: [], taskCount: null, sampleTasks: [] });
          continue;
        }

        discovered.push(await inspectList(list.id, list.name, path));
      }
    }
  }

  writeFileSync('scripts/clickup-discovery-output.json', JSON.stringify(discovered, null, 2));
  console.log(`\nSaved full discovery output to scripts/clickup-discovery-output.json (${discovered.length} lists recorded).`);
  console.log('Nothing was written to ClickUp or to the app database — this script only reads.');
}

main().catch(e => {
  console.error('Discovery failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
