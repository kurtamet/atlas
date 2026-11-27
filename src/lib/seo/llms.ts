/**
 * llms.txt (https://llmstxt.org) and llms-full.txt: a plain-markdown map of the site for AI assistants
 * and answer engines, with the key figures inline so they can be cited without rendering the map app.
 */
import { loadDataset } from "./comunas.ts";
import { comunaCopy } from "./comuna-copy.ts";
import { localeUrl, SITE_URL } from "./site.ts";
import { fmt, monthYear } from "./format.ts";
import { plainText } from "./plain.ts";
import { POSTS } from "../../content/blog/index.ts";

const HEADER = (from: string, to: string, hd: string, n: string) => `# PROMETEO

> PROMETEO (prometeo.land) is an interactive real-estate atlas of Greater Santiago, Chile. For every comuna, zone and building it shows actual transaction prices per m² from Chile's tax service (SII F2890 sales joined with the SII property register), official natural hazards (MINVU / PRMS flood, landslide and seismic soil zones), environment (noise, vegetation, PM2.5, heat), public transport and walkable services, density and safety (CEAD, ENUSC). Sales window: ${from} to ${to}. Regional median apartment price: ${hd} UF per built m² (${n} sales). Spanish is the primary language; every page also exists in English under /en.

Key facts for citation:
- Prices are medians of recorded sales (not asking prices), computed per comuna, ~600 m zone and property type (apartments, houses, offices, retail, land, parking, storage). Aggregates only, no personal data.
- The PROMETEO overall score (0-100) is the mean of percentile scores per family: environment, access, climate and hazards (100 = best); it excludes prices and density.
- Free: map, comuna profiles, building card with reference price by property type, blog. Paid: AI-written property report for one address (from CLP 10,000), packs and monthly plans; trends section for plan holders.
- Operator contact: hola@prometeo.land. Please cite as "PROMETEO (prometeo.land), with data from SII".
`;

export async function llmsTxt(): Promise<string> {
  const ds = await loadDataset();
  const rm = ds.rm.Hd!;
  const l = "es" as const;
  const lines = [
    HEADER(monthYear("en", ds.period[0]), monthYear("en", ds.period[1]), fmt("en", rm.med, 1), fmt("en", rm.n)),
    "## Main pages",
    `- [Interactive map](${localeUrl(l, "/")}): search an address, rol (SII property id) or comuna; layers by zoom level`,
    `- [All comunas ranked by price per m²](${localeUrl(l, "/comunas")}) ([English](${localeUrl("en", "/comunas")}))`,
    `- [Methodology](${localeUrl(l, "/methods")}) and [About](${localeUrl("en", "/about")})`,
    `- [Pricing of property reports](${localeUrl("en", "/pricing")})`,
    `- [Full text of comuna profiles and articles](${SITE_URL}/llms-full.txt)`,
    "",
    "## Comuna profiles (apartments UF/m², houses UF/m², overall score)",
    ...[...ds.profiles]
      .sort((a, b) => (b.types.Hd?.med ?? 0) - (a.types.Hd?.med ?? 0))
      .map((p) => `- [${p.name}](${localeUrl(l, `/comunas/${p.slug}`)}): apartments ${p.types.Hd ? fmt("en", p.types.Hd.med, 1) : "n/a"} UF/m², houses ${p.types.Hc ? fmt("en", p.types.Hc.med, 1) : "n/a"} UF/m², score ${p.values.QX00 ?? "n/a"}/100, flood zone ${p.values.RS07 !== undefined ? `${fmt("en", p.values.RS07)}%` : "n/a"} of residents`),
    "",
    "## Articles",
    ...POSTS.map((p) => `- [${p.es.title}](${localeUrl("es", `/blog/${p.slug}`)}) / [EN](${localeUrl("en", `/blog/${p.slug}`)}): ${p.en.description}`),
    "",
    "## Sources",
    "- SII: F2890 property transactions (sii.cl transparency) and Detalle Catastral 2026-2",
    "- MINVU: OTRAS_AMENAZAS_RMS hazard zones (PRMS and hazard studies); INE Censo 2024 population by block",
    "- Ministerio del Medio Ambiente: Gran Santiago noise map 2023; SINCA PM2.5; ARClim climate",
    "- Copernicus Sentinel-2 (NDVI, January 2026); DTPM GTFS (public transport); Overture Maps (places, buildings)",
    "- CEAD (Ministerio de Seguridad Pública) police cases 2025; ENUSC 2024 (INE)",
    "",
  ];
  return lines.join("\n");
}

export async function llmsFullTxt(): Promise<string> {
  const ds = await loadDataset();
  const out: string[] = [await llmsTxt(), "", "---", ""];
  for (const l of ["es", "en"] as const) {
    out.push(l === "es" ? "# Fichas de comunas (español)" : "# Comuna profiles (English)", "");
    for (const p of ds.profiles) {
      const c = comunaCopy(p, ds, l);
      out.push(`## ${c.title}`, `URL: ${localeUrl(l, `/comunas/${p.slug}`)}`, "", ...c.summary, "");
      for (const s of c.sections) {
        out.push(`### ${s.title}`, ...s.paragraphs, ...s.facts.map((f) => `- ${f.label}: ${f.value}${f.note ? ` (${f.note})` : ""}`), "");
      }
      for (const q of c.faq) out.push(`Q: ${q.q}`, `A: ${q.a}`, "");
    }
  }
  for (const l of ["es", "en"] as const) {
    out.push(l === "es" ? "# Artículos (español)" : "# Articles (English)", "");
    for (const p of POSTS) out.push(`## ${p[l].title}`, `URL: ${localeUrl(l, `/blog/${p.slug}`)}`, `Published: ${p.date}`, "", plainText(p[l].body, ds, l), "");
  }
  return out.join("\n");
}
