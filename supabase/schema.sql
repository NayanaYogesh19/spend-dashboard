-- Spendy schema for Supabase.
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Each table stores the full record from src/types.ts as JSON in `data`, so the
-- app's shapes stay the same. A few columns are pulled out for sorting/filtering.
--
-- RLS is on with no policies: the publishable (browser) key can read or write
-- nothing. Only the server-side /api routes, using the secret key, can access data.

create table if not exists requests (
  id          text primary key,
  status      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists purchases (
  id          text primary key,
  purchase_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists subscriptions (
  id              text primary key,
  subscription_id text,
  status          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  data            jsonb not null
);

create table if not exists ad_spends (
  id          text primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists periods (
  id          text primary key,
  status      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists bank_transactions (
  id          text primary key,
  period_id   text references periods(id) on delete cascade,
  status      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);
create index if not exists bank_transactions_period_id_idx on bank_transactions(period_id);

create table if not exists merchant_aliases (
  id          text primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists audit_logs (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null
);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

-- Lock down: RLS on, no policies, and no table rights for the public roles.
do $$
declare t text;
begin
  foreach t in array array[
    'requests','purchases','subscriptions','ad_spends',
    'periods','bank_transactions','merchant_aliases','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
