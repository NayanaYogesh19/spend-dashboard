// Maps the app's records (src/types.ts) to and from database rows with one real column
// per field. Used only by the /api/state function; the browser keeps working with the
// same record shapes as before.

import type { Collection } from './collections.js';

type ColType = 'text' | 'number' | 'bool' | 'date' | 'timestamp' | 'json';
type Col = [key: string, column: string, type: ColType]; // key may be a dotted path, e.g. completionDetails.invoiceNumber

export interface TableSpec {
  table: string;
  cols: Col[];
  sortColumn: string;
  createdAtColumn?: string;   // receives the created-at tick for records that do not carry their own
  hasUpdatedAt: boolean;
  ignoreKeys?: string[];      // record keys rebuilt from other columns, so not kept as columns
  toRow?: (record: Record<string, any>, row: Record<string, unknown>) => void;
  fromRow?: (row: Record<string, any>, record: Record<string, any>) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "November 2026" -> "2026-11-01". Older free-text names ("Nov 16") fall back to the month the period was created in.
function periodMonth(name: unknown, createdAt: unknown): string {
  const m = typeof name === 'string' ? name.trim().match(/^([A-Za-z]+)\s+(\d{4})$/) : null;
  const idx = m ? MONTHS.findIndex(x => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3))) : -1;
  if (m && idx >= 0) return `${m[2]}-${String(idx + 1).padStart(2, '0')}-01`;
  const d = new Date(typeof createdAt === 'string' ? createdAt : Date.now());
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// "01/11/2026" (dd/mm/yyyy) -> "2026-11-01"; anything else -> null.
function statementDate(value: unknown): string | null {
  const m = typeof value === 'string' ? value.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/) : null;
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const SPECS: Record<Collection, TableSpec> = {
  periods: {
    table: 'periods',
    sortColumn: 'created_at',
    hasUpdatedAt: true,
    ignoreKeys: ['name'],
    cols: [
      ['card', 'card', 'text'],
      ['status', 'status', 'text'],
      ['createdAt', 'created_at', 'timestamp'],
      ['closedAt', 'closed_at', 'timestamp'],
      ['closedBy', 'closed_by', 'text'],
      ['closureReason', 'closure_reason', 'text'],
    ],
    toRow: (r, row) => { row.month = periodMonth(r.name, r.createdAt); },
    fromRow: (row, rec) => {
      const [y, m] = String(row.month).split('-');
      rec.name = `${MONTHS[Number(m) - 1]} ${y}`;
    },
  },

  requests: {
    table: 'requests',
    sortColumn: 'requested_at',
    hasUpdatedAt: true,
    cols: [
      ['purchaseId', 'purchase_id', 'text'],
      ['status', 'status', 'text'],
      ['requesterName', 'requester_name', 'text'],
      ['managerName', 'manager_name', 'text'],
      ['pod', 'pod', 'text'],
      ['toolVendor', 'vendor', 'text'],
      ['purpose', 'purpose', 'text'],
      ['expenseCategory', 'expense_category', 'text'],
      ['expenseType', 'expense_type', 'text'],
      ['clientName', 'client_name', 'text'],
      ['purchaseType', 'purchase_type', 'text'],
      ['subscriptionFrequency', 'subscription_frequency', 'text'],
      ['amount', 'amount', 'number'],
      ['currency', 'currency', 'text'],
      ['cardRequired', 'card_required', 'text'],
      ['expectedDate', 'expected_date', 'date'],
      ['notes', 'notes', 'text'],
      ['createdAt', 'requested_at', 'timestamp'],
      ['approvalTimestamp', 'decided_at', 'timestamp'],
      ['otpProvidedAt', 'otp_provided_at', 'timestamp'],
      ['completionDetails.purchaseStatus', 'completion_status', 'text'],
      ['completionDetails.actualVendorAmount', 'completion_vendor_amount', 'number'],
      ['completionDetails.actualCurrency', 'completion_currency', 'text'],
      ['completionDetails.actualPurchaseDate', 'completion_purchase_date', 'date'],
      ['completionDetails.actualBankInrAmount', 'completion_bank_inr_amount', 'number'],
      ['completionDetails.bankAmountSource', 'completion_bank_amount_source', 'text'],
      ['completionDetails.bankVerificationStatus', 'completion_bank_verification_status', 'text'],
      ['completionDetails.invoiceUploaded', 'completion_invoice_uploaded', 'bool'],
      ['completionDetails.invoiceNumber', 'completion_invoice_number', 'text'],
      ['completionDetails.invoiceDate', 'completion_invoice_date', 'date'],
      ['completionDetails.orderReference', 'completion_order_reference', 'text'],
      ['completionDetails.billingFrequency', 'completion_billing_frequency', 'text'],
      ['completionDetails.notes', 'completion_notes', 'text'],
      ['completionDetails.failureReason', 'completion_failure_reason', 'text'],
    ],
  },

  purchases: {
    table: 'purchases',
    sortColumn: 'created_at',
    createdAtColumn: 'created_at',
    hasUpdatedAt: true,
    cols: [
      ['purchaseId', 'purchase_id', 'text'],
      ['vendor', 'vendor', 'text'],
      ['employee', 'employee', 'text'],
      ['pod', 'pod', 'text'],
      ['client', 'client', 'text'],
      ['billable', 'billable', 'bool'],
      ['approvedAmount', 'approved_amount', 'number'],
      ['actualAmount', 'actual_amount', 'number'],
      ['currency', 'currency', 'text'],
      ['purchaseDate', 'purchase_date', 'date'],
      ['invoiceDate', 'invoice_date', 'date'],
      ['card', 'card', 'text'],
      ['evidenceUrl', 'evidence_url', 'text'],
      ['status', 'status', 'text'],
      ['actualBankInrAmount', 'actual_bank_inr_amount', 'number'],
      ['bankVerificationStatus', 'bank_verification_status', 'text'],
      ['notes', 'notes', 'text'],
      ['source', 'source', 'text'],
    ],
  },

  subscriptions: {
    table: 'subscriptions',
    sortColumn: 'created_at',
    createdAtColumn: 'created_at',
    hasUpdatedAt: true,
    cols: [
      ['subscriptionId', 'subscription_id', 'text'],
      ['originalPurchaseId', 'original_purchase_id', 'text'],
      ['vendor', 'vendor', 'text'],
      ['tool', 'tool', 'text'],
      ['employeeOwner', 'owner', 'text'],
      ['pod', 'pod', 'text'],
      ['client', 'client', 'text'],
      ['billable', 'billable', 'bool'],
      ['card', 'card', 'text'],
      ['expectedRecurringAmount', 'expected_recurring_amount', 'number'],
      ['currency', 'currency', 'text'],
      ['billingFrequency', 'billing_frequency', 'text'],
      ['category', 'category', 'text'],
      ['startDate', 'start_date', 'date'],
      ['expectedRenewalDate', 'expected_renewal_date', 'date'],
      ['lastChargedDate', 'last_charged_date', 'date'],
      ['nextExpectedCharge', 'next_expected_charge', 'date'],
      ['status', 'status', 'text'],
      ['evidenceUrl', 'evidence_url', 'text'],
      ['actualBankInrAmount', 'actual_bank_inr_amount', 'number'],
      ['bankVerificationStatus', 'bank_verification_status', 'text'],
      ['notes', 'notes', 'text'],
      ['source', 'source', 'text'],
    ],
  },

  adSpends: {
    table: 'ad_spends',
    sortColumn: 'created_at',
    createdAtColumn: 'created_at',
    hasUpdatedAt: true,
    cols: [
      ['originalPurchaseId', 'original_purchase_id', 'text'],
      ['client', 'client', 'text'],
      ['platform', 'platform', 'text'],
      ['adAccountName', 'ad_account_name', 'text'],
      ['adAccountId', 'ad_account_id', 'text'],
      ['pod', 'pod', 'text'],
      ['employeeOwner', 'owner', 'text'],
      ['billingPeriod', 'billing_period', 'text'],
      ['approvedMonthlyBudget', 'approved_monthly_budget', 'number'],
      ['platformSpend', 'platform_spend', 'number'],
      ['cardAmountCharged', 'card_amount_charged', 'number'],
      ['currency', 'currency', 'text'],
      ['evidenceType', 'evidence_type', 'text'],
      ['evidenceUrl', 'evidence_url', 'text'],
      ['notes', 'notes', 'text'],
      ['actualBankInrAmount', 'actual_bank_inr_amount', 'number'],
      ['bankVerificationStatus', 'bank_verification_status', 'text'],
    ],
  },

  bankTransactions: {
    table: 'bank_transactions',
    sortColumn: 'created_at',
    createdAtColumn: 'created_at',
    hasUpdatedAt: true,
    cols: [
      ['periodId', 'period_id', 'text'],
      ['originalDate', 'original_date', 'text'],
      ['serialNumber', 'serial_number', 'text'],
      ['originalDescription', 'original_description', 'text'],
      ['rewardPoints', 'reward_points', 'text'],
      ['intlAmount', 'intl_amount', 'number'],
      ['inrAmount', 'inr_amount', 'number'],
      ['billingAmountSign', 'billing_amount_sign', 'text'],
      ['originalCurrency', 'original_currency', 'text'],
      ['type', 'type', 'text'],
      ['normalizedVendor', 'normalized_vendor', 'text'],
      ['suggestedVendor', 'suggested_vendor', 'text'],
      ['status', 'status', 'text'],
      ['matchType', 'match_type', 'text'],
      ['confidence', 'confidence', 'number'],
      ['confidenceLevel', 'confidence_level', 'text'],
      ['confidenceReasons', 'confidence_reasons', 'json'],
      ['suggestedPurchaseId', 'suggested_purchase_id', 'text'],
      ['suggestedSubscriptionId', 'suggested_subscription_id', 'text'],
      ['suggestedAdSpendId', 'suggested_ad_spend_id', 'text'],
      ['suggestedClient', 'suggested_client', 'text'],
      ['suggestedEmployee', 'suggested_employee', 'text'],
      ['suggestedPod', 'suggested_pod', 'text'],
      ['parentTransactionId', 'parent_transaction_id', 'text'],
      ['assignedTo', 'assigned_to', 'text'],
      ['isFeeBillableToClient', 'is_fee_billable_to_client', 'bool'],
    ],
    toRow: (r, row) => { row.txn_date = statementDate(r.originalDate); },
  },

  merchantAliases: {
    table: 'merchant_aliases',
    sortColumn: 'created_at',
    createdAtColumn: 'created_at',
    hasUpdatedAt: true,
    cols: [
      ['pattern', 'pattern', 'text'],
      ['normalizedVendor', 'normalized_vendor', 'text'],
      ['tool', 'tool', 'text'],
    ],
  },

  auditLogs: {
    table: 'audit_logs',
    sortColumn: 'logged_at',
    hasUpdatedAt: false,
    cols: [
      ['timestamp', 'logged_at', 'timestamp'],
      ['user', 'user_name', 'text'],
      ['action', 'action', 'text'],
      ['entityId', 'entity_id', 'text'],
      ['previousValue', 'previous_value', 'text'],
      ['newValue', 'new_value', 'text'],
      ['comment', 'comment', 'text'],
    ],
  },
};

// ── helpers ────────────────────────────────────────────────────────────────

const getPath = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setPath(obj: any, path: string, value: unknown) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys[keys.length - 1]] = value;
}

// Does the value fit its column type? If not it goes to `extra` instead of failing the save.
function fits(value: unknown, type: ColType): boolean {
  switch (type) {
    case 'text': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'bool': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    case 'timestamp': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
    case 'json': return Array.isArray(value) || (typeof value === 'object' && value !== null);
  }
}

// ── record -> row ──────────────────────────────────────────────────────────

export function toRow(collection: Collection, record: Record<string, any>, createdAt?: string): Record<string, unknown> {
  const spec = SPECS[collection];
  const row: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  const knownTop = new Set<string>(['id', ...(spec.ignoreKeys ?? [])]);
  const knownPaths = new Set<string>();
  const nestedRoots = new Set<string>();

  row.id = record.id;
  for (const [key, column, type] of spec.cols) {
    knownPaths.add(key);
    knownTop.add(key.split('.')[0]);
    if (key.includes('.')) nestedRoots.add(key.split('.')[0]);
    const value = getPath(record, key);
    if (value === undefined || value === null) { row[column] = null; continue; }
    if (fits(value, type)) row[column] = value;
    else { row[column] = null; extra[key] = value; }
  }

  // Anything the columns do not cover is kept in `extra`, so no value is ever dropped.
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (nestedRoots.has(key)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [sub, subValue] of Object.entries(value)) {
          if (subValue !== undefined && !knownPaths.has(`${key}.${sub}`)) extra[`${key}.${sub}`] = subValue;
        }
      } else if (value !== null) {
        extra[key] = value;
      }
    } else if (!knownTop.has(key)) {
      extra[key] = value;
    }
  }
  row.extra = extra;

  spec.toRow?.(record, row);
  if (createdAt && spec.createdAtColumn) row[spec.createdAtColumn] = createdAt;
  return row;
}

// ── row -> record ──────────────────────────────────────────────────────────

export function fromRow(collection: Collection, row: Record<string, any>): Record<string, any> {
  const spec = SPECS[collection];
  const record: Record<string, any> = { id: row.id };
  for (const [key, column, type] of spec.cols) {
    const value = row[column];
    if (value === null || value === undefined) continue;
    if (type === 'timestamp') setPath(record, key, new Date(value).toISOString());
    else if (type === 'number') setPath(record, key, Number(value));
    else setPath(record, key, value);
  }
  for (const [key, value] of Object.entries(row.extra ?? {})) setPath(record, key, value);
  spec.fromRow?.(row, record);
  return record;
}

