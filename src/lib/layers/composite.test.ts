import { describe, expect, it } from "vitest";
import { addComposite, COMPOSITE_ID } from "./composite";
import type { AreaCollection } from "../geo";

const fc = (rows: Array<Record<string, number | string>>) => ({ type: "FeatureCollection", features: rows.map((p) => ({ type: "Feature", properties: p, geometry: null })) }) as unknown as AreaCollection;

describe("composite layer", () => {
  it("scores the better comuna higher and needs three families", () => {
    const c = fc([
      { code: "1", IN01: 90, EN04: 0.4, RS01: 800, CL01: 10 },
      { code: "2", IN01: 30, EN04: 0.1, RS01: 3000, CL01: 50 },
      { code: "3", IN01: 60 },
    ]);
    addComposite(c, null);
    const [a, b, x] = c.features.map((f) => f.properties[COMPOSITE_ID]);
    expect(a).toBeGreaterThan(b as number);
    expect(x).toBeUndefined();
  });
});
