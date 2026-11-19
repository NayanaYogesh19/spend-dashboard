-- Spendy schema for Supabase (one real column per field).
-- Fresh install: Supabase -> SQL Editor -> New query -> paste this file -> Run.
-- Upgrading from the old JSON layout: run supabase/migrate-to-columns.sql instead.
--
-- RLS is on with no policies: the publishable (browser) key can read or write
-- nothing. Only the server-side /api routes, using the secret key, can access data.
--
-- Every table also has `extra` (jsonb, normally empty {}): a safety net that keeps any
-- value that does not fit its column, so nothing is ever silently lost.

-- ─────────────────────────────────────────────────────────────
-- Reconciliation periods: one row per month and card.
-- ─────────────────────────────────────────────────────────────
create table if not exists periods (
  id              text primary key,
  month           date not null check (extract(day from month) = 1),  -- first day of the month, e.g. 2026-11-01 = November 2026
  card            text not null check (card in ('Internal Card', 'Client Card')),
  status          text not null default 'Open' check (status in ('Open', 'Closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       text,
  closure_reason  text,
  extra           jsonb not null default '{}',
  unique (month, card)
);

-- ─────────────────────────────────────────────────────────────
-- Purchase requests, from submission to completion.
-- ─────────────────────────────────────────────────────────────
create table if not exists requests (
  id                    text primary key,
  purchase_id           text unique,               -- e.g. PUR-2026-4074, created when approved
  status                text not null,
  requester_name        text not null,
  manager_name          text,
  pod                   text,
  vendor                text not null,             -- tool / vendor
  purpose               text,
  expense_category      text,
  expense_type          text check (expense_type in ('Internal', 'Client')),
  client_name           text,
  purchase_type         text,                      -- One-time Purchase / Recurring Subscription / Ad Spend
  subscription_frequency text,
  amount                numeric not null,
  currency              text not null,
  card_required         text,
  expected_date         date,
  notes                 text,
  requested_at          timestamptz not null,      -- when the request was made
  decided_at            timestamptz,               -- when it was approved or rejected
  otp_provided_at       timestamptz,               -- when Finance provided the OTP
  updated_at            timestamptz not null default now(),
  -- Purchase confirmation by the requester
  completion_status             text,              -- Completed / Failed / Cancelled
  completion_vendor_amount      numeric,
  completion_currency           text,
  completion_purchase_date      date,
  completion_bank_inr_amount    numeric,
  completion_bank_amount_source text,
  completion_bank_verification_status text,
  completion_invoice_uploaded   boolean,
  completion_invoice_number     text,
  completion_invoice_date       date,
  completion_order_reference    text,
  completion_billing_frequency  text,
  completion_notes              text,
  completion_failure_reason     text,
  extra                 jsonb not null default '{}'
);
create index if not exists requests_status_idx on requests(status);

-- Every status change of a request, with its time (filled in by the API).
create table if not exists request_events (
  id           bigint generated always as identity primary key,
  request_id   text not null references requests(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  occurred_at  timestamptz not null default now()
);
create index if not exists request_events_request_idx on request_events(request_id, occurred_at);

-- ─────────────────────────────────────────────────────────────
-- One-time purchases (created when Finance processes a request, or from a bank line).
-- ─────────────────────────────────────────────────────────────
create table if not exists purchases (
  id                        text primary key,
  purchase_id               text not null unique,
  vendor                    text not null,
  employee                  text,
  pod                       text,
  client                    text,
  billable                  boolean,
  approved_amount           numeric,
  actual_amount             numeric,
  currency                  text,
  purchase_date             date,
  invoice_date              date,
  card                      text,
  evidence_url              text,
  status                    text,                  -- Completed / Pending Evidence
  actual_bank_inr_amount    numeric,
  bank_verification_status  text,
  notes                     text,
  source                    text,                  -- Approved Request / Bank Statement
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  extra                     jsonb not null default '{}'
);

-- ─────────────────────────────────────────────────────────────
-- Recurring subscriptions; bank lines are matched against these.
-- ─────────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id                         text primary key,
  subscription_id            text not null unique,  -- e.g. SUB-2026-899
  original_purchase_id       text,                  -- the request it came from, if any
  vendor                     text not null,
  tool                       text,
  owner                      text,
  pod                        text,
  client                     text,
  billable                   boolean,
  card                       text,
  expected_recurring_amount  numeric,
  currency                   text,
  billing_frequency          text,                  -- Monthly / Quarterly / Annual
  category                   text,
  start_date                 date,
  expected_renewal_date      date,
  last_charged_date          date,
  next_expected_charge       date,
  status                     text not null,         -- Active / Paused / Cancelled
  evidence_url               text,
  actual_bank_inr_amount     numeric,
  bank_verification_status   text,
  notes                      text,
  source                     text,                  -- Approved Request / Imported / Bank Statement
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  extra                      jsonb not null default '{}'
);
create index if not exists subscriptions_status_idx on subscriptions(status);

-- ─────────────────────────────────────────────────────────────
-- Advertising spend per client and platform.
-- ─────────────────────────────────────────────────────────────
create table if not exists ad_spends (
  id                        text primary key,
  original_purchase_id      text,
  client                    text,
  platform                  text,
  ad_account_name           text,
  ad_account_id             text,
  pod                       text,
  owner                     text,
  billing_period            text,
  approved_monthly_budget   numeric,
  platform_spend            numeric,
  card_amount_charged       numeric,
  currency                  text,
  evidence_type             text,
  evidence_url              text,
  notes                     text,
  actual_bank_inr_amount    numeric,
  bank_verification_status  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  extra                     jsonb not null default '{}'
);

-- ─────────────────────────────────────────────────────────────
-- Bank statement lines (deleted automatically with their period).
-- ─────────────────────────────────────────────────────────────
create table if not exists bank_transactions (
  id                        text primary key,
  period_id                 text not null references periods(id) on delete cascade,
  original_date             text,                   -- exactly as on the statement, e.g. 01/11/2026
  txn_date                  date,                   -- same date as a real date
  serial_number             text,
  original_description      text,
  reward_points             text,
  intl_amount               numeric,
  inr_amount                numeric,
  billing_amount_sign       text,                   -- CR on credits
  original_currency         text,
  type                      text,                   -- Merchant / Fee / Tax / Header ...
  normalized_vendor         text,
  suggested_vendor          text,
  status                    text not null,          -- Matched / Review / Unidentified / Associated ...
  match_type                text,
  confidence                numeric,
  confidence_level          text,
  confidence_reasons        jsonb,
  suggested_purchase_id     text,
  suggested_subscription_id text,
  suggested_ad_spend_id     text,
  suggested_client          text,
  suggested_employee        text,
  suggested_pod             text,
  parent_transaction_id     text,
  assigned_to               text,
  is_fee_billable_to_client boolean,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  extra                     jsonb not null default '{}'
);
create index if not exists bank_transactions_period_id_idx on bank_transactions(period_id);
create index if not exists bank_transactions_status_idx on bank_transactions(status);

-- ─────────────────────────────────────────────────────────────
-- Saved rules that turn bank text into a vendor name.
-- ─────────────────────────────────────────────────────────────
create table if not exists merchant_aliases (
  id                text primary key,
  pattern           text not null,
  normalized_vendor text not null,
  tool              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  extra             jsonb not null default '{}'
);

-- ─────────────────────────────────────────────────────────────
-- History of important actions.
-- ─────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id              text primary key,
  logged_at       timestamptz not null,
  user_name       text,
  action          text not null,
  entity_id       text,
  previous_value  text,
  new_value       text,
  comment         text,
  extra           jsonb not null default '{}'
);
create index if not exists audit_logs_logged_at_idx on audit_logs(logged_at desc);

-- Lock down: RLS on, no policies, and no table rights for the public roles.
do $$
declare t text;
begin
  foreach t in array array[
    'periods','requests','request_events','purchases','subscriptions','ad_spends',
    'bank_transactions','merchant_aliases','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
