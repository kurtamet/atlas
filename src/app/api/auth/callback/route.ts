import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/server";

/**
 * Magic-link landing: turn the one-time code (PKCE, same browser) or token_hash (works in any browser,
 * used by a custom e-mail template) into a session cookie, then go back where the user was.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const sb = await userClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (sb && code) {
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) { await claimGuestPurchases(data.user?.id, data.user?.email); return NextResponse.redirect(new URL(safeNext, url.origin)); }
  } else if (sb && tokenHash && type) {
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) { await claimGuestPurchases(data.user?.id, data.user?.email); return NextResponse.redirect(new URL(safeNext, url.origin)); }
  }
  return NextResponse.redirect(new URL(`${safeNext}${safeNext.includes("?") ? "&" : "?"}auth=failed`, url.origin));
}

/** reports bought without an account with this (now verified) e-mail move into the account */
async function claimGuestPurchases(userId?: string, email?: string | null) {
  const db = adminClient();
  if (!db || !userId || !email) return;
  const { data } = await db.from("purchases").update({ user_id: userId }).is("user_id", null).ilike("email", email.trim().toLowerCase()).eq("status", "paid").select("report_id");
  const ids = (data ?? []).map((p) => p.report_id).filter(Boolean);
  if (ids.length) await db.from("reports").update({ user_id: userId }).in("id", ids).is("user_id", null);
}
