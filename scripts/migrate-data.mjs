// One-time: loads the backup of the old JSON tables into the new column-based tables.
// Usage: node scripts/migrate-data.mjs backups/pre-restructure-2026-11-18.json
// Run AFTER supabase/migrate-to-columns.sql. Safe to re-run (upserts by id).
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { toRow } from '../src/sync/mapping.ts';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/migrate-data.mjs <backup.json>'); process.exit(1); }
const backup = JSON.parse(readFileSync(file, 'utf8'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// old table -> [collection key used by the app, new table]; parents first.
const ORDER = [
  ['periods', 'periods'], ['requests', 'requests'], ['purchases', 'purchases'],
  ['subscriptions', 'subscriptions'], ['ad_spends', 'adSpends'],
  ['bank_transactions', 'bankTransactions'], ['merchant_aliases', 'merchantAliases'], ['audit_logs', 'auditLogs'],
];

for (const [oldTable, collection] of ORDER) {
  const rows = (backup[oldTable] ?? []).map(r => ({
    ...toRow(collection, r.data, r.created_at),
    ...(collection === 'auditLogs' ? {} : { updated_at: r.updated_at ?? r.created_at }),
  }));
  if (rows.length) {
    const { error } = await db.from(oldTable).upsert(rows, { onConflict: 'id' });
    if (error) { console.error(`${oldTable}: ${error.message}`); process.exit(1); }
  }
  console.log(`${oldTable.padEnd(18)} ${rows.length} row(s) loaded`);
}

// Rebuild each request's history from its saved timestamps.
const events = [];
for (const r of backup.requests ?? []) {
  const d = r.data;
  const steps = [['Submitted', d.createdAt]];
  if (d.approvalTimestamp) steps.push([d.status === 'Rejected' ? 'Rejected' : 'Approved', d.approvalTimestamp]);
  if (d.otpProvidedAt) steps.push(['Awaiting Purchase Completion', d.otpProvidedAt]);
  if (!steps.some(([s]) => s === d.status)) steps.push([d.status, r.updated_at]);
  steps.forEach(([to, at], i) => events.push({ request_id: d.id, from_status: i ? steps[i - 1][0] : null, to_status: to, occurred_at: at }));
}
if (events.length) {
  await db.from('request_events').delete().in('request_id', events.map(e => e.request_id));
  const { error } = await db.from('request_events').insert(events);
  if (error) { console.error(`request_events: ${error.message}`); process.exit(1); }
}
console.log(`request_events     ${events.length} row(s) loaded`);
