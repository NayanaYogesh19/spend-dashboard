# Spendy (SpendControl): Architecture

A finance-ops web app for an agency. Employees request purchases, managers approve them, finance releases card OTPs and checks amounts, and each month's credit card statement is reconciled against the approved spend. It also tracks recurring subscriptions and client ad spend, and rolls everything up into client billing.

## At a glance

```
 Browser (React SPA)                    Vercel                          Supabase
┌──────────────────────────┐   fetch   ┌──────────────────────┐  SQL   ┌────────────────────┐
│ Views (6 screens)        │  ───────► │ api/state.ts         │ ─────► │ Postgres, 8 tables │
│   ▲ props   │ actions    │ GET/POST  │ serverless function  │        │ RLS on, no public  │
│   │         ▼            │ ◄──────── │ holds SECRET key     │ ◄───── │ access             │
│ useStore (state + sync)  │   JSON    └──────────────────────┘        └────────────────────┘
└──────────────────────────┘
```

| Layer | Tech | Where |
|---|---|---|
| UI | React 19, TypeScript, Tailwind v4, lucide icons | `src/` |
| Build / hosting | Vite 6, deployed on Vercel (auto-deploys from GitHub) | `vite.config.ts` |
| API | One Vercel function, `/api/state` | `api/state.ts` |
| Database | Supabase Postgres | `supabase/schema.sql` |

## Frontend

- **`src/App.tsx`**: the shell. A role switcher shows one view at a time, plus the sync banners (offline, upload old data) and the footer save status.
- **`src/views/`**: one file per screen:

| View | Who | Does |
|---|---|---|
| `EmployeeView` (Requester) | Employee | Submits requests; reports actual amount and invoice after buying |
| `ManagerView` (Approvals) | Manager | Approves or rejects; approval assigns a `PUR-YYYY-NNNN` id |
| `FinanceView` | Finance | Releases card OTPs; confirms bank INR amounts |
| `RegistersView` | Finance | Master lists of purchases, subscriptions and ad spend; imports existing subscriptions |
| `ReconciliationView` | Finance | Pastes the bank statement, auto-matches lines to records, confirms matches |
| `DashboardView` | Leads | Monthly reconciliation summary, subscription insights, client billing; closes a month |

- **`src/types.ts`**: every data shape (`PurchaseRequest`, `PurchaseRecord`, `SubscriptionRecord`, `AdSpendRecord`, `BankTransaction`, `ReconciliationPeriod`, `MerchantAlias`, `AuditLog`).
- **`src/utils/recurringMatch.ts`**: matching helpers for reconciliation: loose vendor-name match, ±5% amount tolerance, billing-window dates, and rolling a subscription's next charge date forward.

## State and sync: `src/hooks/useStore.ts`

The single source of truth in the browser. Views receive data as props and call its action functions (`addRequest`, `updateRequestStatus`, `completePurchase`, `importBankTransactions`, `confirmTransactionMatch`, `closePeriod`, …). Actions update React state only. Syncing happens separately:

1. **Load:** on page open, `GET /api/state` returns all 8 collections.
2. **Save:** after every change, it compares each record with what the server last had (sorted-key JSON) and `POST`s only the changed ones. New records get a `created_at` so list order is kept.
3. **Refresh:** every 20 s and when the tab regains focus, it re-reads the server. Unsaved or in-flight edits are never overwritten.
4. **Errors:** a failed save shows a red banner and retries automatically.
5. **Old data:** if this browser still has the pre-database `localStorage` data (`spendy_data`), a banner offers a one-time **Upload** that merges in only the records the database is missing.

`src/sync/collections.ts` holds what the browser and the API share: collection → table names, list order, payload types, and `stableStringify`.

## API: `api/state.ts`

- `GET`: reads every table (paged 1000 rows at a time) and returns `{ requests: [...], purchases: [...], … }`.
- `POST`: validates the body and upserts rows by `id`, writing `periods` before `bank_transactions` (foreign key).
- Uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY` from Vercel environment variables. The secret key never reaches the browser.

## Database: `supabase/schema.sql`

Eight tables: `requests`, `purchases`, `subscriptions`, `ad_spends`, `periods`, `bank_transactions`, `merchant_aliases`, `audit_logs`.

Each row is `id` + `data jsonb` (the full record from `types.ts`), plus `created_at` / `updated_at` and a few copied columns for filtering (`status`, `purchase_id`, `subscription_id`, `period_id`). Row Level Security is on with no policies, and the public roles have no table rights, so only the API's secret key can read or write.

## Main workflow

```
Requester submits ─► Manager approves (PUR id) ─► Finance releases OTP ─► Employee buys,
reports actual amount + invoice ─► creates Purchase / Subscription / Ad Spend record ─►
Finance confirms bank INR ─► month's statement pasted in Reconciliation ─► lines auto-matched
(vendor + amount + date window) ─► Finance confirms ─► Dashboard: summary, billing, close month
```

## Environments and config

| Where | URL | Keys come from |
|---|---|---|
| Production | financetrackerreconciliation.vercel.app (`main` branch) | Vercel env vars (Production) |
| Preview | one URL per pushed branch / PR (needs Vercel login) | Vercel env vars (Preview) |
| Local | `npx vercel dev --listen 3000` → localhost:3000 | `.env` file (git-ignored) |

All three use the **same** Supabase database.

## Known limits

- **No login:** anyone with the link can view and edit; approver and finance names are hardcoded.
- **Last write wins:** if two people edit the same record at the same moment, the later save wins.
- **Manual currency:** INR bank amounts are typed in; there's no live FX conversion.
- **Heuristic matching:** vendor-name similarity plus a small alias list; there's no fuzzy or AI matching.
- **Evidence:** invoices are recorded as a flag or URL; files aren't uploaded yet.
- `GEMINI_API_KEY` in `.env.example` is left over from the AI Studio template and unused.
