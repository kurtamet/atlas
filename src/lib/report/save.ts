import "server-only";
import { adminClient } from "@/lib/supabase/server";
import type { ReportInput } from "./input";
import type { ReportAI } from "./schema";

export type PaidWith = "subscription" | "credit" | "single" | "admin" | "preview";

/**
 * Keeps a generated report: in the user's account, or (guest single purchase) without a user,
 * reachable through its purchase. Records what paid for it. Returns the saved id, or null.
 */
export async function saveReport(input: ReportInput, ai: ReportAI, source: "claude" | "rules", userId: string | null, paidWith: PaidWith): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  const [lng, lat] = input.object.lngLat;
  const { data, error } = await db.from("reports").insert({
    user_id: userId,
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
