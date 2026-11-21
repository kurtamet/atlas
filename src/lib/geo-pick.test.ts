import { describe, expect, it } from "vitest";
import { pickPart } from "./geo";

const sq = (x: number, y: number) => [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]];
describe("building pick", () => {
  it("keeps only the polygon under the click from a merged multipolygon", () => {
    const g = { type: "MultiPolygon" as const, coordinates: [sq(0, 0), sq(2, 0), sq(4, 0)] };
    expect(pickPart(g, [2.5, 0.5])).toEqual({ type: "Polygon", coordinates: sq(2, 0) });
    expect(pickPart(g, [3.9, 0.5])).toEqual({ type: "Polygon", coordinates: sq(4, 0) });
  });
});
