import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { COLLECTIONS, TABLE_NAMES, NEWEST_FIRST, Collection, SyncPayload, SyncRow, StateSnapshot } from '../src/sync/collections.js';

// Runs on Vercel only. The secret key never reaches the browser.

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Columns pulled out of `data` for filtering/sorting in the database.
function extraColumns(collection: Collection, r: Record<string, any>): Record<string, unknown> {
  switch (collection) {
    case 'requests': return { status: r.status ?? null };
    case 'purchases': return { purchase_id: r.purchaseId ?? null };
    case 'subscriptions': return { subscription_id: r.subscriptionId ?? null, status: r.status ?? null };
    case 'periods': return { status: r.status ?? null };
    case 'bankTransactions': return { period_id: r.periodId ?? null, status: r.status ?? null };
    default: return {};
  }
}

async function readAll(db: SupabaseClient): Promise<StateSnapshot> {
  const state = {} as StateSnapshot;
  for (const collection of COLLECTIONS) {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from(TABLE_NAMES[collection])
        .select('data')
        .order('created_at', { ascending: !NEWEST_FIRST[collection] })
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${collection}: ${error.message}`);
      rows.push(...data.map(row => row.data));
      if (data.length < PAGE_SIZE) break;
    }
    state[collection] = rows;
  }
  return state;
}

async function write(db: SupabaseClient, payload: SyncPayload) {
  const now = new Date().toISOString();
  for (const collection of COLLECTIONS) {
    const rows = payload[collection];
    if (!rows?.length) continue;

    const toRow = ({ record, createdAt }: SyncRow) => ({
      id: record.id,
      data: record,
      ...extraColumns(collection, record),
      ...(collection === 'auditLogs' ? {} : { updated_at: now }),
      ...(createdAt ? { created_at: createdAt } : {}),
    });

    // Upsert new and existing rows separately: in one batch, rows without
    // created_at would have it set to null instead of keeping the stored value.
    for (const batch of [rows.filter(r => r.createdAt), rows.filter(r => !r.createdAt)]) {
      if (!batch.length) continue;
      const { error } = await db.from(TABLE_NAMES[collection]).upsert(batch.map(toRow), { onConflict: 'id' });
      if (error) throw new Error(`${collection}: ${error.message}`);
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
