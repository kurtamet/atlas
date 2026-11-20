/**
 * Deterministic part of the paid report: every number, score and chart comes from here.
 * Claude only receives this object (compact JSON) and returns short texts per block (schema.ts),
 * so tokens are spent on interpretation, never on layout, figures or charts.
 */
import { METRICS, type Metric, type FamilyId } from "../layers/registry.ts";
import type { PointFacts, Observation, PoiGroup, LngLat } from "../object/facts.ts";

export interface PriceInfo { n: number; median: number; p25: number; p75: number; years: Record<string, { n: number; median: number }> }
export interface AreaLike { features: Array<{ properties: Record<string, unknown> }> }

/** metrics where a higher value is worse for someone living there (the others: higher = better, or neutral) */
const WORSE_IF_HIGH = new Set(["EN03", "EN01", "CL01", "RS01", "RS03", "RS05", "RS07", "RS09"]);
const NEUTRAL = new Set(["SO01", "EC02", "EC01", "CL03"]);

export interface Flag { key: string; params?: Record<string, string | number> }

export interface MetricValue {
  id: string;
  family: FamilyId;
  value: number;
  unit: string;
  level: "D" | "C";
  /** share of areas of that level with a lower value, 0–100 */
  pct: number | null;
  /** 0–100, higher = more favourable; null for neutral metrics */
  favour: number | null;
}

export interface ReportInput {
  version: 1;
  createdAt: string;
  locale: "es" | "en";
  object: {
    title: string;
    lngLat: LngLat;
    comuna: string;
    comunaCode: string;
    zone: string | null;
    footprintM2: number | null;
    heightM: number | null;
  };
  metrics: MetricValue[];
  walk: Partial<Record<PoiGroup, number>>;
  metroName: string | null;
  hazards: { RS07: boolean; RS09: boolean; RS05: boolean; faultKm: number | null };
  price: (PriceInfo & { period: [string, string] | null }) | null;
  /** deterministic observation keys from the free card (facts.ts) */
  flags: { pros: Flag[]; cons: Flag[] };
  /** 0–100 per theme, from metric percentiles and point facts */
  scores: { daily: number | null; environment: number | null; safety: number | null; climate: number | null };
  /** comuna-level extras for context */
  extras: Record<string, number | string | null>;
}

function percentile(all: AreaLike | null, id: string, v: number): number | null {
  const vals = (all?.features ?? []).map((f) => f.properties[id]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (vals.length < 5) return null;
  return Math.round((100 * vals.filter((x) => x < v).length) / vals.length);
}

export function metricValue(m: Metric, zone: Record<string, unknown> | undefined, comuna: Record<string, unknown> | undefined, zones: AreaLike | null, comunas: AreaLike | null): MetricValue | null {
  if (m.demo) return null;
  const z = m.levels.includes("D") ? zone?.[m.id] : undefined;
  const c = comuna?.[m.id];
  const [v, level, pct] = typeof z === "number" ? [z, "D" as const, percentile(zones, m.id, z)] : typeof c === "number" ? [c, "C" as const, percentile(comunas, m.id, c)] : [null, "C" as const, null];
  if (v === null) return null;
  const favour = NEUTRAL.has(m.id) || pct === null ? null : WORSE_IF_HIGH.has(m.id) ? 100 - pct : pct;
  return { id: m.id, family: m.family, value: Math.round(v * 10 ** m.decimals) / 10 ** m.decimals, unit: m.unit, level, pct, favour };
}

const mean = (xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
/** walk score: 100 at ≤5 min, 0 at ≥20 min (same curve as IN01) */
const walkScore = (m: number | undefined) => (m === undefined ? null : m <= 5 ? 100 : m >= 20 ? 0 : Math.round((100 * (20 - m)) / 15));

export function buildReportInput(a: {
  locale: "es" | "en";
  title: string;
  lngLat: LngLat;
  area: number | null;
  height?: number;
  facts: PointFacts;
  obs: { pros: Observation[]; cons: Observation[] };
  zone?: Record<string, unknown>;
  comuna?: Record<string, unknown>;
  zones: AreaLike | null;
  comunas: AreaLike | null;
  price?: PriceInfo;
  pricePeriod?: [string, string];
}): ReportInput {
  const metrics = METRICS.map((m) => metricValue(m, a.zone, a.comuna, a.zones, a.comunas)).filter((x): x is MetricValue => !!x);
  const by = (id: string) => metrics.find((m) => m.id === id)?.favour;
  const f = a.facts;
  const hazardHits = [f.hazards.RS07, f.hazards.RS09, f.hazards.RS05].filter(Boolean).length;
  const scores = {
    daily: mean([by("IN01"), by("IN04"), walkScore(f.minutes.metro ?? f.minutes.transport), walkScore(f.minutes.food), walkScore(f.minutes.health)]),
    environment: mean([by("EN04"), by("EN03"), by("EN01")]),
    // point hazards weigh more than comuna crime rates: they are about this exact place
    safety: mean([by("RS01"), by("RS03"), Math.max(0, 100 - 35 * hazardHits - (f.faultKm !== undefined && f.faultKm <= 1 ? 20 : 0))]),
    climate: mean([by("CL01")]),
  };
  const c = a.comuna ?? {};
  const pick = (k: string) => (typeof c[k] === "number" || typeof c[k] === "string" ? (c[k] as number | string) : null);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    locale: a.locale,
    object: {
      title: a.title,
      lngLat: [Math.round(a.lngLat[0] * 1e5) / 1e5, Math.round(a.lngLat[1] * 1e5) / 1e5],
      comuna: String(c.name ?? ""),
      comunaCode: String(c.code ?? ""),
      zone: a.zone ? String(a.zone.id) : null,
      footprintM2: a.area,
      heightM: a.height ? Math.round(a.height) : null,
    },
    metrics,
    walk: f.minutes,
    metroName: f.metroName ?? null,
    hazards: { ...f.hazards, faultKm: f.faultKm ?? null },
    price: a.price ? { ...a.price, period: a.pricePeriod ?? null } : null,
    flags: { pros: a.obs.pros.map(({ key, params }) => ({ key, params })), cons: a.obs.cons.map(({ key, params }) => ({ key, params })) },
    scores,
    extras: {
      RS01_chg: pick("RS01_chg"), RS01_prop: pick("RS01_prop"), RS03_lo: pick("RS03_lo"), RS03_hi: pick("RS03_hi"),
      EN03_day65: pick("EN03_day65"), EN03_night55: pick("EN03_night55"), CL01_future: pick("CL01_d"), EN01_station: pick("EN01_st"),
    },
  };
}

/** what Claude sees: the same facts without presentation-only fields */
export function promptPayload(i: ReportInput) {
  return { locale: i.locale, object: i.object, metrics: i.metrics, walk: i.walk, metroName: i.metroName, hazards: i.hazards, price: i.price, flags: i.flags, scores: i.scores, extras: i.extras };
}

/** verdict from scores and flags alone: used for the free preview and the no-AI draft */
export function ruleVerdict(i: Pick<ReportInput, "scores" | "flags">): "favorable" | "mixed" | "caution" {
  const s = Object.values(i.scores).filter((x): x is number => x !== null);
  const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 50;
  return i.flags.cons.length >= 3 || avg < 40 ? "caution" : avg >= 60 && i.flags.cons.length <= 1 ? "favorable" : "mixed";
}
