import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export type AreaFeature = Feature<Polygon | MultiPolygon, Record<string, string | number>>;
export type AreaCollection = FeatureCollection<Polygon | MultiPolygon, Record<string, string | number>>;

function inRing(pt: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function contains(f: AreaFeature, pt: Position): boolean {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((rings) => inRing(pt, rings[0]) && !rings.slice(1).some((h) => inRing(pt, h)));
}

export function findContaining(fc: AreaCollection | null, pt: Position): AreaFeature | undefined {
  return fc?.features.find((f) => contains(f, pt));
}

export type BBox = [number, number, number, number];

export function bboxOf(features: AreaFeature[]): BBox {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of polys) for (const [x, y] of rings[0]) {
      a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
    }
  }
  return [a, b, c, d];
}

/** Numeric metric values of a feature (props that look like metric ids). */
export function valuesOf(props: Record<string, string | number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) if (/^[A-Z]{2}\d{2}$/.test(k) && typeof v === "number") out[k] = v;
  return out;
}
