import { describe, expect, it } from "vitest";
import { metres, walkMinutes, inPolygonal, distanceToLines, pointFacts, observations, type PoisFile, type HazardsFile } from "./facts";

const sq = { type: "Polygon" as const, coordinates: [[[-70.61, -33.45], [-70.6, -33.45], [-70.6, -33.44], [-70.61, -33.44], [-70.61, -33.45]]] };

describe("object facts", () => {
  it("measures metres and walking minutes", () => {
    const d = metres([-70.6, -33.45], [-70.6, -33.441]);
    expect(d).toBeGreaterThan(990);
    expect(d).toBeLessThan(1000);
    expect(Math.round(walkMinutes(1000))).toBe(17); // 1 km × 1.3 at 4.5 km/h
  });
  it("tests point in polygon and line distance", () => {
    expect(inPolygonal([-70.605, -33.445], sq)).toBe(true);
    expect(inPolygonal([-70.62, -33.445], sq)).toBe(false);
    const km = distanceToLines([-70.605, -33.445], { type: "LineString", coordinates: [[-70.59, -33.46], [-70.59, -33.43]] }) / 1000;
    expect(km).toBeGreaterThan(1.3);
    expect(km).toBeLessThan(1.5);
  });
  it("builds observations with levels and always lists unknowns", () => {
    const pois: PoisFile = { groups: { food: [[-70.605, -33.4452]], pharmacy: [[-70.605, -33.446]], health: [[-70.604, -33.445]], park: [], school: [], transport: [[-70.605, -33.445]], metro: [[-70.606, -33.446, "Estación X"]] } };
    const hz: HazardsFile = { features: [{ properties: { k: "RS07" }, geometry: sq }, { properties: { k: "fault" }, geometry: { type: "LineString", coordinates: [[-70.59, -33.46], [-70.59, -33.43]] } }] };
    const f = pointFacts([-70.605, -33.445], pois, hz);
    expect(f.hazards.RS07).toBe(true);
    expect(f.metroName).toBe("Estación X");
    const o = observations(f, { zone: { EN03: 67 }, comuna: { RS03: 13.5, name: "Ñuñoa" } });
    expect(o.pros.map((x) => x.key)).toEqual(expect.arrayContaining(["metroNear", "dailyNear"]));
    expect(o.cons.map((x) => x.key)).toEqual(expect.arrayContaining(["flood", "noisy", "victimHigh"]));
    expect(o.cons.find((x) => x.key === "victimHigh")?.level).toBe("C");
    expect(o.unknown.length).toBe(5);
  });
});

describe("crime observation", () => {
  it("flags high and low recorded violent crime at comuna level", () => {
    const base = { minutes: {}, metroName: undefined, hazards: { RS07: false, RS09: false, RS05: false }, faultKm: undefined };
    expect(observations(base as never, { comuna: { RS01: 3931, name: "Santiago" } }).cons.map((o) => o.key)).toContain("crimeHigh");
    expect(observations(base as never, { comuna: { RS01: 740, name: "Las Condes" } }).pros.map((o) => o.key)).toContain("crimeLow");
  });
});
