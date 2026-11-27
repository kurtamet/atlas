import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadDataset, profileBySlug, nearby, alternatives } from "@/lib/seo/comunas";
import { comunaCopy } from "@/lib/seo/comuna-copy";
import { asLocale, ldJson, localeUrl, pageMeta, SITE_URL } from "@/lib/seo/site";
import { fmt } from "@/lib/seo/format";
import { POSTS } from "@/content/blog";

export const dynamicParams = false;

export async function generateStaticParams() {
  const ds = await loadDataset();
  return routing.locales.flatMap((locale) => ds.profiles.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const p = await profileBySlug(slug);
  if (!p) return {};
  const c = comunaCopy(p, await loadDataset(), asLocale(locale));
  return pageMeta({ locale, path: `/comunas/${slug}`, title: c.metaTitle, description: c.description, og: { c: slug } });
}

const SOURCES = {
  es: [
    "Precios: SII, registro de compraventas F2890 y Detalle Catastral 2026-2 (medianas por comuna, sin datos personales).",
    "Transporte: DTPM, GTFS vigente. Servicios: Overture Maps (lugares).",
    "Ruido: MMA, Mapa de Ruido Gran Santiago 2023. Vegetación: Sentinel-2 (Copernicus). PM2.5: SINCA. Clima: ARClim.",
    "Riesgos: MINVU, Plan Regulador Metropolitano y estudios de amenaza. Población: INE, Censo 2024.",
    "Seguridad: CEAD (Ministerio de Seguridad Pública) y ENUSC 2024 (INE).",
  ],
  en: [
    "Prices: SII sales register F2890 and Detalle Catastral 2026-2 (comuna medians, no personal data).",
    "Transit: DTPM GTFS feed. Services: Overture Maps places.",
    "Noise: Ministry of Environment noise map 2023. Vegetation: Sentinel-2 (Copernicus). PM2.5: SINCA. Climate: ARClim.",
    "Hazards: MINVU, Metropolitan Zoning Plan and hazard studies. Population: INE Census 2024.",
    "Safety: CEAD (Ministry of Public Security) and ENUSC 2024 (INE).",
  ],
};

export default async function ComunaPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  setRequestLocale(raw);
  const l = asLocale(raw);
  const es = l === "es";
  const ds = await loadDataset();
  const p = ds.profiles.find((x) => x.slug === slug);
  if (!p) notFound();
  const c = comunaCopy(p, ds, l);
  const near = nearby(p, ds.profiles);
  const alt = alternatives(p, ds.profiles);
  const url = localeUrl(l, `/comunas/${slug}`);
  const posts = POSTS.slice(0, 3);
  const embed = `<iframe src="${SITE_URL}/embed/${p.slug}${es ? "" : "?lang=en"}" width="360" height="260" style="border:0" loading="lazy" title="${p.name} · PROMETEO"></iframe>`;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PROMETEO", item: localeUrl(l, "/") },
          { "@type": "ListItem", position: 2, name: es ? "Comunas" : "Comunas", item: localeUrl(l, "/comunas") },
          { "@type": "ListItem", position: 3, name: p.name, item: url },
        ],
      },
      {
        "@type": "Dataset",
        name: c.title,
        description: c.description,
        url,
        inLanguage: l,
        creator: { "@id": `${SITE_URL}/#org` },
        temporalCoverage: `${ds.period[0]}/${ds.period[1]}`,
        spatialCoverage: { "@type": "Place", name: `${p.name}, Región Metropolitana, Chile`, geo: { "@type": "GeoCoordinates", latitude: +p.centroid[1].toFixed(4), longitude: +p.centroid[0].toFixed(4) } },
        isAccessibleForFree: true,
        license: "https://creativecommons.org/licenses/by/4.0/",
        variableMeasured: c.keyFacts.map((k) => ({ "@type": "PropertyValue", name: k.label, value: k.value })),
      },
      { "@type": "FAQPage", mainEntity: c.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) },
    ],
  };

  return (
    <article className="at-page sx-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <nav className="sx-crumbs" aria-label={es ? "Ruta" : "Breadcrumb"}>
        <Link href="/">PROMETEO</Link> / <Link href="/comunas">{es ? "Comunas" : "Comunas"}</Link> / <span>{p.name}</span>
      </nav>
      <p className="at-eyebrow">{es ? "Comuna · Región Metropolitana" : "Comuna · Santiago Metropolitan Region"}</p>
      <h1>{c.title}</h1>
      {c.summary.map((s, i) => (
        <p className="at-lead" key={i}>{s}</p>
      ))}

      <dl className="sx-facts">
        {c.keyFacts.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd>{k.value}</dd>
            {k.note && <small>{k.note}</small>}
          </div>
        ))}
      </dl>

      <div className="sx-cta">
        <Link href={`/?q=${encodeURIComponent(p.name)}`} className="at-primary">{es ? `Ver ${p.name} en el mapa` : `See ${p.name} on the map`}</Link>
        <Link href="/pricing" className="at-secondary">{es ? "Informe de una dirección" : "Report for an address"}</Link>
      </div>

      {c.sections.map((s) => (
        <section className="sx-section" key={s.id} id={s.id}>
          <h2>{s.title}</h2>
          {s.paragraphs.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          <table className="sx-table">
            <tbody>
              {s.facts.map((k) => (
                <tr key={k.label}>
                  <th scope="row">{k.label}</th>
                  <td>{k.value}</td>
                  <td className="sx-muted">{k.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {alt.length > 0 && (
        <section className="sx-section">
          <h2>{es ? "Precio similar, mejor índice general" : "Similar price, better overall score"}</h2>
          <ul className="sx-links">
            {alt.map((a) => (
              <li key={a.code}>
                <Link href={`/comunas/${a.slug}`}>{a.name}</Link>
                <span className="sx-muted"> · {fmt(l, a.types.Hd!.med, 1)} UF/m² · {a.values.QX00}/100</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sx-section">
        <h2>{es ? "Comunas cercanas" : "Nearby comunas"}</h2>
        <ul className="sx-links">
          {near.map((a) => (
            <li key={a.code}>
              <Link href={`/comunas/${a.slug}`}>{a.name}</Link>
              {a.types.Hd && <span className="sx-muted"> · {fmt(l, a.types.Hd.med, 1)} UF/m²</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="sx-section">
        <h2>{es ? "Preguntas frecuentes" : "Frequently asked questions"}</h2>
        {c.faq.map((x) => (
          <details key={x.q} className="sx-faq" open>
            <summary>{x.q}</summary>
            <p>{x.a}</p>
          </details>
        ))}
      </section>

      <section className="sx-section">
        <h2>{es ? "Lecturas relacionadas" : "Related reading"}</h2>
        <ul className="sx-links">
          {posts.map((b) => (
            <li key={b.slug}><Link href={`/blog/${b.slug}`}>{b[l].title}</Link></li>
          ))}
        </ul>
      </section>

      <section className="sx-section sx-embed">
        <h2>{es ? "Inserta estos datos en tu sitio" : "Embed this data on your site"}</h2>
        <p>{es ? "Corredores, medios y comunidades pueden usar esta ficha gratis, con enlace a la fuente." : "Agents, media and communities can use this card for free, with a link to the source."}</p>
        <code>{embed}</code>
      </section>

      <section className="sx-section sx-sources">
        <h2>{es ? "Fuentes y método" : "Sources and method"}</h2>
        <ul>
          {SOURCES[l].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p>
          {es ? "Datos agregados por comuna, actualizados al " : "Comuna-level aggregates, updated "}
          {ds.period[1]}. <Link href="/methods">{es ? "Metodología" : "Methodology"}</Link>
        </p>
      </section>
    </article>
  );
}
