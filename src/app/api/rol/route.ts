import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/server";

export interface RolHit {
  cut: number; sii: number; mz: number; pr: number;
  lon: number | null; lat: number | null;
  /** e exact address, n nearby number, m manzana only, - not located */
  how: string; dir: string; ds: string; m2: number; yr: number; av: number;
}

interface MzRow { sii: number; cut: number; mz: number; pr: number[]; lon: (number | null)[]; lat: (number | null)[]; how: string; dir: string[]; ds: string; m2: number[]; yr: number[]; av: number[] }

const int = (s: string | null) => (s && /^\d{1,6}$/.test(s) ? Number(s) : null);

/** rol lookup in the SII catastro (table catastro_mz): ?mz=1234&pr=56[&cut=13114] → matches (one per comuna) */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const mz = int(q.get("mz")), pr = int(q.get("pr")), cut = int(q.get("cut"));
  if (mz === null || pr === null) return NextResponse.json({ error: "mz and pr required" }, { status: 400 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let sel = db.from("catastro_mz").select("sii,cut,mz,pr,lon,lat,how,dir,ds,m2,yr,av").eq("mz", mz);
  if (cut !== null) sel = sel.eq("cut", cut);
  const { data, error } = await sel.limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const hits: RolHit[] = [];
  for (const r of (data ?? []) as MzRow[]) {
    const i = r.pr.indexOf(pr);
    if (i < 0) continue;
    hits.push({ cut: r.cut, sii: r.sii, mz: r.mz, pr, lon: r.lon[i], lat: r.lat[i], how: r.how[i], dir: r.dir[i], ds: r.ds[i], m2: r.m2[i], yr: r.yr[i], av: r.av[i] });
  }
  return NextResponse.json({ hits }, { headers: { "cache-control": "public, max-age=86400" } });
}
