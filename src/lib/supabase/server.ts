import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseConfigured } from "./env";
import { planById, type PlanId } from "../commerce/plans";

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
  /** trends and data unlocked: an active plan (any of the three) or admin */
  subscriber: boolean;
  plan: PlanId | null;
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** reports left in the current billing month: null = unlimited (unlimited plan, admin), 0 without a plan */
  planReportsLeft: number | null;
  /** pack credits (do not depend on the plan) */
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
    admin.from("subscriptions").select("plan, current_period_start, current_period_end, cancel_at_period_end").eq("user_id", user.id).eq("status", "active").gt("current_period_end", new Date().toISOString()).order("current_period_end", { ascending: false }).limit(1).maybeSingle(),
    admin.rpc("report_credits", { uid: user.id }),
  ]);
  const role = profile.data?.role === "admin" ? "admin" : "user";
  const plan = sub.data ? (planById(String(sub.data.plan))?.id ?? "unlimited") : null;
  let planReportsLeft: number | null = 0;
  if (role === "admin" || plan === "unlimited") planReportsLeft = null;
  else if (plan) {
    const { count } = await admin.from("reports").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("paid_with", "subscription").gte("created_at", sub.data!.current_period_start ?? sub.data!.current_period_end);
    planReportsLeft = Math.max(0, planById(plan)!.reports! - (count ?? 0));
  }
  return {
    user,
    role,
    subscriber: Boolean(sub.data) || role === "admin",
    plan,
    subscriptionEnd: sub.data?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(sub.data?.cancel_at_period_end),
    planReportsLeft,
    credits: typeof credits.data === "number" ? Math.max(0, credits.data) : 0,
  };
}

/** what pays for the next report: the plan's monthly allowance first, then a pack credit */
export function reportPayment(a: Account): "admin" | "subscription" | "credit" | null {
  if (a.role === "admin") return "admin";
  if (a.plan && (a.planReportsLeft === null || a.planReportsLeft > 0)) return "subscription";
  if (a.credits > 0) return "credit";
  return null;
}
