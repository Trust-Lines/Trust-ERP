// scripts/create-test-accounts.mts — Roadmap Month 1, Task 1.
//
// Creates one real, logged-in-able Supabase Auth user + profile per role that had NO real
// test account in the dev DB (before this script: only general_manager "Frontend Demo" and
// sales_marketing_manager "SALSABIL MOUSTAFA" existed). Every later Month-1 task ("verify
// with a REAL user") depends on these existing.
//
// Idempotent: re-running skips a role whose test account already exists (by email).
// DEV DATABASE ONLY — never point this at production without changing the email domain and
// getting explicit approval; it creates real Supabase Auth users.
//
// Usage: npx tsx scripts/create-test-accounts.mts

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal(p: string) {
  if (!existsSync(p)) return;
  const env = Object.fromEntries(
    readFileSync(p, 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}
loadEnvLocal('.env.local');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TEST_PASSWORD = 'TrustLines2026!Test';
const EMAIL_DOMAIN = 'test.trust-lines.internal';

interface TestAccount {
  role: string;
  fullName: string;
  companySide: 'trust_lines' | 't_lines';
  department: string;
}

// Department mapping mirrors migration 066's backfill CASE exactly (lib/profile/metadata.ts
// has no single derive() helper — the rule lives in that migration).
const ACCOUNTS: TestAccount[] = [
  { role: 'sales_rep',       fullName: 'ZZTEST Sales Rep',        companySide: 't_lines',     department: 'sales' },
  { role: 'marketing_pr',    fullName: 'ZZTEST Marketing PR',     companySide: 'trust_lines', department: 'marketing' },
  { role: 'marketing_manager', fullName: 'ZZTEST Marketing Manager', companySide: 'trust_lines', department: 'marketing' },
  { role: 'tlines_pm',       fullName: 'ZZTEST T-Lines PM',       companySide: 't_lines',     department: 'pm' },
  { role: 'trustlines_pm',   fullName: 'ZZTEST Trust-Lines PM',   companySide: 'trust_lines', department: 'pm' },
  { role: 'pm_millwork',     fullName: 'ZZTEST Production PM (Millwork)', companySide: 'trust_lines', department: 'production' },
  { role: 'designer',        fullName: 'ZZTEST Designer',         companySide: 'trust_lines', department: 'design' },
  { role: 'qc_responsible',  fullName: 'ZZTEST QC Responsible',   companySide: 'trust_lines', department: 'qc' },
];

async function main() {
  console.log('=== Creating Month-1 test accounts (dev DB) ===\n');
  const results: { role: string; email: string; status: string }[] = [];

  for (const acc of ACCOUNTS) {
    const email = `${acc.role.replace(/_/g, '-')}@${EMAIL_DOMAIN}`;

    const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existingProfile) {
      results.push({ role: acc.role, email, status: 'already exists — skipped' });
      continue;
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password: TEST_PASSWORD, email_confirm: true,
    });
    if (createErr || !created.user) {
      results.push({ role: acc.role, email, status: `FAILED: ${createErr?.message}` });
      continue;
    }

    const { error: profErr } = await admin.from('profiles').upsert({
      id: created.user.id, email, full_name: acc.fullName, role: acc.role, is_active: true,
      company_side: acc.companySide, department: acc.department, office: 'turkey',
    });
    if (profErr) {
      results.push({ role: acc.role, email, status: `auth user created but profile FAILED: ${profErr.message}` });
      continue;
    }

    results.push({ role: acc.role, email, status: 'created' });
  }

  console.log('Role                  | Email                                          | Status');
  console.log('-'.repeat(100));
  for (const r of results) {
    console.log(`${r.role.padEnd(22)} | ${r.email.padEnd(46)} | ${r.status}`);
  }
  console.log(`\nPassword for all accounts created by this script: ${TEST_PASSWORD}`);
  console.log('Share this password over a secure channel, not committed anywhere.');
}

main().catch(e => { console.error('FAILED:', e.message); process.exitCode = 1; });
