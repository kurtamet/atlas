import { describe, expect, it } from "vitest";
import { intensity, levelForZoom, planLayers } from "./priority.ts";
import { metricById } from "./registry.ts";

const AVAILABLE = ["N", "C", "D"] as const;

describe("levelForZoom", () => {
  it("maps zoom bands to spec levels", () => {
    expect(levelForZoom(4)).toBe("N");
    expect(levelForZoom(9)).toBe("C");
    expect(levelForZoom(12)).toBe("D");
    expect(levelForZoom(15)).toBe("B");
    expect(levelForZoom(18)).toBe("O");
  });
});

describe("planLayers", () => {
  const ndvi = metricById("EN04"); // C + D
  const crime = metricById("RS01"); // C only

  it("paints nothing at country zoom when the metric has no N data", () => {
    const p = planLayers(ndvi, 5, [...AVAILABLE]);
    expect(p.fillLevel).toBeNull();
  });

  it("paints comunas at city zoom without outlines", () => {
    const p = planLayers(ndvi, 9, [...AVAILABLE]);
    expect(p).toMatchObject({ viewLevel: "C", fillLevel: "C", isFallback: false, outlineLevels: [] });
  });

  it("paints zones at district zoom, comunas become outlines", () => {
    const p = planLayers(ndvi, 12, [...AVAILABLE]);
    expect(p).toMatchObject({ fillLevel: "D", isFallback: false, outlineLevels: ["C"] });
  });

  it("falls back to the coarser level when no finer data exists", () => {
    const p = planLayers(crime, 12, [...AVAILABLE]);
    expect(p).toMatchObject({ viewLevel: "D", fillLevel: "C", isFallback: true, outlineLevels: [] });
  });

  it("never shows a finer level before its zoom", () => {
    const p = planLayers(ndvi, 8, [...AVAILABLE]);
    expect(p.fillLevel).toBe("C");
  });

  it("keeps the D fill at block zoom and flags it as fallback", () => {
    const p = planLayers(ndvi, 15, [...AVAILABLE]);
    expect(p).toMatchObject({ viewLevel: "B", fillLevel: "D", isFallback: true });
  });
});

describe("intensity", () => {
  it("uses the fixed domain and clamps", () => {
    const m = metricById("IN01"); // 0..100
    expect(intensity(m, 50)).toBe(0.5);
    expect(intensity(m, -5)).toBe(0);
    expect(intensity(m, 140)).toBe(1);
  });
});
