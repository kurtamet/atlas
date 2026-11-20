import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

/** what the client needs to know about the visitor: signed in?, subscriber?, credits */
export async function GET() {
  const a = await currentAccount();
  return NextResponse.json(
    a ? { configured: true, email: a.user.email, role: a.role, subscriber: a.subscriber, subscriptionEnd: a.subscriptionEnd, credits: a.credits } : { configured: supabaseConfigured(), email: null, role: null, subscriber: false, subscriptionEnd: null, credits: 0 },
    { headers: { "cache-control": "no-store" } },
  );
}
