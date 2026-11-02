import { BankTransaction } from '../types';

// Same columns as the bank statement, plus the confirmed Pod and Account.
export const RECONCILIATION_CSV_HEADER = [
  'Date', 'Sr.No.', 'Transaction Details', 'Reward Point Header', 'Intl.Amount', 'Amount(in Rs)', 'BillingAmountSign', 'Pod', 'Account'
];

const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Only matched merchant lines carry a Pod/Account. DCC fees, IGST, card header rows
// and unmatched lines stay blank: fees and taxes aren't assigned to any pod.
export function buildReconciliationCsv(transactions: BankTransaction[]): string {
  const rows = transactions.map(t => {
    const matched = t.type === 'Merchant' && t.status === 'Matched';
    return [
      t.originalDate,
      t.serialNumber,
      t.originalDescription,
      t.rewardPoints,
      t.intlAmount ? String(t.intlAmount) : '',
      String(t.inrAmount),
      t.billingAmountSign || '',
      matched ? t.suggestedPod || '' : '',
      matched ? t.suggestedClient || '' : '',
    ].map(v => escape(v ?? '')).join(',');
  });

  return [RECONCILIATION_CSV_HEADER.join(','), ...rows].join('\r\n');
}

// Downloads the CSV; the BOM makes Excel read ₹ and other non-ASCII text correctly.
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
