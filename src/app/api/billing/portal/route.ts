/** POST /api/billing/portal -> redirect to the Stripe customer portal (change card, cancel the plan, invoices) */
import { NextResponse } from "next/server";
import { adminClient, currentAccount } from "@/lib/supabase/server";
import { stripe, stripeConfigured } from "@/lib/commerce/stripe";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const account = await currentAccount();
  const db = adminClient();
  if (!account || !db || !stripeConfigured()) return NextResponse.redirect(`${origin}/account`, 303);
  const { data } = await db.from("profiles").select("stripe_customer, locale").eq("id", account.user.id).maybeSingle();
  if (!data?.stripe_customer) return NextResponse.redirect(`${origin}/pricing`, 303);
  const s = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer, return_url: `${origin}/account` });
  return NextResponse.redirect(s.url, 303);
}
