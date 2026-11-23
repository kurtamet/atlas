/** browser side of a purchase: ask /api/checkout for a Stripe Checkout URL and go there */
import type { ProductId } from "@/lib/commerce/plans";
import type { ReportInput } from "@/lib/report/input";
import { LEGAL_VERSION } from "@/lib/legal/operator";

export type CheckoutError = "not_configured" | "failed";

export async function startCheckout(product: ProductId, locale: string, extra: { input?: ReportInput; title?: string } = {}): Promise<CheckoutError | null> {
  try {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, locale, back: window.location.pathname + window.location.search, terms: LEGAL_VERSION, ...extra }),
    });
    if (r.status === 503) return "not_configured";
    const j = (await r.json()) as { url?: string };
    if (!r.ok || !j.url) return "failed";
    window.location.assign(j.url);
    return null;
  } catch {
    return "failed";
  }
}
