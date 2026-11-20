import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase/server";

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
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  } else if (sb && tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL(`${safeNext}${safeNext.includes("?") ? "&" : "?"}auth=failed`, url.origin));
}
