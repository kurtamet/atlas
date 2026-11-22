/**
 * Comuna table for the trends section: one row per comuna with the comuna-level value of every
 * real layer, read from the same precomputed files the map uses.
 */
import { METRICS } from "../layers/registry.ts";

export interface ComunaRow {
  code: string;
  name: string;
  values: Record<string, number>;
  extras: Record<string, number | string | null>;
  prices: { median: number; p25?: number; p75?: number; years: Record<string, { n: number; median: number }> } | null;
}

type Dict<T> = Record<string, T>;
type Loader = <T>(file: string) => Promise<T>;
const fetchLoader: Loader = <T,>(f: string) => fetch(`/data/${f}`).then((r) => r.json() as Promise<T>);

/**
 * Trends paywall switch. Off for now (decided 2026-11-21: trends open to everyone while the user base grows);
 * set NEXT_PUBLIC_TRENDS_PAYWALL=1 to bring back the free/subscriber split.
 */
export const TRENDS_PAYWALL = process.env.NEXT_PUBLIC_TRENDS_PAYWALL === "1";

/** subscriber-only parts of the table: yearly prices and derived extras (changes, projections) */
export const FREE_LAYERS = new Set(["QX00", "EC02", "SO01", "IN01", "EN04"]);
export const FREE_EDGE = 5;

/** what a free visitor receives: comuna values (the same numbers the map shows), no series or extras */
export const freeView = (rows: ComunaRow[]): ComunaRow[] => rows.map((r) => ({ ...r, extras: {}, prices: null }));

export async function loadComunaTable(load: Loader = fetchLoader): Promise<ComunaRow[]> {
  const [fc, prices, transit, access, censo, noise, hazards, ndvi, climate, enusc, air, crime, value] = await Promise.all([
    load<{ features: Array<{ properties: { code: number | string; name: string } }> }>("comunas.geojson"),
    load<{ comunas: Dict<{ median: number; p25?: number; p75?: number; years: Dict<{ n: number; median: number }> }> }>("prices-comunas.json"),
    load<{ comunas: Dict<number> }>("transit.json"),
    load<{ comunas: Dict<number> }>("access.json"),
    load<{ comunas: Dict<{ SO01: number; pop?: number }> }>("censo.json"),
    load<{ comunas: Dict<{ EN03: number }> }>("noise.json"),
    load<{ comunas: Dict<Dict<number>> }>("hazards.json"),
    load<{ comunas: Dict<number> }>("ndvi.json"),
    load<{ comunas: Dict<Dict<number>> }>("climate.json"),
    load<{ comunas: Dict<Dict<number | string>> }>("enusc.json"),
    load<{ comunas: Dict<Dict<number | string>> }>("air.json"),
    load<{ comunas: Dict<Dict<number | null>> }>("crime.json"),
    load<{ comunas: Dict<number> }>("value.json"),
  ]);
  const real = new Set(METRICS.filter((m) => !m.demo).map((m) => m.id));
  return fc.features.map(({ properties: p }) => {
    const c = String(p.code);
    const merged: Dict<unknown> = {
      ...(hazards.comunas[c] ?? {}), ...(climate.comunas[c] ?? {}), ...(enusc.comunas[c] ?? {}), ...(air.comunas[c] ?? {}), ...(crime.comunas[c] ?? {}),
      IN04: transit.comunas[c], IN01: access.comunas[c], SO01: censo.comunas[c]?.SO01, pop: censo.comunas[c]?.pop, EN03: noise.comunas[c]?.EN03, EN04: ndvi.comunas[c], EC02: prices.comunas[c]?.median, EC01: value.comunas[c],
    };
    const values: Dict<number> = {}, extras: Dict<number | string | null> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (real.has(k) && typeof v === "number" && Number.isFinite(v)) values[k] = v;
      else if (!real.has(k) && (typeof v === "number" || typeof v === "string")) extras[k] = v;
    }
    const pr = prices.comunas[c];
    return { code: c, name: p.name, values, extras, prices: pr ? { median: pr.median, p25: pr.p25, p75: pr.p75, years: pr.years } : null };
  });
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
