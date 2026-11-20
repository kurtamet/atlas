import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseConfigured } from "./env";

/** per-request client acting as the signed-in user (RLS applies) */
export async function userClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a server component: the proxy refreshes cookies */ }
      },
    },
  });
}

/** server-only client with the secret key: bypasses RLS, never send its results unfiltered */
export function adminClient(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseConfigured() || !secret) return null;
  return createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface Account {
  user: User;
  role: "user" | "admin";
  subscriber: boolean;
  subscriptionEnd: string | null;
  credits: number;
}

/** the signed-in user with their plan, or null for an anonymous visitor */
export async function currentAccount(): Promise<Account | null> {
  const sb = await userClient();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const admin = adminClient() ?? sb;
  const [profile, sub, credits] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("subscriptions").select("current_period_end").eq("user_id", user.id).eq("status", "active").gt("current_period_end", new Date().toISOString()).order("current_period_end", { ascending: false }).limit(1).maybeSingle(),
    admin.rpc("report_credits", { uid: user.id }),
  ]);
  const role = profile.data?.role === "admin" ? "admin" : "user";
  return {
    user,
    role,
    subscriber: Boolean(sub.data) || role === "admin",
    subscriptionEnd: sub.data?.current_period_end ?? null,
    credits: typeof credits.data === "number" ? credits.data : 0,
  };
}
