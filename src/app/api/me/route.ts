import { NextResponse } from "next/server";
import { currentAccount, reportPayment } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

/** what the client needs to know about the visitor: signed in?, plan, reports left */
export async function GET() {
  const a = await currentAccount();
  return NextResponse.json(
    a
      ? { configured: true, email: a.user.email, role: a.role, subscriber: a.subscriber, plan: a.plan, subscriptionEnd: a.subscriptionEnd, planReportsLeft: a.planReportsLeft, credits: a.credits, canReport: reportPayment(a) !== null }
      : { configured: supabaseConfigured(), email: null, role: null, subscriber: false, plan: null, subscriptionEnd: null, planReportsLeft: 0, credits: 0, canReport: false },
    { headers: { "cache-control": "no-store" } },
  );
}
