// scripts/db-check/compare-db.mts — which migrations are missing on a database?
//
// 1. Run scripts/db-check/schema-fingerprint.sql in the Supabase SQL editor of the TEST DB,
//    paste the JSON result into test.json (optionally do the same on the MAIN DB → main.json).
// 2. npx tsx scripts/db-check/compare-db.mts test.json [main.json]
//
// Part A walks supabase/migrations in order, collects every table / column / index / policy /
// trigger / function / type / role it creates (minus what later migrations drop or rename)
// and reports, per migration file, what is NOT in test.json → that migration is not applied
// (or only partly). Part B (with main.json) lists every object that exists on MAIN but not on
// TEST, which also catches changes made directly in the SQL editor without a migration file.
// Read-only: it never connects to a database.

import { readFileSync, readdirSync } from 'fs';
import path from 'path';

type FP = Record<string, string[]>;
const [testFile, mainFile] = process.argv.slice(2);
if (!testFile) {
  console.error('Usage: npx tsx scripts/db-check/compare-db.mts test.json [main.json]');
  process.exit(1);
}
function loadFP(file: string): FP {
  let raw = readFileSync(file, 'utf8').trim();
  // tolerate a pasted CSV cell / quoted JSON
  if (raw.startsWith('"')) raw = JSON.parse(raw);
  const obj = JSON.parse(raw);
  return obj.fingerprint ?? obj;
}
const test = loadFP(testFile);
const has = {
  table: new Set([...test.tables, ...(test.views ?? [])].map(s => s.toLowerCase())),
  column: new Set(test.columns.map(c => c.split(':')[0].toLowerCase())),
  index: new Set(test.indexes.map(s => s.toLowerCase())),
  policy: new Set(test.policies.map(s => s.toLowerCase())),
  trigger: new Set(test.triggers.map(s => s.toLowerCase())),
  function: new Set(test.functions.map(s => s.toLowerCase())),
  type: new Set(test.types.map(s => s.toLowerCase())),
  role: new Set((test.role_definitions ?? []).map(s => s.toLowerCase())),
};

/* ---------------- Part A: migrations vs test ---------------- */
type Kind = keyof typeof has;
const expected = new Map<string, { kind: Kind; name: string; file: string }>();
const dataOnly: string[] = [];
const id = (s: string) => s.replace(/"/g, '').toLowerCase();
const T = String.raw`(?:public\.)?("?[\w]+"?)`;

const dir = path.join('supabase', 'migrations');
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
for (const file of files) {
  const sql = readFileSync(path.join(dir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
  const add = (kind: Kind, name: string) => expected.set(`${kind}:${name}`, { kind, name, file });
  const del = (kind: Kind, name: string) => expected.delete(`${kind}:${name}`);
  let schemaHits = 0;

  // statements in source order so a later DROP in the same file wins
  const events: { at: number; fn: () => void }[] = [];
  const on = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    for (const m of sql.matchAll(re)) events.push({ at: m.index!, fn: () => fn(m as RegExpExecArray) });
  };
  on(new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${T}`, 'gi'), m => { add('table', id(m[1])); schemaHits++; });
  on(new RegExp(String.raw`create\s+(?:or\s+replace\s+)?view\s+${T}`, 'gi'), m => { add('table', id(m[1])); schemaHits++; });
  on(new RegExp(String.raw`drop\s+(?:table|view)\s+(?:if\s+exists\s+)?${T}`, 'gi'), m => del('table', id(m[1])));
  on(new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${T}([^;]*)`, 'gi'), m => {
    const table = id(m[1]);
    const rest = m[2];
    for (const c of rest.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)/gi)) { add('column', `${table}.${id(c[1])}`); schemaHits++; }
    for (const c of rest.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?("?\w+"?)/gi)) del('column', `${table}.${id(c[1])}`);
    for (const c of rest.matchAll(/rename\s+column\s+("?\w+"?)\s+to\s+("?\w+"?)/gi)) { del('column', `${table}.${id(c[1])}`); add('column', `${table}.${id(c[2])}`); schemaHits++; }
    const rt = /rename\s+to\s+("?\w+"?)/i.exec(rest);
    if (rt) { del('table', table); add('table', id(rt[1])); schemaHits++; }
    if (/enable\s+row\s+level\s+security/i.test(rest)) schemaHits++;
  });
  on(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?("?\w+"?)\s+on/gi, m => { add('index', id(m[1])); schemaHits++; });
  on(/drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?("?\w+"?)/gi, m => del('index', id(m[1])));
  on(new RegExp(String.raw`create\s+policy\s+("[^"]+"|\w+)\s+on\s+(?:public\.|storage\.)?("?\w+"?)`, 'gi'), m => { add('policy', `${id(m[2])}.${id(m[1])}`); schemaHits++; });
  on(new RegExp(String.raw`drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+(?:public\.|storage\.)?("?\w+"?)`, 'gi'), m => del('policy', `${id(m[2])}.${id(m[1])}`));
  on(/create\s+(?:or\s+replace\s+)?trigger\s+("?\w+"?)[^;]*?\son\s+(?:public\.|auth\.|storage\.)?("?\w+"?)/gi, m => { add('trigger', `${id(m[2])}.${id(m[1])}`); schemaHits++; });
  on(/drop\s+trigger\s+(?:if\s+exists\s+)?("?\w+"?)\s+on\s+(?:public\.|auth\.|storage\.)?("?\w+"?)/gi, m => del('trigger', `${id(m[2])}.${id(m[1])}`));
  on(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?("?\w+"?)/gi, m => { add('function', id(m[1])); schemaHits++; });
  on(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?("?\w+"?)/gi, m => del('function', id(m[1])));
  on(/create\s+type\s+(?:public\.)?("?\w+"?)/gi, m => { add('type', id(m[1])); schemaHits++; });
  on(/drop\s+type\s+(?:if\s+exists\s+)?(?:public\.)?("?\w+"?)/gi, m => del('type', id(m[1])));
  on(/insert\s+into\s+(?:public\.)?role_definitions[\s\S]*?(?:select|values\s*\()\s*'([\w-]+)'/gi, m => { add('role', m[1].toLowerCase()); schemaHits++; });

  events.sort((a, b) => a.at - b.at).forEach(e => e.fn());
  if (!schemaHits && /\b(update|insert\s+into|delete\s+from)\b/i.test(sql)) dataOnly.push(file);
}

// The live DB stores roles as TEXT (no user_role enum) — see CURRENT_SYSTEM_STATE.md §7.
expected.delete('type:user_role');

const missingByFile = new Map<string, string[]>();
const totalByFile = new Map<string, number>();
for (const { kind, name, file } of expected.values()) {
  totalByFile.set(file, (totalByFile.get(file) ?? 0) + 1);
  if (!has[kind].has(name)) {
    if (!missingByFile.has(file)) missingByFile.set(file, []);
    missingByFile.get(file)!.push(`${kind.padEnd(8)} ${name}`);
  }
}

console.log(`\n=== A. Migrations not (fully) applied on ${path.basename(testFile)} ===\n`);
if (!missingByFile.size) console.log('All schema objects from every migration exist. ✔');
for (const file of files) {
  const miss = missingByFile.get(file);
  if (!miss) continue;
  const total = totalByFile.get(file)!;
  const state = miss.length === total ? 'NOT APPLIED' : `PARTLY (${total - miss.length}/${total} present)`;
  console.log(`${file}  →  ${state}`);
  miss.forEach(m => console.log(`    missing ${m}`));
}
if (dataOnly.length) {
  console.log('\nData-only migrations (UPDATE / INSERT / DELETE, cannot be verified from the schema — check by hand):');
  dataOnly.forEach(f => console.log('    ' + f));
}

/* ---------------- Part B: main vs test ---------------- */
if (mainFile) {
  const main = loadFP(mainFile);
  console.log(`\n=== B. On ${path.basename(mainFile)} but missing on ${path.basename(testFile)} ===\n`);
  let any = false;
  for (const key of Object.keys(main)) {
    const t = new Set((test[key] ?? []).map(s => s.toLowerCase()));
    const miss = (main[key] ?? []).filter(s => !t.has(s.toLowerCase()));
    if (!miss.length) continue;
    any = true;
    console.log(`${key} (${miss.length}):`);
    miss.forEach(m => console.log('    ' + m));
  }
  if (!any) console.log('Nothing missing. ✔');
  console.log(`\n=== C. On ${path.basename(testFile)} but NOT on ${path.basename(mainFile)} (extra / old objects) ===\n`);
  let extra = false;
  for (const key of Object.keys(test)) {
    const m = new Set((main[key] ?? []).map(s => s.toLowerCase()));
    const ex = (test[key] ?? []).filter(s => !m.has(s.toLowerCase()));
    if (!ex.length) continue;
    extra = true;
    console.log(`${key} (${ex.length}):`);
    ex.forEach(e => console.log('    ' + e));
  }
  if (!extra) console.log('Nothing extra. ✔');
}
console.log();
