import { SubscriptionFrequency } from '../types';

// Statement dates come as DD/MM/YYYY or DD-MM-YYYY (Indian card statements, e.g. "03/10/2026"
// is 3 Oct). A part above 12 settles the order, so an MM/DD date like "08/13/2026" still reads
// correctly; when both parts could be a month, day-first wins.
export function parseBankDate(dateStr: string): Date | null {
  const parts = dateStr.trim().split(/[/.-]/);
  if (parts.length !== 3) return null;
  const [a, b, yyyy] = parts.map(p => parseInt(p, 10));
  if (!a || !b || !yyyy) return null;
  const [dd, mm] = b > 12 && a <= 12 ? [b, a] : [a, b];
  if (mm > 12 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) || d.getMonth() !== mm - 1 ? null : d;
}

// SubscriptionRecord date fields (startDate, lastChargedDate, nextExpectedCharge) are ISO
// (YYYY-MM-DD), as produced by <input type="date"> elsewhere in the app.
export function parseISODate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addBillingCycle(d: Date, frequency: SubscriptionFrequency): Date {
  const months = frequency === 'Annual' ? 12 : frequency === 'Quarterly' ? 3 : 1;
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function isWithinDays(a: Date, b: Date, days: number): boolean {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

// A transaction can land near the subscription's last known charge date (e.g. this
// reconciliation covers the same cycle already on record) or near the next expected
// cycle after it - either counts as "within the recurring billing window".
export function isWithinBillingWindow(txnDate: Date, referenceDate: Date, frequency: SubscriptionFrequency, windowDays = 7): boolean {
  if (isWithinDays(txnDate, referenceDate, windowDays)) return true;
  return isWithinDays(txnDate, addBillingCycle(referenceDate, frequency), windowDays);
}

// Days between the transaction and the nearer of the last known charge or the next expected one.
export function daysFromBillingDate(txnDate: Date, referenceDate: Date, frequency: SubscriptionFrequency): number {
  const day = 24 * 60 * 60 * 1000;
  const toLast = Math.abs(txnDate.getTime() - referenceDate.getTime());
  const toNext = Math.abs(txnDate.getTime() - addBillingCycle(referenceDate, frequency).getTime());
  return Math.round(Math.min(toLast, toNext) / day);
}

export function normalizeVendorText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Contains-similarity in either direction, e.g. "apollo io" vs "apollo io apollo io us".
export function vendorsLooselyMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = normalizeVendorText(a);
  const nb = normalizeVendorText(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function isAmountWithinTolerance(a: number, b: number, tolerancePct = 0.05): boolean {
  if (!a || !b) return false;
  return Math.abs(a - b) <= b * tolerancePct;
}
