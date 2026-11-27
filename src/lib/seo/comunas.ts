/**
 * Public comuna profiles for the SEO pages (/comunas, /comunas/[slug], blog tables, llms-full.txt).
 * Built at build time from the same precomputed files the map uses. Aggregates only: comuna medians,
 * shares and rates, never a single transaction or a person.
 *
 * The yearly price series stays behind the trends plan, so profiles carry only the current window.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadComunaTable } from "../data/comunas.ts";
import { addComposite, COMPOSITE_ID } from "../layers/composite.ts";
import type { AreaCollection } from "../geo.ts";
import { slugify } from "./site.ts";

export const TYPE_KEYS = ["Hd", "Hc", "O", "C", "I", "W", "Z", "L"] as const;
export type TypeKey = (typeof TYPE_KEYS)[number];
export interface TypeStat { med: number; n: number; p25: number; p75: number }

export interface Profile {
  code: string;
  slug: string;
  name: string;
  pop: number | null;
  /** real layer values plus QX00 (composite 0–100) */
  values: Record<string, number>;
  extras: Record<string, number | string | null>;
  types: Partial<Record<TypeKey, TypeStat>>;
  deals: { median: number; p25?: number; p75?: number; n: number } | null;
  /** 1 = highest value among the comunas that have the metric; keys are metric ids and type keys */
  ranks: Record<string, number>;
  centroid: [number, number];
}

export interface Dataset {
  profiles: Profile[];
  /** whole-region medians per type */
  rm: Partial<Record<TypeKey, TypeStat>>;
  /** price window, ISO dates */
  period: [string, string];
  total: number;
}

const dir = path.join(process.cwd(), "public", "data");
const read = async <T,>(f: string): Promise<T> => JSON.parse(await readFile(path.join(dir, f), "utf8")) as T;
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

type Geo = { features: Array<{ properties: { code: string | number }; geometry: { type: string; coordinates: unknown } }> };

function centroidOf(g: Geo["features"][number]["geometry"]): [number, number] {
  let sx = 0, sy = 0, n = 0;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") { sx += c[0] as number; sy += c[1] as number; n++; }
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g.coordinates);
  return n ? [sx / n, sy / n] : [0, 0];
}

let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  return (cache ??= build());
}

async function build(): Promise<Dataset> {
  const [rows, vt, prices, geo] = await Promise.all([
    loadComunaTable(read),
    read<{ period: [string, string]; types: Record<TypeKey, { comunas: Record<string, TypeStat>; rm: TypeStat }> }>("value-types.json"),
    read<{ comunas: Record<string, { n: number; median: number; p25?: number; p75?: number }> }>("prices-comunas.json"),
    read<Geo>("comunas.geojson"),
  ]);
  const fc = { type: "FeatureCollection", features: rows.map((r) => ({ type: "Feature", geometry: null, properties: { code: r.code, ...r.values } })) } as unknown as AreaCollection;
  addComposite(fc, null);
  const geoBy = new Map(geo.features.map((f) => [String(f.properties.code), f]));

  const profiles: Profile[] = rows.map((r, i) => {
    const q = fc.features[i].properties[COMPOSITE_ID];
    const types: Profile["types"] = {};
    for (const t of TYPE_KEYS) {
      const s = vt.types[t]?.comunas[r.code];
      if (s) types[t] = s;
    }
    const pr = prices.comunas[r.code];
    const g = geoBy.get(r.code);
    return {
      code: r.code,
      slug: slugify(r.name),
      name: r.name,
      pop: typeof r.extras.pop === "number" ? r.extras.pop : null,
      values: { ...r.values, ...(typeof q === "number" ? { [COMPOSITE_ID]: q } : {}) },
      extras: r.extras,
      types,
      deals: pr ? { median: pr.median, p25: pr.p25, p75: pr.p75, n: pr.n } : null,
      ranks: {},
      centroid: g ? centroidOf(g.geometry) : [0, 0],
    };
  });

  const rankBy = (key: string, get: (p: Profile) => number | undefined) => {
    const have = profiles.filter((p) => typeof get(p) === "number").sort((a, b) => get(b)! - get(a)!);
    have.forEach((p, i) => { p.ranks[key] = i + 1; });
  };
  const metricIds = new Set(profiles.flatMap((p) => Object.keys(p.values)));
  for (const id of metricIds) rankBy(id, (p) => p.values[id]);
  for (const t of TYPE_KEYS) rankBy(t, (p) => p.types[t]?.med);
  rankBy("deals", (p) => p.deals?.median);

  const rm: Dataset["rm"] = {};
  for (const t of TYPE_KEYS) if (vt.types[t]) rm[t] = vt.types[t].rm;
  return {
    profiles: profiles.sort((a, b) => a.name.localeCompare(b.name, "es")),
    rm,
    period: [iso(vt.period[0]), iso(vt.period[1])],
    total: profiles.length,
  };
}

export async function profileBySlug(slug: string): Promise<Profile | undefined> {
  return (await loadDataset()).profiles.find((p) => p.slug === slug);
}

/** nearest comunas by centroid, for "nearby" links */
export function nearby(p: Profile, all: Profile[], n = 4): Profile[] {
  const d = (a: Profile) => Math.hypot(a.centroid[0] - p.centroid[0], (a.centroid[1] - p.centroid[1]) * 1.2);
  return all.filter((x) => x.code !== p.code).sort((a, b) => d(a) - d(b)).slice(0, n);
}

/** comunas with a similar apartment price (±20 %) and a better overall score */
export function alternatives(p: Profile, all: Profile[], n = 3): Profile[] {
  const m = p.types.Hd?.med, q = p.values[COMPOSITE_ID];
  if (!m || q === undefined) return [];
  return all
    .filter((x) => x.code !== p.code && x.types.Hd && Math.abs(x.types.Hd.med - m) / m <= 0.2 && (x.values[COMPOSITE_ID] ?? 0) > q)
    .sort((a, b) => (b.values[COMPOSITE_ID] ?? 0) - (a.values[COMPOSITE_ID] ?? 0))
    .slice(0, n);
}
