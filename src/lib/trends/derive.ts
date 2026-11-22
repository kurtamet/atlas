/**
 * Numbers the trends page derives from the comuna table: composite score and family scores
 * (same method as the map's composite layer), price changes over time, liquidity, sectors.
 * Everything here is arithmetic on data we already serve; nothing is modelled or invented.
 */
import { METRICS, type FamilyId } from "../layers/registry.ts";
import { addComposite, COMPOSITE_ID, HIGH_IS_BAD, HIGH_IS_GOOD } from "../layers/composite.ts";
import type { AreaCollection } from "../geo.ts";
import type { ComunaRow } from "../data/comunas.ts";

/** the usual way people in Santiago group comunas; every comuna of the table is in exactly one sector */
export const SECTORS: Array<{ id: string; codes: string[] }> = [
  { id: "oriente", codes: ["13132", "13114", "13115", "13123", "13113", "13120"] },
  { id: "suroriente", codes: ["13122", "13118", "13110"] },
  { id: "centro", codes: ["13101", "13106", "13108", "13127", "13130", "13129"] },
  { id: "norte", codes: ["13107", "13104", "13125", "13128"] },
  { id: "poniente", codes: ["13119", "13124", "13102", "13103", "13117", "13126"] },
  { id: "sur", codes: ["13109", "13105", "13111", "13131", "13112", "13116", "13121"] },
];
export const sectorOf = (code: string) => SECTORS.find((s) => s.codes.includes(code))?.id ?? null;

/** families that enter the composite score, in display order */
export const SCORE_FAMILIES: FamilyId[] = ["access", "environment", "risk", "climate"];
const PARTS = METRICS.filter((m) => !m.demo && (HIGH_IS_GOOD.has(m.id) || HIGH_IS_BAD.has(m.id)));

export interface PriceStats {
  /** median deal price (UF) per year, all years with data */
  med: Record<string, number>;
  n: Record<string, number>;
  /** % change of the yearly median up to the last full year; null when a year is missing */
  chg: Record<1 | 3 | 5, number | null>;
  /** deals in the last full year */
  deals: number | null;
  /** deals in the last full year per 1 000 inhabitants (Censo 2024) */
  turnover: number | null;
}

export interface Derived {
  /** composite 0–100 per comuna */
  score: Record<string, number>;
  /** 0–100 score per family per comuna (mean oriented percentile of the family's layers) */
  fam: Record<string, Partial<Record<FamilyId, number>>>;
  price: Record<string, PriceStats>;
  /** years shown in the price charts (with data for most comunas) */
  years: string[];
  /** last year with a complete count of deals; later years are partial */
  lastFull: string | null;
  /** the partial year after lastFull, if any */
  partial: string | null;
}

const pct = (vals: number[], v: number) => {
  let below = 0, equal = 0;
  for (const x of vals) { if (x < v) below++; else if (x === v) equal++; }
  return (100 * (below + equal / 2)) / vals.length;
};

export function derive(rows: ComunaRow[]): Derived {
  // composite: reuse the map's implementation so the numbers match the map exactly
  const fc = { type: "FeatureCollection", features: rows.map((r) => ({ type: "Feature", geometry: null, properties: { code: r.code, ...r.values } as Record<string, string | number> })) } as unknown as AreaCollection;
  addComposite(fc, null);
  const score: Record<string, number> = {};
  for (const f of fc.features) if (typeof f.properties[COMPOSITE_ID] === "number") score[String(f.properties.code)] = f.properties[COMPOSITE_ID] as number;

  const fam: Derived["fam"] = {};
  const sorted = new Map(PARTS.map((m) => [m.id, rows.map((r) => r.values[m.id]).filter((v): v is number => typeof v === "number")]));
  for (const r of rows) {
    const acc = new Map<FamilyId, number[]>();
    for (const m of PARTS) {
      const v = r.values[m.id];
      if (typeof v !== "number") continue;
      const p = pct(sorted.get(m.id)!, v);
      acc.set(m.family, [...(acc.get(m.family) ?? []), HIGH_IS_BAD.has(m.id) ? 100 - p : p]);
    }
    fam[r.code] = Object.fromEntries([...acc].map(([k, xs]) => [k, Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)]));
  }

  // years: those with prices for at least half the comunas; the last one is partial if it has far fewer deals
  const total = new Map<string, number>();
  for (const r of rows) for (const [y, v] of Object.entries(r.prices?.years ?? {})) total.set(y, (total.get(y) ?? 0) + v.n);
  const years = [...total.keys()].sort().filter((y) => rows.filter((r) => r.prices?.years[y]).length >= rows.length / 2).slice(-9);
  let lastFull: string | null = years[years.length - 1] ?? null, partial: string | null = null;
  if (years.length > 1 && total.get(years[years.length - 1])! < 0.8 * total.get(years[years.length - 2])!) {
    partial = years[years.length - 1];
    lastFull = years[years.length - 2];
  }

  const price: Derived["price"] = {};
  for (const r of rows) {
    if (!r.prices) continue;
    const med: Record<string, number> = {}, n: Record<string, number> = {};
    for (const y of years) { const v = r.prices.years[y]; if (v) { med[y] = v.median; n[y] = v.n; } }
    const change = (k: number) => {
      if (!lastFull) return null;
      const a = med[String(Number(lastFull) - k)], b = med[lastFull];
      return a && b ? Math.round((100 * (b - a)) / a) || 0 : null;
    };
    const deals = lastFull ? n[lastFull] ?? null : null;
    const pop = typeof r.extras.pop === "number" ? r.extras.pop : null;
    price[r.code] = { med, n, chg: { 1: change(1), 3: change(3), 5: change(5) }, deals, turnover: deals !== null && pop ? Math.round((10000 * deals) / pop) / 10 : null };
  }
  return { score, fam, price, years, lastFull, partial };
}

/** Pearson r and least-squares line through the points */
export function fit(points: Array<{ x: number; y: number }>): { r: number; a: number; b: number } | null {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (!sxx || !syy) return null;
  const b = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), a: my - b * mx, b };
}
