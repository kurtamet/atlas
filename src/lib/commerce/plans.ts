/**
 * PROMETEO price list (CLP, Chilean pesos; Stripe treats CLP as a zero-decimal currency, so amounts are whole pesos).
 * Shared by the pricing page, the buy dialog and the checkout route, so a price lives in one place.
 */

export const RETAIL_CLP = 10_000;

export type PlanId = "basic" | "partner" | "unlimited";
export type PackId = "pack5" | "pack15" | "pack30";
export type ProductId = "single" | PackId | PlanId;

export interface Plan { id: PlanId; clp: number; reports: number | null /* per month; null = unlimited */ }
export interface Pack { id: PackId; clp: number; credits: number }

export const PLANS: Plan[] = [
  { id: "basic", clp: 25_000, reports: 5 },
  { id: "partner", clp: 50_000, reports: 10 },
  { id: "unlimited", clp: 150_000, reports: null },
];

export const PACKS: Pack[] = [
  { id: "pack5", clp: 35_000, credits: 5 },
  { id: "pack15", clp: 70_000, credits: 15 },
  { id: "pack30", clp: 120_000, credits: 30 },
];

export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);
export const packById = (id: string): Pack | undefined => PACKS.find((p) => p.id === id);
export const isProduct = (id: string): id is ProductId => id === "single" || !!planById(id) || !!packById(id);

/** price of one report inside a pack or plan, and the saving against buying them one by one */
export function perReport(clp: number, reports: number): { each: number; savePct: number; saveClp: number } {
  const each = Math.round(clp / reports);
  return { each, savePct: Math.round(100 * (1 - clp / (reports * RETAIL_CLP))), saveClp: reports * RETAIL_CLP - clp };
}

/** the unlimited plan pays off from this many reports a month (against retail) */
export const unlimitedBreakEven = () => Math.floor(planById("unlimited")!.clp / RETAIL_CLP) + 1;

export const formatClp = (n: number, locale: string) => `$${n.toLocaleString(locale === "en" ? "en-US" : "es-CL")}`;
