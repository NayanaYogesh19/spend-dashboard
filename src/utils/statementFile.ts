// Reads an uploaded bank statement (.csv, .tsv, .txt or .xlsx) and returns it as
// tab-separated text, one row per line - the format the reconciliation parser expects.

const pad = (n: number) => String(n).padStart(2, '0');

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return `${pad(cell.getUTCDate())}/${pad(cell.getUTCMonth() + 1)}/${cell.getUTCFullYear()}`;
  return String(cell).replace(/[\t\r\n]+/g, ' ').trim();
}

// Minimal CSV parser: handles quoted fields, escaped quotes ("") and commas/newlines inside quotes.
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export async function statementFileToTabText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let rows: unknown[][];

  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    rows = (await readSheet(file)) as unknown[][];
  } else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = (await file.text()).replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    rows = parseDelimited(text, delimiter);
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx, .tsv or .txt file.');
  }

  return rows
    .map(row => row.map(cellToString).join('\t'))
    .filter(line => line.replace(/\t/g, '').trim() !== '')
    .join('\n');
}
