-- Atlas Chile: accounts, subscriptions, purchases, saved reports and a minimal CRM.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where Postgres allows it).

create extension if not exists postgis with schema extensions;

-- profiles: one row per auth user, created by trigger
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  company text,
  segment text check (segment in ('agent', 'investor', 'flipper', 'institution', 'buyer', 'other')),
  role text not null default 'user' check (role in ('user', 'admin')),
  locale text not null default 'es',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill users created before this migration
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

-- subscriptions: unlimited plan; written only by the server (payments webhook / admin)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null default 'unlimited',
  status text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  current_period_end timestamptz not null,
  provider text,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user on public.subscriptions (user_id);

-- purchases: single reports and packs (credits), and subscription payments
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('single', 'pack', 'subscription')),
  credits int not null default 0,
  amount_clp int,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  provider text,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_user on public.purchases (user_id);

-- reports: every generated paid report, kept in the account
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  comuna text,
  location extensions.geography(point, 4326),
  locale text not null default 'es',
  source text not null check (source in ('claude', 'rules')),
  paid_with text not null default 'credit' check (paid_with in ('subscription', 'credit', 'admin', 'preview')),
  input jsonb not null,
  ai jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists reports_user on public.reports (user_id, created_at desc);

-- crm notes: admin-only notes on a customer
create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- helpers
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.has_active_subscription(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions where user_id = uid and status = 'active' and current_period_end > now());
$$;

create or replace function public.report_credits(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(credits) from public.purchases where user_id = uid and status = 'paid' and kind in ('single', 'pack')), 0)::int
       - (select count(*) from public.reports where user_id = uid and paid_with = 'credit')::int;
$$;

-- row level security: users see their own rows, admins see everything; writes go through the server
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.reports enable row level security;
alter table public.crm_notes enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- a user may edit their name/company/segment/locale, never their role
revoke update on public.profiles from authenticated;
grant update (full_name, company, segment, locale, last_seen_at) on public.profiles to authenticated;

drop policy if exists "own subscriptions" on public.subscriptions;
create policy "own subscriptions" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own purchases" on public.purchases;
create policy "own purchases" on public.purchases for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own reports" on public.reports;
create policy "own reports" on public.reports for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin notes" on public.crm_notes;
create policy "admin notes" on public.crm_notes for all using (public.is_admin()) with check (public.is_admin());
