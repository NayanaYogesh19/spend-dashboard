# Spend Dashboard (Trilliant SpendHub)

A React + Vite + TypeScript app for tracking company spend: purchase requests, approvals,
Finance OTP / purchase completion, subscription and ad-spend registers, and monthly
bank-statement reconciliation. Data is stored in Supabase (Postgres).

## Features

- **Dashboard**, **Requester**, **Approvals**, **Finance**, **Registers**, **Reconciliation** tabs
- Request flow: Submitted → Approved → Awaiting Purchase Completion (OTP) → Purchase Completed
- Date and time recorded when Finance provides the OTP
- Reconciliation periods created by Month / Year (e.g. November 2026)
- Bank statement import by file upload (`.csv`, `.xlsx`, `.tsv`, `.txt`)
- Reconciliation CSV download
- Subscription register with **Pause**, **Resume** and **Cancel**; the time of each status change is recorded and shown
- **Manual ad-spend entry** (Google, Facebook, LinkedIn or other platforms) in the Ad Spend register
- Dashboard alerts for missing client or pod, and for unmatched card transactions

## Requirements

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create the database tables**
   In Supabase open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. **Add your keys**
   ```bash
   cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
   ```
   Fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys).
   The `.env` file is git-ignored and must never be committed.
4. **Run**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>. The API (`/api/state`) is served by the Vite dev server,
   so no separate backend is needed.

## Try the import

Sample statements are in [`sample-data/`](sample-data/) (`sample-bank-statement.csv` and `.xlsx`).
Go to **Reconciliation → create a period → Import Statement → Add File**.

## Database

Nine tables, one real column per field: `periods`, `requests`, `request_events`, `purchases`,
`subscriptions`, `ad_spends`, `bank_transactions`, `merchant_aliases`, `audit_logs`.
Row Level Security is on with no policies, so the browser can't read or write data; only the
server-side API using the secret key can. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for details.

Databases created before the subscription status times were added need one extra step: run
[`supabase/add-subscription-status-times.sql`](supabase/add-subscription-status-times.sql) once in the
Supabase SQL Editor (adds `activated_at`, `paused_at`, `cancelled_at` to `subscriptions`). Fresh installs
get these columns from `schema.sql`.

If you have data in the older JSON-style tables, run
[`supabase/migrate-to-columns.sql`](supabase/migrate-to-columns.sql) and then
`node --env-file=.env scripts/migrate-data.mjs`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | Type-check |

## Security

- Keep `SUPABASE_SECRET_KEY` private; it is only read on the server side.
- Do not commit `.env` or the `backups/` folder (both are git-ignored).
