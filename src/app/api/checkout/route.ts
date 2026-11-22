/**
 * POST /api/checkout { product, locale, back, input?, title? } -> { url }
 * Single reports need no account; packs and plans are attached to the account of the checkout e-mail.
 */
import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/supabase/server";
import { changePlan, createCheckout, stripeConfigured } from "@/lib/commerce/stripe";
import { isProduct, planById } from "@/lib/commerce/plans";
import { validInput } from "@/lib/report/generate";

export async function POST(req: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  let body: { product?: string; locale?: string; back?: string; input?: unknown; title?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const product = String(body.product ?? "");
  if (!isProduct(product)) return NextResponse.json({ error: "unknown product" }, { status: 400 });
  if (product === "single" && !validInput(body.input)) return NextResponse.json({ error: "report input required" }, { status: 400 });
  const account = await currentAccount();
  const locale = body.locale === "en" ? "en" : "es";
  try {
    // already on a paid plan: switch it instead of opening a second subscription
    if (account?.plan && planById(product)) {
      if (account.plan === product) return NextResponse.json({ url: `${locale === "en" ? "/en" : ""}/account` });
      if (await changePlan(account.user.id, product, locale)) return NextResponse.json({ url: `${locale === "en" ? "/en" : ""}/account?changed=1` });
    }
    const url = await createCheckout({
      product,
      locale,
      origin: new URL(req.url).origin,
      cancelPath: String(body.back ?? "/"),
      user: account ? { id: account.user.id, email: account.user.email ?? null } : null,
      input: body.input,
      title: typeof body.title === "string" ? body.title : undefined,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("checkout failed", e);
    return NextResponse.json({ error: "checkout failed" }, { status: 500 });
  }
}
