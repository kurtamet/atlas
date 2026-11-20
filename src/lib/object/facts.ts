/**
 * Free object card facts (spec §9, M9): deterministic code only, no LLM.
 * Point-level distances and hazard inclusion are computed here from small precomputed
 * files; coarser values (zone/comuna) are passed in and the observation says which level it uses.
 */

export type LngLat = [number, number];
export type PoiGroup = "food" | "pharmacy" | "health" | "park" | "school" | "transport" | "metro";
export interface PoisFile { groups: Record<PoiGroup, Array<[number, number] | [number, number, string]>> }
type Ring = number[][];
type Geom = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | { type: "LineString"; coordinates: number[][] } | { type: "MultiLineString"; coordinates: number[][][] } | { type: "GeometryCollection"; geometries: Geom[] };
export interface HazardsFile { features: Array<{ properties: { k: string }; geometry: Geom }> }

// spec M3 fallback: straight line × 1.3 at 4.5 km/h until network routing exists
export const DETOUR = 1.3;
export const SPEED_M_PER_MIN = 4500 / 60;
const KY = 110_574;
const kx = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** metres between two points (local equirectangular; error < 0.1% at city scale) */
export function metres(a: LngLat, b: LngLat): number {
  const k = kx((a[1] + b[1]) / 2);
  return Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * KY);
}

export const walkMinutes = (m: number) => (m * DETOUR) / SPEED_M_PER_MIN;

export function nearest(pts: Array<[number, number] | [number, number, string]>, p: LngLat): { m: number; name?: string } | null {
  let best = Infinity, name: string | undefined;
  for (const q of pts) {
    const d = metres(p, [q[0], q[1]]);
    if (d < best) { best = d; name = q[2]; }
  }
  return Number.isFinite(best) ? { m: best, name } : null;
}

function inRing(p: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygonal(p: LngLat, g: Geom): boolean {
  if (g.type === "Polygon") return inRing(p, g.coordinates[0]) && !g.coordinates.slice(1).some((h) => inRing(p, h));
  if (g.type === "MultiPolygon") return g.coordinates.some((poly) => inPolygonal(p, { type: "Polygon", coordinates: poly }));
  if (g.type === "GeometryCollection") return g.geometries.some((x) => inPolygonal(p, x));
  return false;
}

function segDist(p: LngLat, a: number[], b: number[]): number {
  const k = kx(p[1]);
  const [px, py] = [p[0] * k, p[1] * KY], [ax, ay] = [a[0] * k, a[1] * KY], [bx, by] = [b[0] * k, b[1] * KY];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToLines(p: LngLat, g: Geom): number {
  const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : g.type === "GeometryCollection" ? [] : [];
  let best = g.type === "GeometryCollection" ? Math.min(...g.geometries.map((x) => distanceToLines(p, x))) : Infinity;
  for (const l of lines) for (let i = 1; i < l.length; i++) best = Math.min(best, segDist(p, l[i - 1], l[i]));
  return best;
}

export interface PointFacts {
  minutes: Partial<Record<PoiGroup, number>>;
  metroName?: string;
  hazards: { RS07: boolean; RS09: boolean; RS05: boolean };
  faultKm?: number;
}

export function pointFacts(p: LngLat, pois: PoisFile, hazards: HazardsFile): PointFacts {
  const minutes: PointFacts["minutes"] = {};
  let metroName: string | undefined;
  for (const g of Object.keys(pois.groups) as PoiGroup[]) {
    const n = nearest(pois.groups[g], p);
    if (n) minutes[g] = Math.round(walkMinutes(n.m));
    if (g === "metro" && n) metroName = n.name;
  }
  const hz = { RS07: false, RS09: false, RS05: false };
  let faultKm: number | undefined;
  for (const f of hazards.features) {
    if (f.properties.k === "fault") faultKm = Math.round(distanceToLines(p, f.geometry) / 100) / 10;
    else if (f.properties.k in hz) hz[f.properties.k as keyof typeof hz] = inPolygonal(p, f.geometry);
  }
  return { minutes, metroName, hazards: hz, faultKm };
}

/** one templated observation: i18n key + params + the evidence it rests on (spec M9: evidence_id + rule) */
export interface Observation { key: string; params?: Record<string, string | number>; evidence: string; level: "O" | "D" | "C" }

export interface AreaValues { zone?: Record<string, unknown>; comuna?: Record<string, unknown> }
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function observations(f: PointFacts, a: AreaValues): { pros: Observation[]; cons: Observation[]; unknown: Observation[] } {
  const pros: Observation[] = [], cons: Observation[] = [];
  const m = f.minutes;
  if (m.metro !== undefined && m.metro <= 12) pros.push({ key: "metroNear", params: { name: f.metroName ?? "", min: m.metro }, evidence: "gtfs-metro", level: "O" });
  if (m.metro !== undefined && m.metro > 25 && (m.transport ?? 99) > 5) cons.push({ key: "transitFar", params: { min: m.metro }, evidence: "gtfs-stops", level: "O" });
  const daily = [m.food, m.pharmacy, m.health].filter((x): x is number => x !== undefined);
  if (daily.length === 3 && Math.max(...daily) <= 10) pros.push({ key: "dailyNear", params: { min: Math.max(...daily) }, evidence: "overture-places", level: "O" });
  else if (daily.length === 3 && Math.max(...daily) > 20) cons.push({ key: "dailyFar", params: { min: Math.max(...daily) }, evidence: "overture-places", level: "O" });
  if (m.park !== undefined && m.park <= 5) pros.push({ key: "parkNear", params: { min: m.park }, evidence: "overture-places", level: "O" });
  if (f.hazards.RS07) cons.push({ key: "flood", evidence: "minvu-rs07", level: "O" });
  if (f.hazards.RS09) cons.push({ key: "landslide", evidence: "minvu-rs09", level: "O" });
  if (f.hazards.RS05) cons.push({ key: "seismicSoil", evidence: "minvu-rs05", level: "O" });
  if (f.faultKm !== undefined && f.faultKm <= 1) cons.push({ key: "fault", params: { km: f.faultKm }, evidence: "minvu-fault", level: "O" });
  const noise = num(a.zone?.EN03);
  if (noise !== undefined && noise >= 66) cons.push({ key: "noisy", params: { db: Math.round(noise) }, evidence: "mma-noise", level: "D" });
  else if (noise !== undefined && noise <= 60) pros.push({ key: "quiet", params: { db: Math.round(noise) }, evidence: "mma-noise", level: "D" });
  const ndvi = num(a.zone?.EN04);
  if (ndvi !== undefined && ndvi >= 0.3) pros.push({ key: "green", params: { ndvi: ndvi.toFixed(2) }, evidence: "sentinel-ndvi", level: "D" });
  const vict = num(a.comuna?.RS03);
  const cname = String(a.comuna?.name ?? "");
  if (vict !== undefined && vict >= 12) cons.push({ key: "victimHigh", params: { pct: vict, comuna: cname }, evidence: "enusc-sae", level: "C" });
  else if (vict !== undefined && vict <= 7) pros.push({ key: "victimLow", params: { pct: vict, comuna: cname }, evidence: "enusc-sae", level: "C" });
  const crime = num(a.comuna?.RS01);
  if (crime !== undefined && crime >= 2800) cons.push({ key: "crimeHigh", params: { rate: Math.round(crime), comuna: cname }, evidence: "cead", level: "C" });
  else if (crime !== undefined && crime <= 1200) pros.push({ key: "crimeLow", params: { rate: Math.round(crime), comuna: cname }, evidence: "cead", level: "C" });
  // always say what this free card does not establish (spec §9)
  const unknown: Observation[] = ["unit", "documents", "objectPrice", "condition", "rules"].map((key) => ({ key, evidence: "none", level: "O" as const }));
  return { pros, cons, unknown };
}
