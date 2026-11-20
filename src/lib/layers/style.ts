import type { Metric } from "./registry.ts";
import { familyById } from "./registry.ts";

function mix(hex: string, withHex: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(withHex);
  return "#" + a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, "0")).join("");
}

/** 5-step sequential ramp from a pale tint to the family color: intensity follows the value. */
export function rampFor(metric: Metric): string[] {
  const base = familyById(metric.family).color;
  return [0.88, 0.66, 0.44, 0.22, 0].map((t) => mix(base, "#f7f8f4", t));
}

/** MapLibre fill-color expression on the metric's fixed domain; missing values stay transparent. */
export function fillColorExpression(metric: Metric): unknown {
  const ramp = rampFor(metric);
  const [lo, hi] = metric.domain;
  const stops = ramp.flatMap((c, i) => [lo + ((hi - lo) * i) / (ramp.length - 1), c]);
  return [
    "case",
    ["has", metric.id],
    ["interpolate", ["linear"], ["to-number", ["get", metric.id]], ...stops],
    "rgba(0,0,0,0)",
  ];
}

export function formatValue(metric: Metric, v: number | undefined, locale: string): string {
  if (v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US", {
    maximumFractionDigits: metric.decimals,
    minimumFractionDigits: metric.decimals,
  }).format(v);
}
