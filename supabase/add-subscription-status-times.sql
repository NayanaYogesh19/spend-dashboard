-- Adds the status-change time columns to subscriptions.
-- Run once in Supabase -> SQL Editor if your database was created before this change.
-- Safe to run again.
alter table subscriptions add column if not exists activated_at timestamptz;  -- last time set Active (or resumed)
alter table subscriptions add column if not exists paused_at    timestamptz;  -- last time paused
alter table subscriptions add column if not exists cancelled_at timestamptz;  -- last time cancelled
