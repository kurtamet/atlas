/**
 * Layer registry: the single description of every map layer.
 * The UI (panel, legend, map styling, place card) is generated from it,
 * so adding a layer means adding an entry here plus its data.
 *
 * IDs follow chile_atlas_layers_models_v0_1.md (CL01, EN03, …).
 */

/** Spatial levels from spec §2.1, coarse → fine. */
export const LEVELS = ["N", "C", "D", "B", "O"] as const;
export type Level = (typeof LEVELS)[number];

/** Zoom at which each level becomes the "current" level (spec §2.1 guide, not a hard rule). */
export const LEVEL_MIN_ZOOM: Record<Level, number> = {
  N: 0,
  C: 7,
  D: 11,
  B: 14,
  O: 17,
};

export type FamilyId =
  | "climate"
  | "environment"
  | "access"
  | "urban"
  | "risk"
  | "value";

export interface Family {
  id: FamilyId;
  /** spec family code C1…C6 */
  code: string;
  /** base hue of the family; the fill ramps from a light tint to this color */
  color: string;
}

export const FAMILIES: Family[] = [
  { id: "climate", code: "C1", color: "#b5852f" },
  { id: "environment", code: "C2", color: "#3f7a5a" },
  { id: "access", code: "C3", color: "#3d6a8f" },
  { id: "urban", code: "C4", color: "#7a5b8c" },
  { id: "risk", code: "C5", color: "#a4523f" },
  { id: "value", code: "C6", color: "#2f7c7a" },
];

/**
 * How value maps to color intensity.
 * - "more": darker = more of the measured quantity (neutral, e.g. density)
 * - "better": darker = more favourable for the index direction
 */
export type Direction = "more" | "better";

export interface Metric {
  id: string;
  family: FamilyId;
  /** levels at which this metric has its own (source-supported) values */
  levels: Level[];
  unit: string;
  /** fixed scale shared across zoom levels and territories (spec §3.3) */
  domain: [number, number];
  direction: Direction;
  /** spec source ids */
  sources: string[];
  /** number formatting */
  decimals: number;
  /** true while values are synthetic placeholders (phase 0); real layers set false */
  demo: boolean;
  /** own color ramp instead of the family tint (only the composite layer uses it) */
  ramp?: string[];
}

export const METRICS: Metric[] = [
  { id: "CL01", family: "climate", levels: ["C"], unit: "días/año", domain: [0, 75], direction: "more", sources: ["S12"], decimals: 0, demo: false },
  { id: "CL03", family: "climate", levels: ["C"], unit: "mm/año", domain: [300, 520], direction: "more", sources: ["S12"], decimals: 0, demo: false },
  { id: "EN04", family: "environment", levels: ["C", "D"], unit: "NDVI", domain: [0.05, 0.45], direction: "more", sources: ["S02"], decimals: 2, demo: false },
  { id: "EN03", family: "environment", levels: ["C", "D"], unit: "dBA Ld", domain: [55, 70], direction: "more", sources: ["S06"], decimals: 0, demo: false },
  { id: "EN01", family: "environment", levels: ["C"], unit: "µg/m³", domain: [17, 28], direction: "more", sources: ["S05"], decimals: 1, demo: false },
  { id: "IN01", family: "access", levels: ["C", "D"], unit: "índice 0–100", domain: [0, 100], direction: "better", sources: ["S07", "S11"], decimals: 0, demo: false },
  { id: "IN04", family: "access", levels: ["C", "D"], unit: "salidas/h", domain: [0, 600], direction: "better", sources: ["S11"], decimals: 0, demo: false },
  { id: "SO01", family: "urban", levels: ["C", "D"], unit: "hab/km²", domain: [0, 25000], direction: "more", sources: ["S16"], decimals: 0, demo: false },
  { id: "RS07", family: "risk", levels: ["C", "D"], unit: "% residentes", domain: [0, 100], direction: "more", sources: ["S22", "S26"], decimals: 0, demo: false },
  { id: "RS09", family: "risk", levels: ["C", "D"], unit: "% residentes", domain: [0, 100], direction: "more", sources: ["S22", "S26"], decimals: 0, demo: false },
  { id: "RS05", family: "risk", levels: ["C", "D"], unit: "% residentes", domain: [0, 100], direction: "more", sources: ["S22", "S25"], decimals: 0, demo: false },
  { id: "RS01", family: "risk", levels: ["C"], unit: "por 100 mil hab.", domain: [600, 4000], direction: "more", sources: ["S19"], decimals: 0, demo: false },
  { id: "RS03", family: "risk", levels: ["C"], unit: "% hogares", domain: [4, 18], direction: "more", sources: ["S20"], decimals: 1, demo: false },
  { id: "EC02", family: "value", levels: ["C"], unit: "UF", domain: [1000, 10000], direction: "more", sources: ["S29"], decimals: 0, demo: false },
  { id: "EC01", family: "value", levels: ["C"], unit: "UF/m²", domain: [20, 100], direction: "more", sources: ["S29"], decimals: 0, demo: false },
];

export const metricById = (id: string): Metric => {
  const m = METRICS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown metric ${id}`);
  return m;
};

export const familyById = (id: FamilyId): Family => {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown family ${id}`);
  return f;
};

export const metricsOfFamily = (id: FamilyId): Metric[] =>
  METRICS.filter((m) => m.family === id);
