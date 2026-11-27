import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseConfigured } from "./lib/supabase/env";

const intl = createMiddleware(routing);

/** locale routing, then refresh the Supabase session cookie so server components see a valid user */
export default async function proxy(request: NextRequest) {
  const response = intl(request);
  if (!supabaseConfigured() || response.headers.get("location")) return response;
  const sb = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  await sb.auth.getUser();
  return response as NextResponse;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|data|vendor|embed|og|.*\\..*).*)",
};
