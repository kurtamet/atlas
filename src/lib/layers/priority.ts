import { LEVELS, LEVEL_MIN_ZOOM, type Level, type Metric } from "./registry.ts";

/** The level whose zoom band contains `zoom`. */
export function levelForZoom(zoom: number): Level {
  let current: Level = "N";
  for (const level of LEVELS) {
    if (zoom >= LEVEL_MIN_ZOOM[level]) current = level;
  }
  return current;
}

const rank = (l: Level) => LEVELS.indexOf(l);

export interface LayerPlan {
  /** level that matches the current zoom */
  viewLevel: Level;
  /** level whose values are painted as the colored surface, or null if nothing can be shown */
  fillLevel: Level | null;
  /** true when the fill comes from a coarser level than the view (show "dato a nivel X") */
  isFallback: boolean;
  /** coarser levels drawn only as thin outlines + labels (background context) */
  outlineLevels: Level[];
}

/**
 * Priority rule (plan §3):
 * 1. The metric's own level matching the current zoom is painted.
 * 2. If it has none, the nearest coarser level it has is painted and flagged as fallback.
 *    Finer levels are never shown before their zoom.
 * 3. Coarser levels than the painted one become outlines only (no second fill).
 */
export function planLayers(metric: Metric, zoom: number, available: Level[]): LayerPlan {
  const viewLevel = levelForZoom(zoom);
  const own = metric.levels
    .filter((l) => available.includes(l) && rank(l) <= rank(viewLevel))
    .sort((a, b) => rank(b) - rank(a));
  const fillLevel = own[0] ?? null;
  const outlineLevels = available
    .filter((l) => fillLevel !== null && rank(l) < rank(fillLevel) && l !== "N")
    .sort((a, b) => rank(a) - rank(b));
  return {
    viewLevel,
    fillLevel,
    isFallback: fillLevel !== null && fillLevel !== viewLevel,
    outlineLevels,
  };
}

/** Value → 0..1 intensity on the metric's fixed domain. */
export function intensity(metric: Metric, value: number): number {
  const [lo, hi] = metric.domain;
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}
