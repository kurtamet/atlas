/**
 * Units (SII rols) of a building and their type, plus the price benchmark of that type
 * (public/data/value-types.json, pipeline/catastro_types.py).
 */

/** Hd apartment, Hc house, O office, C retail, I industrial, W land, Z parking, L storage, X other uses */
export type UnitKind = "Hd" | "Hc" | "O" | "C" | "I" | "W" | "Z" | "L" | "X";
export const KINDS: UnitKind[] = ["Hd", "Hc", "O", "C", "I", "W", "Z", "L", "X"];
/** sold together with a main unit; never the subject of a report on their own unless picked */
export const ACCESSORY = new Set<UnitKind>(["Z", "L"]);

export interface Unit {
  rol: string; // "manzana-predio"
  cut: number;
  dir: string;
  ds: string; // SII destino code
  kind: UnitKind;
  m2: number; // built m² (0 unknown)
  yr: number; // year built (0 unknown)
  av: number; // avalúo fiscal, UF
}

const APT = /\b(DP|DEPTO|DPTO|DEP)\b/;
export function unitKind(ds: string, dir = ""): UnitKind {
  if (ds === "H") return APT.test(dir) ? "Hd" : "Hc";
  return (["O", "C", "I", "W", "Z", "L"] as const).find((k) => k === ds) ?? "X";
}

/** the unit part of an SII address ("AV PROVIDENCIA 1234 DP 501" -> "DP 501"), else the whole address */
export function unitLabel(dir: string): string {
  const m = dir.match(/\b(DP|DEPTO|DPTO|DEP|OF|LC|LOC|LOCAL|BX|BD|BDB|BOD|ES|EST|CA|CASA|SL|TORRE|BL)\b.*$/);
  return (m ? m[0] : dir).trim() || dir;
}

export type Mix = Partial<Record<UnitKind, number>>;
export function mixOf(units: Unit[]): Mix {
  const m: Mix = {};
  for (const u of units) m[u.kind] = (m[u.kind] ?? 0) + 1;
  return m;
}
/** the most common main kind of a building (apartments in a tower with parking), null if only accessories */
export function mainKind(mix: Mix): UnitKind | null {
  const main = KINDS.filter((k) => !ACCESSORY.has(k) && (mix[k] ?? 0) > 0).sort((a, b) => (mix[b] ?? 0) - (mix[a] ?? 0));
  return main[0] ?? (mix.Z ? "Z" : mix.L ? "L" : null);
}

export interface PriceStats { n: number; med: number; p25: number; p75: number }
export interface TypePricesFile {
  period: [string, string];
  types: Partial<Record<UnitKind, { unit: "m2" | "land" | "unit"; rm: PriceStats | null; comunas: Record<string, PriceStats>; zones: Record<string, PriceStats> }>>;
}

export interface Valuation {
  kind: UnitKind;
  /** m2: UF per built m²; land: UF per land m²; unit: UF per unit (parking, storage) */
  basis: "m2" | "land" | "unit";
  /** where the benchmark comes from: Z zone (~1 km), C comuna, RM whole region */
  level: "Z" | "C" | "RM";
  n: number; med: number; p25: number; p75: number;
  /** region median of the same type, for position */
  rmMed: number | null;
  period: [string, string];
  /** estimate for the picked unit: benchmark × its built m² (or one unit for parking/storage) */
  area?: number;
  estimate?: { low: number; mid: number; high: number };
}

const round = (v: number) => (v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v));

export function valuation(file: TypePricesFile | null, kind: UnitKind | null, where: { zone?: string | null; cut?: string | number | null }, m2?: number): Valuation | null {
  const e = kind ? file?.types[kind] : undefined;
  if (!file || !kind || !e) return null;
  const z = where.zone ? e.zones[where.zone] : undefined;
  const c = where.cut != null ? e.comunas[String(where.cut)] : undefined;
  const [s, level] = z ? [z, "Z" as const] : c ? [c, "C" as const] : e.rm ? [e.rm, "RM" as const] : [null, null];
  if (!s || !level) return null;
  const v: Valuation = { kind, basis: e.unit, level, n: s.n, med: s.med, p25: s.p25, p75: s.p75, rmMed: e.rm?.med ?? null, period: file.period };
  if (e.unit === "unit") v.estimate = { low: round(s.p25), mid: round(s.med), high: round(s.p75) };
  else if (e.unit === "m2" && m2 && m2 > 0) {
    v.area = m2;
    v.estimate = { low: round(s.p25 * m2), mid: round(s.med * m2), high: round(s.p75 * m2) };
  }
  return v;
}

let pricesPromise: Promise<TypePricesFile | null> | null = null;
export const loadTypePrices = () =>
  (pricesPromise ??= fetch("/data/value-types.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
