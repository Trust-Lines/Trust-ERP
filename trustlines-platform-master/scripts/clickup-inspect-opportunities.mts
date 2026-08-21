import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getAllViewTasks, resolveCustomFieldValue } from '../lib/clickup/client';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

async function main() {
  loadEnvLocal();
  const tasks = await getAllViewTasks('dhdc7-54915');
  console.log(`${tasks.length} tasks`);

  const stageCounts = new Map<string, number>();
  const projectTypeCounts = new Map<string, number>();
  const businessTypeCounts = new Map<string, number>();
  const requestCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();

  const rows = tasks.map(t => {
    const cf = new Map(t.custom_fields.map(f => [f.name.trim(), resolveCustomFieldValue(f)]));
    const stage = cf.get('Status OP');
    if (typeof stage === 'string') stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    const pt = cf.get('Project Type');
    if (typeof pt === 'string') projectTypeCounts.set(pt, (projectTypeCounts.get(pt) ?? 0) + 1);
    const bt = cf.get('08-BUSNIESS TYPE');
    if (Array.isArray(bt)) for (const b of bt) businessTypeCounts.set(String(b), (businessTypeCounts.get(String(b)) ?? 0) + 1);
    const req = cf.get('Request');
    if (typeof req === 'string') requestCounts.set(req, (requestCounts.get(req) ?? 0) + 1);
    const ind = cf.get('Industry');
    if (typeof ind === 'string') industryCounts.set(ind, (industryCounts.get(ind) ?? 0) + 1);
    return { name: t.name, fields: Object.fromEntries(cf) };
  });

  console.log('\n-- Status OP distribution --');
  for (const [k, v] of stageCounts) console.log(`  ${k}: ${v}`);
  console.log('\n-- Project Type distribution --');
  for (const [k, v] of projectTypeCounts) console.log(`  ${k}: ${v}`);
  console.log('\n-- Industry (=Service Line?) distribution --');
  for (const [k, v] of industryCounts) console.log(`  ${k}: ${v}`);
  console.log('\n-- Request distribution --');
  for (const [k, v] of requestCounts) console.log(`  ${k}: ${v}`);
  console.log('\n-- Business Type distribution (top 15) --');
  for (const [k, v] of [...businessTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k}: ${v}`);

  writeFileSync('scripts/clickup-opportunities-ne-full.json', JSON.stringify(rows, null, 2));
  console.log('\nSaved full rows to scripts/clickup-opportunities-ne-full.json');
}
main();
