"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseConfigured } from "./env";

let client: SupabaseClient | null = null;

/** one browser client per tab; null when Supabase is not configured */
export function browserClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
