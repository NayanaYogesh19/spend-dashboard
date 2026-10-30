// Shared between the browser store and the /api/state function.

export const COLLECTIONS = [
  'periods', // before bankTransactions: bank_transactions.period_id references periods
  'requests',
  'purchases',
  'subscriptions',
  'adSpends',
  'bankTransactions',
  'merchantAliases',
  'auditLogs',
] as const;

export type Collection = typeof COLLECTIONS[number];

export const TABLE_NAMES: Record<Collection, string> = {
  periods: 'periods',
  requests: 'requests',
  purchases: 'purchases',
  subscriptions: 'subscriptions',
  adSpends: 'ad_spends',
  bankTransactions: 'bank_transactions',
  merchantAliases: 'merchant_aliases',
  auditLogs: 'audit_logs',
};

// Collections where the store prepends new records (index 0 is newest).
// The rest append, so the last record is newest.
export const NEWEST_FIRST: Record<Collection, boolean> = {
  periods: true,
  requests: true,
  purchases: true,
  subscriptions: true,
  adSpends: true,
  bankTransactions: false,
  merchantAliases: false,
  auditLogs: true,
};

// A record plus, for records the server hasn't seen yet, the timestamp that
// fixes its position in the list.
export interface SyncRow {
  record: { id: string } & Record<string, unknown>;
  createdAt?: string;
}

export type SyncPayload = Partial<Record<Collection, SyncRow[]>>;
export type StateSnapshot = Record<Collection, any[]>;

// JSON with sorted keys, so records compare equal after a round trip through jsonb.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
