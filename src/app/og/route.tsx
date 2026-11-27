/**
 * Social card images (Open Graph / Twitter), 1200×630: /og?l=es (site), /og?l=es&c=<comuna slug>,
 * /og?l=en&b=<post slug>. Outside [locale] so the URL is stable and never redirected.
 */
import { ogCard } from "@/lib/seo/og";
import { loadDataset } from "@/lib/seo/comunas";
import { postBySlug } from "@/content/blog";
import { fmt, monthYear } from "@/lib/seo/format";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const l = q.get("l") === "en" ? "en" : "es";
  const es = l === "es";
  let res: Response;
  const comuna = q.get("c"), post = q.get("b");
  if (comuna) {
    const ds = await loadDataset();
    const p = ds.profiles.find((x) => x.slug === comuna);
    const stats: Array<[string, string]> = [];
    if (p?.types.Hd) stats.push([es ? "departamentos, UF/m²" : "apartments, UF/m²", fmt(l, p.types.Hd.med, 1)]);
    if (p?.types.Hc) stats.push([es ? "casas, UF/m²" : "houses, UF/m²", fmt(l, p.types.Hc.med, 1)]);
    if (p?.values.QX00 !== undefined) stats.push([es ? "índice general" : "overall score", `${p.values.QX00}/100`]);
    res = ogCard({
      eyebrow: es ? "Comuna · Gran Santiago" : "Comuna · Greater Santiago",
      title: p ? (es ? `${p.name}: precio del m², riesgos y entorno` : `${p.name}: price per m², hazards and surroundings`) : "PROMETEO",
      stats,
      footer: `SII ${monthYear(l, ds.period[0])}–${monthYear(l, ds.period[1])}`,
    });
  } else if (post) {
    const p = postBySlug(post);
    res = ogCard({ eyebrow: "Blog · PROMETEO", title: p ? p[l].title : "PROMETEO", footer: "prometeo.land/blog" });
  } else {
    res = ogCard({
      eyebrow: es ? "Inteligencia territorial · Gran Santiago" : "Territorial intelligence · Greater Santiago",
      title: es ? "Cada lugar, en contexto: precios reales del SII, riesgos, entorno y transporte" : "Every place, in context: actual SII prices, hazards, environment and transit",
      footer: "prometeo.land",
    });
  }
  res.headers.set("cache-control", "public, max-age=86400, s-maxage=604800");
  return res;
}
