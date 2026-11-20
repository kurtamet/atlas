/**
 * Builds the phase-0 demo datasets in public/data/.
 *
 *   node scripts/build-demo-data.ts
 *
 * Geometry is real (Santiago comunas from the design concept, Chile outline
 * from Natural Earth). VALUES ARE SYNTHETIC and only exist to exercise the
 * layer/zoom machinery; phase 1 replaces this script with the real pipeline.
 *
 * Aggregation follows spec §2.3: comuna values of D-level metrics are the
 * mean of the zones inside the comuna (computed from the finer data, not
 * invented separately). C-only metrics get a value per comuna.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { METRICS } from "../src/lib/layers/registry.ts";

const root = new URL("..", import.meta.url).pathname;
const comunas = JSON.parse(readFileSync(root + "scripts/src-comunas.json", "utf8")) as FeatureCollection<Polygon | MultiPolygon>;
const topo = JSON.parse(readFileSync(root + "scripts/src-world-topo.json", "utf8"));

// ---------- Chile outline (N level) ----------
const countries = (feature(topo, topo.objects.countries) as unknown as FeatureCollection).features;
const chile = countries.find((f) => String(f.id) === "152")!;
writeFileSync(
  root + "public/data/chile.geojson",
  JSON.stringify({ type: "FeatureCollection", features: [{ ...chile, properties: { name: "Chile" } }] }),
);

// ---------- helpers ----------
function pointInRing(pt: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeom(pt: Position, g: Polygon | MultiPolygon): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((rings) => pointInRing(pt, rings[0]) && !rings.slice(1).some((h) => pointInRing(pt, h)));
}
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

// Smooth synthetic field: a few gaussian bumps, different per metric (deterministic).
const CENTER: Position = [-70.65, -33.45]; // Plaza de Armas-ish
const EAST: Position = [-70.55, -33.41]; // Las Condes / Providencia
function bump(p: Position, c: Position, r: number) {
  const dx = (p[0] - c[0]) / r, dy = (p[1] - c[1]) / r;
  return Math.exp(-(dx * dx + dy * dy));
}
function seeded(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function field(id: string, p: Position): number {
  const center = bump(p, CENTER, 0.08);
  const east = bump(p, EAST, 0.07);
  const foothills = Math.max(0, Math.min(1, (p[0] + 70.6) / 0.15));
  const wobble = 0.08 * Math.sin(p[0] * 90 + p[1] * 60) + 0.06 * Math.cos(p[1] * 110);
  const t = (v: number) => Math.max(0, Math.min(1, v + wobble));
  switch (id) {
    case "EN04": return t(0.15 + 0.55 * east + 0.3 * foothills - 0.25 * center);
    case "EN03": return t(0.25 + 0.6 * center + 0.15 * east);
    case "IN01": return t(0.2 + 0.7 * center + 0.5 * east - 0.2 * foothills);
    case "IN04": return t(0.1 + 0.85 * center + 0.4 * east - 0.3 * foothills);
    case "SO01": return t(0.15 + 0.75 * center + 0.2 * east - 0.3 * foothills);
    case "EC01": return t(0.15 + 0.85 * east + 0.25 * center);
    default: return t(0.5);
  }
}

// ---------- D level: regular grid of ~600 m zones ----------
const STEP_LAT = 0.0054; // ≈ 600 m
const STEP_LON = 0.0065; // ≈ 600 m at -33.5°
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const f of comunas.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const rings of polys) for (const [x, y] of rings[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
}
const DEMO = METRICS.filter((m) => m.demo);
const dMetrics = DEMO.filter((m) => m.levels.includes("D"));
const cOnly = DEMO.filter((m) => !m.levels.includes("D"));
const zones: Feature<Polygon>[] = [];
const sums: Record<string, Record<string, number>> = {};
const counts: Record<string, number> = {};
const centers: Record<string, Position[]> = {};
let zid = 0;
for (let x = minX; x < maxX; x += STEP_LON) {
  for (let y = minY; y < maxY; y += STEP_LAT) {
    const c: Position = [x + STEP_LON / 2, y + STEP_LAT / 2];
    const comuna = comunas.features.find((f) => pointInGeom(c, f.geometry));
    if (!comuna) continue;
    const code = String(comuna.properties!.code);
    const props: Record<string, string | number> = { id: `Z${++zid}`, comuna: code, comunaName: comuna.properties!.name };
    for (const m of dMetrics) {
      const [lo, hi] = m.domain;
      const v = lo + field(m.id, c) * (hi - lo);
      props[m.id] = round(v, m.decimals);
      (sums[code] ??= {})[m.id] = (sums[code][m.id] ?? 0) + v;
    }
    counts[code] = (counts[code] ?? 0) + 1;
    (centers[code] ??= []).push(c);
    zones.push({
      type: "Feature",
      id: zid,
      properties: props,
      geometry: { type: "Polygon", coordinates: [[[x, y], [x + STEP_LON, y], [x + STEP_LON, y + STEP_LAT], [x, y + STEP_LAT], [x, y]].map(([a, b]) => [round(a, 5), round(b, 5)])] },
    });
  }
}
writeFileSync(root + "public/data/zones.geojson", JSON.stringify({ type: "FeatureCollection", features: zones }));

// ---------- C level: comunas with aggregated + comuna-only values ----------
comunas.features.forEach((f, i) => {
  const code = String(f.properties!.code);
  const props: Record<string, string | number> = { code, name: f.properties!.name, zones: counts[code] ?? 0 };
  for (const m of dMetrics) {
    if (counts[code]) props[m.id] = round(sums[code][m.id] / counts[code], m.decimals);
  }
  for (const m of cOnly) {
    const [lo, hi] = m.domain;
    props[m.id] = round(lo + (0.15 + 0.7 * seeded(i * 31 + m.id.charCodeAt(2) * 7)) * (hi - lo), m.decimals);
  }
  f.id = i + 1;
  f.properties = props;
});
writeFileSync(root + "public/data/comunas.geojson", JSON.stringify(comunas));

// Label anchors: the zone center closest to the mean of the comuna's zone centers (always inside).
const labels = comunas.features.map((f) => {
  const pts = centers[String(f.properties!.code)] ?? [];
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const best = pts.reduce((b, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? p : b), pts[0]);
  return { type: "Feature", properties: { code: f.properties!.code, name: f.properties!.name }, geometry: { type: "Point", coordinates: best.map((v) => round(v, 5)) } };
});
writeFileSync(root + "public/data/comuna-labels.geojson", JSON.stringify({ type: "FeatureCollection", features: labels }));

console.log(`chile: 1, comunas: ${comunas.features.length}, zones: ${zones.length}`);
