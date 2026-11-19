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
}

export const METRICS: Metric[] = [
  { id: "CL01", family: "climate", levels: ["C"], unit: "días/año", domain: [0, 60], direction: "more", sources: ["S01", "S04"], decimals: 0, demo: true },
  { id: "CL03", family: "climate", levels: ["C"], unit: "mm/año", domain: [200, 450], direction: "more", sources: ["S01", "S04"], decimals: 0, demo: true },
  { id: "EN04", family: "environment", levels: ["C", "D"], unit: "NDVI", domain: [0, 0.6], direction: "more", sources: ["S02"], decimals: 2, demo: true },
  { id: "EN03", family: "environment", levels: ["C", "D"], unit: "dB Ln", domain: [40, 70], direction: "more", sources: ["S06"], decimals: 0, demo: true },
  { id: "EN01", family: "environment", levels: ["C"], unit: "µg/m³", domain: [15, 35], direction: "more", sources: ["S05"], decimals: 0, demo: true },
  { id: "IN01", family: "access", levels: ["C", "D"], unit: "índice 0–100", domain: [0, 100], direction: "better", sources: ["S07", "S08"], decimals: 0, demo: true },
  { id: "IN04", family: "access", levels: ["C", "D"], unit: "índice 0–100", domain: [0, 100], direction: "better", sources: ["S11", "S07"], decimals: 0, demo: true },
  { id: "SO01", family: "urban", levels: ["C", "D"], unit: "hab/km²", domain: [0, 20000], direction: "more", sources: ["S16", "S17"], decimals: 0, demo: true },
  { id: "RS01", family: "risk", levels: ["C"], unit: "por 100 mil hab.", domain: [200, 1400], direction: "more", sources: ["S19"], decimals: 0, demo: true },
  { id: "RS03", family: "risk", levels: ["C"], unit: "% hogares", domain: [10, 40], direction: "more", sources: ["S20"], decimals: 0, demo: true },
  { id: "EC02", family: "value", levels: ["C"], unit: "UF", domain: [1000, 10000], direction: "more", sources: ["S29"], decimals: 0, demo: false },
  { id: "EC01", family: "value", levels: ["C", "D"], unit: "UF/m²", domain: [30, 140], direction: "more", sources: ["S23"], decimals: 0, demo: true },
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
