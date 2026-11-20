import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

/** magic-link landing: exchange the one-time code for a session cookie, then go back where the user was */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const sb = await userClient();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL(`${safeNext}${safeNext.includes("?") ? "&" : "?"}auth=failed`, url.origin));
}
