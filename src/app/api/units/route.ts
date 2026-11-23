/**
 * POST /api/units { lng, lat, rings? } -> { units }
 *
 * The SII rols (apartments, offices, shops, parking…) of one building: rols located by their address
 * (table catastro_mz, "e"/"n") inside the footprint rings or within ~25 m of them, the same rule as the
 * building tile (pipeline/catastro_buildings.py). Without rings: within 30 m of the point.
 * Candidate manzanas come from a small index of their centres (src/data/mz-index.json).
 */
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";
import { unitKind, type Unit } from "@/lib/object/units";
import index from "@/data/mz-index.json";

const IDX = index as Array<[number, number, number, number, number]>; // sii, mz, lon·1e5, lat·1e5, radius m
const MAX_UNITS = 3000;
const NEAR_M = 25;

interface MzRow { sii: number; cut: number; mz: number; pr: number[]; lon: (number | null)[]; lat: (number | null)[]; how: string; dir: string[]; ds: string; m2: number[]; yr: number[]; av: number[] }
type Ring = [number, number][];

function inRing(x: number, y: number, r: Ring) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** distance in metres from a point to a segment, in a local metric frame (kx, ky m per degree) */
function segDist(px: number, py: number, a: [number, number], b: [number, number], kx: number, ky: number) {
  const ax = (a[0] - px) * kx, ay = (a[1] - py) * ky, bx = (b[0] - px) * kx, by = (b[1] - py) * ky;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export async function POST(req: Request) {
  let body: { lng?: number; lat?: number; rings?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const lng = Number(body.lng), lat = Number(body.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -72 || lng > -69 || lat < -35 || lat > -32) return NextResponse.json({ error: "bad point" }, { status: 400 });
  const rings: Ring[] = Array.isArray(body.rings)
    ? (body.rings as unknown[]).filter((r): r is Ring => Array.isArray(r) && r.length >= 4 && r.length <= 5000 && r.every((p) => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite))).slice(0, 50)
    : [];
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const kx = 111_320 * Math.cos((lat * Math.PI) / 180), ky = 110_574;
  // reach of the footprint from the point, so a long building still finds its manzanas
  let reach = 30;
  for (const r of rings) for (const [x, y] of r) reach = Math.max(reach, Math.hypot((x - lng) * kx, (y - lat) * ky) + NEAR_M);
  reach = Math.min(reach, 600);
  const cand = IDX.filter(([, , x, y, rad]) => Math.hypot((x / 1e5 - lng) * kx, (y / 1e5 - lat) * ky) <= rad + reach + 10);
  if (!cand.length) return NextResponse.json({ units: [] });
  const keys = new Set(cand.map(([s, m]) => `${s}:${m}`));
  const { data, error } = await db.from("catastro_mz").select("sii,cut,mz,pr,lon,lat,how,dir,ds,m2,yr,av")
    .in("mz", [...new Set(cand.map((c) => c[1]))].slice(0, 200));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inside = (x: number, y: number) => {
    if (!rings.length) return Math.hypot((x - lng) * kx, (y - lat) * ky) <= 30;
    if (rings.some((r) => inRing(x, y, r))) return true;
    return rings.some((r) => r.some((p, i) => i > 0 && segDist(x, y, r[i - 1], p, kx, ky) <= NEAR_M));
  };
  const units: Unit[] = [];
  for (const r of (data ?? []) as MzRow[]) {
    if (!keys.has(`${r.sii}:${r.mz}`)) continue;
    r.pr.forEach((pr, i) => {
      const x = r.lon[i], y = r.lat[i];
      if (x === null || y === null || !"en".includes(r.how[i]) || !inside(x, y)) return;
      units.push({ rol: `${r.mz}-${pr}`, cut: r.cut, dir: r.dir[i], ds: r.ds[i], kind: unitKind(r.ds[i], r.dir[i]), m2: r.m2[i] || 0, yr: r.yr[i] || 0, av: r.av[i] || 0 });
    });
  }
  units.sort((a, b) => a.dir.localeCompare(b.dir, "es", { numeric: true }));
  return NextResponse.json({ units: units.slice(0, MAX_UNITS), more: units.length > MAX_UNITS });
}
