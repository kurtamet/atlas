-- PROMETEO: payments (Stripe), plans with a monthly report allowance, guest single-report purchases.
-- Run once in Supabase → SQL Editor after 0001–0003. Safe to re-run.

-- subscriptions: three plans; the monthly allowance is counted from current_period_start
alter table public.subscriptions add column if not exists current_period_start timestamptz not null default now();
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('basic', 'partner', 'unlimited'));
create unique index if not exists subscriptions_provider_ref on public.subscriptions (provider, provider_ref);

alter table public.profiles add column if not exists stripe_customer text;

-- purchases: a single report can be bought without an account (user_id null, e-mail from checkout);
-- it carries the report input and, once generated, the report itself
alter table public.purchases alter column user_id drop not null;
alter table public.purchases add column if not exists email text;
alter table public.purchases add column if not exists product text;
alter table public.purchases add column if not exists input jsonb;
alter table public.purchases add column if not exists report_id uuid references public.reports (id) on delete set null;
alter table public.purchases add column if not exists report_started_at timestamptz;
alter table public.purchases add column if not exists paid_at timestamptz;
create unique index if not exists purchases_provider_ref on public.purchases (provider, provider_ref);
create index if not exists purchases_email on public.purchases (lower(email)) where user_id is null;

-- reports: guest reports have no user; paid_with gains 'single' (one purchase = one report)
alter table public.reports alter column user_id drop not null;
alter table public.reports drop constraint if exists reports_paid_with_check;
alter table public.reports add constraint reports_paid_with_check check (paid_with in ('subscription', 'credit', 'single', 'admin', 'preview'));

-- credits: packs (and manual grants) minus reports paid with a credit; single purchases pay for their own report
create or replace function public.report_credits(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(credits) from public.purchases where user_id = uid and status = 'paid' and kind in ('single', 'pack')), 0)::int
       - (select count(*) from public.reports where user_id = uid and paid_with = 'credit')::int;
$$;
