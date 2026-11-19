import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { COLLECTIONS, NEWEST_FIRST, Collection, SyncPayload, StateSnapshot } from '../src/sync/collections.js';
import { SPECS, toRow, fromRow } from '../src/sync/mapping.js';

// Runs on Vercel only. The secret key never reaches the browser.

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readAll(db: SupabaseClient): Promise<StateSnapshot> {
  const state = {} as StateSnapshot;
  for (const collection of COLLECTIONS) {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from(SPECS[collection].table)
        .select('*')
        .order(SPECS[collection].sortColumn, { ascending: !NEWEST_FIRST[collection] })
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${collection}: ${error.message}`);
      rows.push(...data.map(row => fromRow(collection, row)));
      if (data.length < PAGE_SIZE) break;
    }
    state[collection] = rows;
  }
  return state;
}

// Records the time of each status change of a request (Submitted -> Approved -> ...).
function statusEventTime(record: Record<string, any>, isNew: boolean, now: string): string {
  if (isNew) return record.createdAt ?? now;
  if (record.status === 'Approved' || record.status === 'Rejected') return record.approvalTimestamp ?? now;
  if (record.status === 'Awaiting Purchase Completion' || record.status === 'OTP Verified') return record.otpProvidedAt ?? now;
  return now;
}

async function write(db: SupabaseClient, payload: SyncPayload) {
  const now = new Date().toISOString();
  for (const collection of COLLECTIONS) {
    const rows = payload[collection];
    if (!rows?.length) continue;
    const spec = SPECS[collection];

    // For requests, remember the stored status so status changes can be logged after saving.
    let previousStatus = new Map<string, string>();
    if (collection === 'requests') {
      const { data, error } = await db.from(spec.table).select('id,status').in('id', rows.map(r => r.record.id));
      if (error) throw new Error(`${collection}: ${error.message}`);
      previousStatus = new Map(data.map((r: any) => [r.id, r.status]));
    }

    const build = ({ record, createdAt }: typeof rows[number]) => ({
      ...toRow(collection, record, createdAt),
      ...(spec.hasUpdatedAt ? { updated_at: now } : {}),
    });

    // Upsert new and existing rows separately: in one batch, rows without
    // created_at would have it set to null instead of keeping the stored value.
    for (const batch of [rows.filter(r => r.createdAt), rows.filter(r => !r.createdAt)]) {
      if (!batch.length) continue;
      const { error } = await db.from(spec.table).upsert(batch.map(build), { onConflict: 'id' });
      if (error) throw new Error(`${collection}: ${error.message}`);
    }

    if (collection === 'requests') {
      const events = rows
        .filter(({ record }) => previousStatus.get(record.id) !== record.status)
        .map(({ record }) => ({
          request_id: record.id,
          from_status: previousStatus.get(record.id) ?? null,
          to_status: record.status,
          occurred_at: statusEventTime(record, !previousStatus.has(record.id), now),
        }));
      if (events.length) {
        const { error } = await db.from('request_events').insert(events);
        // The history is secondary: never fail a save that already succeeded.
        if (error) console.error(`request_events: ${error.message}`);
      }
    }
  }
}

function isValidPayload(body: unknown): body is SyncPayload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.entries(body).every(([collection, rows]) =>
    (COLLECTIONS as readonly string[]).includes(collection) &&
    Array.isArray(rows) &&
    rows.every(row => typeof row?.record?.id === 'string' && (row.createdAt === undefined || typeof row.createdAt === 'string'))
  );
}

// Deletes reconciliation periods; their bank_transactions go with them (on delete cascade).
// Only periods can be deleted, so registers and requests are never removed this way.
export async function DELETE(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ids = body?.periods;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every(id => typeof id === 'string')) {
    return Response.json({ error: 'Expected { periods: string[] }' }, { status: 400 });
  }

  try {
    const { data, error } = await getClient().from(SPECS.periods.table).delete().in('id', ids).select('id');
    if (error) throw new Error(`periods: ${error.message}`);
    return Response.json({ ok: true, deleted: data.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    return Response.json(await readAll(getClient()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidPayload(body)) return Response.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    await write(getClient(), body);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
