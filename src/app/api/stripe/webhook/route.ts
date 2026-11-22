/**
 * Stripe webhook (Dashboard → Developers → Webhooks → endpoint https://<domain>/api/stripe/webhook).
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid,
 * customer.subscription.updated, customer.subscription.deleted.
 */
import type Stripe from "stripe";
import { stripe, fulfillSession, syncSubscription, recordRenewal } from "@/lib/commerce/stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new Response("not configured", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), sig, secret);
  } catch (e) {
    console.warn("stripe webhook: bad signature", (e as Error).message);
    return new Response("bad signature", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillSession(event.data.object);
        break;
      case "invoice.paid":
        await recordRenewal(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object.id);
        break;
    }
  } catch (e) {
    console.error("stripe webhook: handler failed", event.type, e);
    return new Response("handler failed", { status: 500 }); // Stripe retries
  }
  return new Response("ok");
}
