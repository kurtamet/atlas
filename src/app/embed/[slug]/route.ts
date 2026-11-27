/**
 * Embeddable comuna card (<iframe src="https://www.prometeo.land/embed/nunoa">) for agents, media and
 * communities. Self-contained HTML, no scripts, with a followed link back to the comuna page: every
 * embed is a citation of PROMETEO as the source.
 */
import { loadDataset } from "@/lib/seo/comunas";
import { fmt, monthYear } from "@/lib/seo/format";
import { localeUrl } from "@/lib/seo/site";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ds = await loadDataset();
  const p = ds.profiles.find((x) => x.slug === slug);
  if (!p) return new Response("Not found", { status: 404 });
  const l = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "es";
  const es = l === "es";
  const rows: Array<[string, string]> = [];
  if (p.types.Hd) rows.push([es ? "Departamentos" : "Apartments", `${fmt(l, p.types.Hd.med, 1)} UF/m²`]);
  if (p.types.Hc) rows.push([es ? "Casas" : "Houses", `${fmt(l, p.types.Hc.med, 1)} UF/m²`]);
  if (p.values.QX00 !== undefined) rows.push([es ? "Índice general" : "Overall score", `${p.values.QX00}/100`]);
  if (p.values.RS07 !== undefined) rows.push([es ? "Residentes en zona de inundación" : "Residents in flood zones", `${fmt(l, p.values.RS07)}%`]);
  if (p.values.IN04 !== undefined) rows.push([es ? "Transporte, salidas/h" : "Transit, departures/h", fmt(l, p.values.IN04)]);
  const href = localeUrl(l, `/comunas/${p.slug}`);
  const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="${href}"><title>${esc(p.name)} · PROMETEO</title>
<style>body{margin:0;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202d29;background:#fff}
.c{border:1px solid #dce3dd;border-radius:6px;padding:14px 16px;max-width:360px;box-sizing:border-box}
h1{font-size:18px;font-weight:600;margin:2px 0 8px;letter-spacing:-.02em}.e{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#63716a}
table{width:100%;border-collapse:collapse}td{padding:4px 0;border-top:1px solid #edf3ef}td+td{text-align:right;font-weight:600;color:#234f43}
.f{display:flex;justify-content:space-between;margin-top:9px;font-size:11px;color:#63716a}a{color:#234f43}
@media (prefers-color-scheme:dark){body{background:#192320;color:#e3ebe5}.c{border-color:#34453b}td{border-color:#243a2e}td+td,a{color:#a5cbb7}}</style></head>
<body><div class="c"><div class="e">${es ? "Comuna · Gran Santiago" : "Comuna · Greater Santiago"}</div><h1>${esc(p.name)}</h1><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="f"><span>SII ${monthYear(l, ds.period[0])}–${monthYear(l, ds.period[1])}</span><a href="${href}" target="_blank" rel="noopener">${es ? "Datos" : "Data"}: PROMETEO</a></div></div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
