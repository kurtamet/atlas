-- New Supabase projects no longer grant table privileges automatically.
-- The server (secret key = service_role) needs full access; signed-in users read their own rows (RLS decides which).
grant usage on schema public to authenticated, service_role;
grant all on public.profiles, public.subscriptions, public.purchases, public.reports, public.crm_notes to service_role;
grant select on public.profiles, public.subscriptions, public.purchases, public.reports to authenticated;
grant select, insert, update, delete on public.crm_notes to authenticated; -- RLS: admins only
grant update (full_name, company, segment, locale, last_seen_at) on public.profiles to authenticated;
revoke all on public.profiles, public.subscriptions, public.purchases, public.reports, public.crm_notes from anon;
