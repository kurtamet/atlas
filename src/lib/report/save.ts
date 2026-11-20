import "server-only";
import { adminClient, currentAccount } from "@/lib/supabase/server";
import type { ReportInput } from "./input";
import type { ReportAI } from "./schema";

/**
 * Keeps a generated report in the signed-in user's account. What paid for it is recorded:
 * subscription, a pack credit, admin, or "preview" while payments are not live yet.
 * Returns the saved id, or null for anonymous visitors / no Supabase.
 */
export async function saveReport(input: ReportInput, ai: ReportAI, source: "claude" | "rules"): Promise<string | null> {
  const account = await currentAccount();
  const db = adminClient();
  if (!account || !db) return null;
  const paidWith = account.role === "admin" ? "admin" : account.subscriber ? "subscription" : account.credits > 0 && source === "claude" ? "credit" : "preview";
  const [lng, lat] = input.object.lngLat;
  const { data, error } = await db.from("reports").insert({
    user_id: account.user.id,
    title: input.object.title,
    comuna: input.object.comuna,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    locale: input.locale,
    source,
    paid_with: paidWith,
    input,
    ai,
  }).select("id").single();
  if (error) { console.error("report: save failed", error.message); return null; }
  return data.id as string;
}
