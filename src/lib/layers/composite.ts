/**
 * "Composite": the first-impression layer. One 0–100 score per comuna and calculation zone that says
 * how good the place is overall. It lives outside the registry on purpose, so trends, reports and the
 * place card keep working on the real layers only.
 *
 * Score = mean over families (climate, environment, access, risk) of the mean percentile of the
 * family's directional layers, oriented so that 100 is the best. Neutral layers (density, prices,
 * rain) and demo layers are left out. Zones use their own value where the layer has one at zone
 * level, otherwise the percentile of their comuna.
 */
import { METRICS, type FamilyId, type Metric } from "./registry.ts";
import type { AreaCollection } from "../geo.ts";

export const COMPOSITE_ID = "QX00";

/** warm (worse) → sand → teal (better); validated as a diverging pair, the midpoint is a light neutral */
export const COMPOSITE_RAMP = ["#b4472f", "#df9a68", "#efe3bd", "#7fbca8", "#00806b"];

export const COMPOSITE: Metric = {
  id: COMPOSITE_ID,
  family: "access",
  levels: ["C", "D"],
  unit: "0–100",
  domain: [25, 75],
  direction: "better",
  sources: [],
  decimals: 0,
  demo: false,
  ramp: COMPOSITE_RAMP,
};

const HIGH_IS_GOOD = new Set(["IN01", "IN04", "EN04"]);
const HIGH_IS_BAD = new Set(["EN03", "EN01", "CL01", "RS01", "RS03", "RS05", "RS07", "RS09"]);
const PARTS = METRICS.filter((m) => !m.demo && (HIGH_IS_GOOD.has(m.id) || HIGH_IS_BAD.has(m.id)));

/** percentile with ties counted half, oriented so that higher = better */
function scorer(all: AreaCollection, id: string): (v: number) => number {
  const vals = all.features.map((f) => f.properties[id]).filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  return (v) => {
    let below = 0, equal = 0;
    for (const x of vals) { if (x < v) below++; else if (x === v) equal++; else break; }
    const pct = (100 * (below + equal / 2)) / vals.length;
    return HIGH_IS_BAD.has(id) ? 100 - pct : pct;
  };
}

function combine(parts: Array<{ family: FamilyId; s: number }>): number | null {
  const byFam = new Map<FamilyId, number[]>();
  for (const p of parts) byFam.set(p.family, [...(byFam.get(p.family) ?? []), p.s]);
  if (byFam.size < 3) return null;
  const fam = [...byFam.values()].map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
  return Math.round(fam.reduce((a, b) => a + b, 0) / fam.length);
}

/** writes properties[COMPOSITE_ID] on comunas and zones (in place) */
export function addComposite(comunas: AreaCollection, zones: AreaCollection | null): void {
  const comunaScore = new Map<string, Map<string, number>>();
  const sc = new Map(PARTS.map((m) => [m.id, scorer(comunas, m.id)]));
  for (const f of comunas.features) {
    const parts: Array<{ family: FamilyId; s: number }> = [];
    const per = new Map<string, number>();
    for (const m of PARTS) {
      const v = f.properties[m.id];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const s = sc.get(m.id)!(v);
      per.set(m.id, s);
      parts.push({ family: m.family, s });
    }
    comunaScore.set(String(f.properties.code), per);
    const c = combine(parts);
    if (c === null) delete f.properties[COMPOSITE_ID];
    else f.properties[COMPOSITE_ID] = c;
  }
  if (!zones) return;
  const zsc = new Map(PARTS.filter((m) => m.levels.includes("D")).map((m) => [m.id, scorer(zones, m.id)]));
  for (const f of zones.features) {
    const own = comunaScore.get(String(f.properties.comuna)) ?? new Map<string, number>();
    const parts: Array<{ family: FamilyId; s: number }> = [];
    for (const m of PARTS) {
      const v = f.properties[m.id];
      const s = zsc.has(m.id) && typeof v === "number" && Number.isFinite(v) ? zsc.get(m.id)!(v) : own.get(m.id);
      if (s !== undefined) parts.push({ family: m.family, s });
    }
    const c = combine(parts);
    if (c === null) delete f.properties[COMPOSITE_ID];
    else f.properties[COMPOSITE_ID] = c;
  }
}

export const getMetric = (id: string, byId: (id: string) => Metric): Metric => (id === COMPOSITE_ID ? COMPOSITE : byId(id));
