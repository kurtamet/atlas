import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/server";
import { RETAIL_CLP, packById, planById, type ProductId } from "./plans";

/**
 * Stripe Checkout for PROMETEO. Prices are sent inline (price_data), so nothing has to be set up
 * in the Stripe dashboard except the webhook. Fulfilment is idempotent and runs from two places:
 * the webhook and the success page (so a purchase works even before the webhook is configured).
 */

let client: Stripe | null = null;
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const BRAND = "PROMETEO";
const NAMES: Record<ProductId, { es: string; en: string }> = {
  single: { es: "Informe completo de una propiedad", en: "Full property report" },
  pack5: { es: "Pack de 5 informes", en: "Pack of 5 reports" },
  pack15: { es: "Pack de 15 informes", en: "Pack of 15 reports" },
  pack30: { es: "Pack de 30 informes", en: "Pack of 30 reports" },
  basic: { es: "Suscripción Básica: tendencias, datos y 5 informes al mes", en: "Basic plan: trends, data and 5 reports a month" },
  partner: { es: "Suscripción Partner: tendencias, datos y 10 informes al mes", en: "Partner plan: trends, data and 10 reports a month" },
  unlimited: { es: "Suscripción Ilimitada: tendencias, datos e informes sin límite", en: "Unlimited plan: trends, data and unlimited reports" },
};

export function amountOf(product: ProductId): number {
  if (product === "single") return RETAIL_CLP;
  return (packById(product) ?? planById(product))!.clp;
}

export interface CheckoutArgs {
  product: ProductId;
  locale: "es" | "en";
  origin: string;
  /** where "back" in Checkout returns to (same-origin path) */
  cancelPath: string;
  user: { id: string; email: string | null } | null;
  /** report input for a single purchase */
  input?: unknown;
  title?: string;
}

/** records a pending purchase and opens a Checkout session; returns the URL to redirect to */
export async function createCheckout(a: CheckoutArgs): Promise<string> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  const s = stripe();
  const plan = planById(a.product);
  const pack = packById(a.product);
  const amount = amountOf(a.product);
  const loc = (p: string) => `${a.origin}${a.locale === "en" ? "/en" : ""}${p}`;

  // a single report or a pack is a one-off payment kept as a purchases row; a plan lives in subscriptions
  let purchaseId: string | null = null;
  if (!plan) {
    const { data, error } = await db.from("purchases").insert({
      user_id: a.user?.id ?? null,
      email: a.user?.email ?? null,
      kind: a.product === "single" ? "single" : "pack",
      product: a.product,
      credits: pack ? pack.credits : 0,
      amount_clp: amount,
      status: "pending",
      provider: "stripe",
      input: a.product === "single" ? a.input ?? null : null,
    }).select("id").single();
    if (error) throw new Error(`purchase insert: ${error.message}`);
    purchaseId = data.id as string;
  }

  const customer = a.user ? await customerFor(db, a.user) : undefined;
  const metadata: Record<string, string> = { product: a.product, ...(purchaseId ? { purchase_id: purchaseId } : {}), ...(a.user ? { user_id: a.user.id } : {}) };
  const name = NAMES[a.product][a.locale];
  const success = a.product === "single"
    ? loc(`/report?order=${purchaseId}&session_id={CHECKOUT_SESSION_ID}`)
    : loc(`/account?checkout={CHECKOUT_SESSION_ID}`);

  const session = await s.checkout.sessions.create({
    mode: plan ? "subscription" : "payment",
    locale: a.locale,
    ...(customer ? { customer } : { customer_creation: plan ? undefined : "always" }),
    client_reference_id: a.user?.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "clp",
        unit_amount: amount,
        product_data: { name: `${BRAND} · ${name}`, ...(a.title ? { description: a.title.slice(0, 200) } : {}) },
        ...(plan ? { recurring: { interval: "month" as const } } : {}),
      },
    }],
    metadata,
    ...(plan ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    allow_promotion_codes: true,
    success_url: success,
    cancel_url: `${a.origin}${a.cancelPath.startsWith("/") && !a.cancelPath.startsWith("//") ? a.cancelPath : "/"}`,
  });
  if (purchaseId) await db.from("purchases").update({ provider_ref: session.id }).eq("id", purchaseId);
  if (!session.url) throw new Error("no checkout url");
  return session.url;
}

/** the Stripe customer of a signed-in user, created once and kept in profiles */
async function customerFor(db: SupabaseClient, user: { id: string; email: string | null }): Promise<string> {
  const { data } = await db.from("profiles").select("stripe_customer").eq("id", user.id).maybeSingle();
  if (data?.stripe_customer) return data.stripe_customer as string;
  const c = await stripe().customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
  await db.from("profiles").update({ stripe_customer: c.id }).eq("id", user.id);
  return c.id;
}

/** the account for a checkout e-mail: an existing user, or a new one (they sign in later with a magic link) */
export async function userForEmail(db: SupabaseClient, email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  const { data } = await db.from("profiles").select("id").ilike("email", e).limit(1).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await db.auth.admin.createUser({ email: e, email_confirm: true });
  if (error) {
    console.error("checkout: create user failed", error.message);
    return null;
  }
  return created.user?.id ?? null;
}

export interface Fulfilled { product: ProductId; email: string | null; userId: string | null; purchaseId: string | null }

/** applies a completed Checkout session (safe to call many times) */
export async function fulfillSession(session: Stripe.Checkout.Session): Promise<Fulfilled | null> {
  const db = adminClient();
  if (!db) return null;
  const product = (session.metadata?.product ?? "") as ProductId;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  let userId = session.metadata?.user_id ?? session.client_reference_id ?? null;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  if (session.mode === "subscription") {
    if (session.status !== "complete") return null;
    // plans need an account: an anonymous buyer gets one for the checkout e-mail
    if (!userId && email) userId = await userForEmail(db, email);
    if (userId && customer) await db.from("profiles").update({ stripe_customer: customer }).eq("id", userId).is("stripe_customer", null);
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (subId && userId) await syncSubscription(subId, userId);
    return { product, email, userId, purchaseId: null };
  }

  if (session.payment_status !== "paid") return null;
  const purchaseId = session.metadata?.purchase_id ?? null;
  if (!purchaseId) return null;
  const { data: p } = await db.from("purchases").select("id, kind, user_id, status").eq("id", purchaseId).maybeSingle();
  if (!p) return null;
  // packs are credits on an account, so an anonymous pack buyer gets one; a single report does not need it
  let owner = (p.user_id as string | null) ?? userId;
  if (!owner && p.kind === "pack" && email) owner = await userForEmail(db, email);
  if (p.status !== "paid") {
    await db.from("purchases").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      email,
      user_id: owner,
      amount_clp: session.amount_total ?? undefined,
    }).eq("id", purchaseId).neq("status", "paid");
  }
  return { product, email, userId: owner, purchaseId };
}

/** copies a Stripe subscription into our table (plan, status, billing period) */
export async function syncSubscription(subscriptionId: string, knownUserId?: string): Promise<void> {
  const db = adminClient();
  if (!db) return;
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  const plan = planById(sub.metadata?.plan ?? sub.metadata?.product ?? "")?.id ?? "unlimited";
  let userId: string | null = knownUserId ?? sub.metadata?.user_id ?? null;
  if (!userId) {
    const cust = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const { data } = await db.from("profiles").select("id").eq("stripe_customer", cust).maybeSingle();
    userId = (data?.id as string | undefined) ?? null;
  }
  if (!userId) {
    const { data } = await db.from("subscriptions").select("user_id").eq("provider", "stripe").eq("provider_ref", sub.id).maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) { console.error("stripe: subscription without user", sub.id); return; }
  const live = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const row = {
    user_id: userId,
    plan,
    status: live ? "active" : sub.status === "canceled" ? "canceled" : "expired",
    current_period_start: new Date((item?.current_period_start ?? sub.start_date) * 1000).toISOString(),
    current_period_end: new Date((item?.current_period_end ?? sub.start_date) * 1000).toISOString(),
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    provider: "stripe",
    provider_ref: sub.id,
  };
  const { data: existing } = await db.from("subscriptions").select("id").eq("provider", "stripe").eq("provider_ref", sub.id).maybeSingle();
  if (existing) { await db.from("subscriptions").update(row).eq("id", existing.id); return; }
  const { error } = await db.from("subscriptions").insert(row);
  if (error) { await db.from("subscriptions").update(row).eq("provider", "stripe").eq("provider_ref", sub.id); return; } // a parallel call inserted it
  // the first payment, for the CRM revenue column (renewals come from invoice.paid)
  await db.from("purchases").upsert({ user_id: userId, kind: "subscription", product: plan, credits: 0, amount_clp: planById(plan)!.clp, status: "paid", provider: "stripe", provider_ref: sub.id, paid_at: new Date().toISOString() }, { onConflict: "provider,provider_ref", ignoreDuplicates: true });
}

/** a renewal invoice is a payment too (the first one is recorded with the subscription) */
export async function recordRenewal(invoice: Stripe.Invoice): Promise<void> {
  const db = adminClient();
  const subId = invoice.parent?.subscription_details?.subscription;
  const id = typeof subId === "string" ? subId : subId?.id;
  if (!db || !id) return;
  await syncSubscription(id);
  if (invoice.billing_reason !== "subscription_cycle") return;
  const { data: s } = await db.from("subscriptions").select("user_id, plan").eq("provider", "stripe").eq("provider_ref", id).maybeSingle();
  if (s) await db.from("purchases").upsert({ user_id: s.user_id, kind: "subscription", product: s.plan, credits: 0, amount_clp: invoice.amount_paid, status: "paid", provider: "stripe", provider_ref: invoice.id, paid_at: new Date().toISOString() }, { onConflict: "provider,provider_ref", ignoreDuplicates: true });
}
