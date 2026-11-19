/**
 * Free-path query parser (spec §9, M9): deterministic, no LLM.
 * Classifies the search box input as a listing link, a comuna name,
 * a set of criteria from a fixed ES/EN phrase dictionary, or an address.
 */

export interface Criterion {
  /** metric id from the layer registry */
  metric: string;
  /** "low" = prefer low values, "high" = prefer high values */
  prefer: "low" | "high";
  /** the phrase that triggered it, for explaining the result */
  phrase: string;
}

export type ParsedQuery =
  | { kind: "empty" }
  | { kind: "link"; url: string }
  | { kind: "comuna"; name: string }
  | { kind: "criteria"; criteria: Criterion[] }
  | { kind: "address"; text: string };

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¿¡()"«»“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** phrase (normalized) → criterion. Longer phrases are matched first. */
const DICTIONARY: Array<[string, Omit<Criterion, "phrase">]> = [
  // environment
  ["tranquilo", { metric: "EN03", prefer: "low" }],
  ["tranquila", { metric: "EN03", prefer: "low" }],
  ["silencioso", { metric: "EN03", prefer: "low" }],
  ["sin ruido", { metric: "EN03", prefer: "low" }],
  ["quiet", { metric: "EN03", prefer: "low" }],
  ["calm", { metric: "EN03", prefer: "low" }],
  ["verde", { metric: "EN04", prefer: "high" }],
  ["areas verdes", { metric: "EN04", prefer: "high" }],
  ["parque", { metric: "EN04", prefer: "high" }],
  ["parques", { metric: "EN04", prefer: "high" }],
  ["green", { metric: "EN04", prefer: "high" }],
  ["park", { metric: "EN04", prefer: "high" }],
  ["aire limpio", { metric: "EN01", prefer: "low" }],
  ["clean air", { metric: "EN01", prefer: "low" }],
  // access
  ["metro", { metric: "IN04", prefer: "high" }],
  ["cerca del metro", { metric: "IN04", prefer: "high" }],
  ["transporte", { metric: "IN04", prefer: "high" }],
  ["transporte publico", { metric: "IN04", prefer: "high" }],
  ["subway", { metric: "IN04", prefer: "high" }],
  ["public transport", { metric: "IN04", prefer: "high" }],
  ["transit", { metric: "IN04", prefer: "high" }],
  ["servicios", { metric: "IN01", prefer: "high" }],
  ["comercio", { metric: "IN01", prefer: "high" }],
  ["todo cerca", { metric: "IN01", prefer: "high" }],
  ["walkable", { metric: "IN01", prefer: "high" }],
  ["shops", { metric: "IN01", prefer: "high" }],
  // urban
  ["poco denso", { metric: "SO01", prefer: "low" }],
  ["denso", { metric: "SO01", prefer: "high" }],
  ["centrico", { metric: "SO01", prefer: "high" }],
  ["low density", { metric: "SO01", prefer: "low" }],
  // risk (spec: "safe" must name an aspect; we use victimization and say so in the card)
  ["sin inundaciones", { metric: "RS07", prefer: "low" }],
  ["no inundable", { metric: "RS07", prefer: "low" }],
  ["no flooding", { metric: "RS07", prefer: "low" }],
  ["no flood", { metric: "RS07", prefer: "low" }],
  ["seguro", { metric: "RS03", prefer: "low" }],
  ["segura", { metric: "RS03", prefer: "low" }],
  ["safe", { metric: "RS03", prefer: "low" }],
  // climate
  ["fresco", { metric: "CL01", prefer: "low" }],
  ["poco calor", { metric: "CL01", prefer: "low" }],
  ["cool", { metric: "CL01", prefer: "low" }],
  // value
  ["barato", { metric: "EC01", prefer: "low" }],
  ["economico", { metric: "EC01", prefer: "low" }],
  ["cheap", { metric: "EC01", prefer: "low" }],
  ["affordable", { metric: "EC01", prefer: "low" }],
];
const SORTED = [...DICTIONARY].sort((a, b) => b[0].length - a[0].length);

export function parseQuery(input: string, comunaNames: string[]): ParsedQuery {
  const raw = input.trim();
  if (!raw) return { kind: "empty" };
  if (/^(https?:\/\/|www\.)/i.test(raw)) return { kind: "link", url: raw };

  const q = normalize(raw);
  const comuna = comunaNames.find((n) => normalize(n) === q);
  if (comuna) return { kind: "comuna", name: comuna };

  // A digit usually means a street number → treat as address.
  if (/\d/.test(q)) return { kind: "address", text: raw };

  // Longest phrases first; matched text is blanked out (same length) so positions stay valid
  // and shorter phrases inside it ("metro" in "cerca del metro") don't match twice.
  let rest = ` ${q} `;
  const found: Array<Criterion & { at: number }> = [];
  for (const [phrase, c] of SORTED) {
    const needle = ` ${phrase} `;
    const at = rest.indexOf(needle);
    if (at >= 0) {
      rest = rest.slice(0, at + 1) + "\u0000".repeat(phrase.length) + rest.slice(at + 1 + phrase.length);
      if (!found.some((x) => x.metric === c.metric)) found.push({ ...c, phrase, at });
    }
  }
  const criteria: Criterion[] = found.sort((a, b) => a.at - b.at).map(({ metric, prefer, phrase }) => ({ metric, prefer, phrase }));
  if (criteria.length) return { kind: "criteria", criteria };
  return { kind: "address", text: raw };
}

/**
 * Rank areas by criteria: mean of per-criterion normalized scores (0..1, 1 = best fit).
 * Areas missing a value for a criterion are not penalized as "bad"; they get a partial
 * score over the known criteria (spec §3.2: unknown ≠ bad) and are flagged.
 */
export function rankByCriteria<T extends { values: Record<string, number | undefined> }>(
  areas: T[],
  criteria: Criterion[],
  domains: Record<string, [number, number]>,
): Array<T & { score: number; coverage: number }> {
  return areas
    .map((a) => {
      let sum = 0, n = 0;
      for (const c of criteria) {
        const v = a.values[c.metric];
        if (v === undefined) continue;
        const [lo, hi] = domains[c.metric];
        const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        sum += c.prefer === "high" ? t : 1 - t;
        n++;
      }
      return { ...a, score: n ? sum / n : 0, coverage: criteria.length ? n / criteria.length : 0 };
    })
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score);
}
