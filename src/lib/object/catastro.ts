/** SII catastro facts as carried by a building tile feature or built from a rol search hit */
export interface CatastroFacts { u: number; nr: number; ds?: string; m2u?: number; yr?: number; av?: number; nd?: number; ufm2?: number }

/** SII catastro aggregates carried by the building tile (pipeline/catastro_buildings.py); null when the footprint has none */
export function catastroOf(p: Record<string, string | number>): CatastroFacts | null {
  const n = (k: string) => (p[k] === undefined || p[k] === null || p[k] === "" ? undefined : Number(p[k]));
  const nr = n("nr");
  if (!nr) return null;
  return { u: n("u") ?? 0, nr, ds: p.ds ? String(p.ds) : undefined, m2u: n("m2u"), yr: n("yr"), av: n("av"), nd: n("nd"), ufm2: n("ufm2") };
}
