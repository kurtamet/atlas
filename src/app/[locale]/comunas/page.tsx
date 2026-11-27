import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadDataset } from "@/lib/seo/comunas";
import { asLocale, ldJson, localeUrl, pageMeta } from "@/lib/seo/site";
import { fmt, monthYear } from "@/lib/seo/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ds = await loadDataset();
  const es = asLocale(locale) === "es";
  return pageMeta({
    locale,
    path: "/comunas",
    title: es ? "Precio del m² por comuna en Santiago 2026: ranking con datos del SII" : "Price per m² by comuna in Santiago 2026: SII data ranking",
    description: es
      ? `Ranking de las ${ds.total} comunas del Gran Santiago: UF/m² de departamentos y casas según compraventas del SII, índice de calidad general, transporte y riesgo de inundación.`
      : `Ranking of ${ds.total} Greater Santiago comunas: UF per m² for apartments and houses from SII sales, overall livability score, transit and flood risk.`,
  });
}

export default async function ComunasIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const l = asLocale(raw);
  const es = l === "es";
  const ds = await loadDataset();
  const rows = [...ds.profiles].sort((a, b) => (b.types.Hd?.med ?? 0) - (a.types.Hd?.med ?? 0));
  const rm = ds.rm.Hd;
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: es ? "Comunas del Gran Santiago por precio del m²" : "Greater Santiago comunas by price per m²",
    itemListElement: rows.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: localeUrl(l, `/comunas/${p.slug}`) })),
  };
  return (
    <section className="at-page sx-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <p className="at-eyebrow">{es ? "Comunas del Gran Santiago" : "Greater Santiago comunas"}</p>
      <h1>{es ? "Precio del m² y calidad de vida por comuna" : "Price per m² and livability by comuna"}</h1>
      <p className="at-lead">
        {es
          ? `Medianas de compraventas reales inscritas en el SII entre ${monthYear(l, ds.period[0])} y ${monthYear(l, ds.period[1])}. En la Región Metropolitana, un departamento se vendió a una mediana de ${fmt(l, rm?.med ?? 0, 1)} UF/m² construido (${fmt(l, rm?.n ?? 0)} ventas). Elige una comuna para ver precios por tipo de propiedad, riesgos naturales, ruido, áreas verdes, transporte y seguridad.`
          : `Medians of actual sales recorded by Chile's tax service (SII) between ${monthYear(l, ds.period[0])} and ${monthYear(l, ds.period[1])}. Across the Metropolitan Region an apartment sold at a median of ${fmt(l, rm?.med ?? 0, 1)} UF per built m² (${fmt(l, rm?.n ?? 0)} sales). Pick a comuna to see prices by property type, natural hazards, noise, green space, transit and safety.`}
      </p>
      <div className="sx-scroll">
        <table className="sx-table sx-rank">
          <thead>
            <tr>
              <th>#</th>
              <th>{es ? "Comuna" : "Comuna"}</th>
              <th>{es ? "Deptos UF/m²" : "Apts UF/m²"}</th>
              <th>{es ? "Casas UF/m²" : "Houses UF/m²"}</th>
              <th>{es ? "Índice general" : "Overall score"}</th>
              <th>{es ? "Transporte (salidas/h)" : "Transit (dep./h)"}</th>
              <th>{es ? "Zona de inundación" : "Flood zone"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.code}>
                <td>{i + 1}</td>
                <th scope="row"><Link href={`/comunas/${p.slug}`}>{p.name}</Link></th>
                <td>{p.types.Hd ? fmt(l, p.types.Hd.med, 1) : "–"}</td>
                <td>{p.types.Hc ? fmt(l, p.types.Hc.med, 1) : "–"}</td>
                <td>{p.values.QX00 ?? "–"}</td>
                <td>{p.values.IN04 !== undefined ? fmt(l, p.values.IN04) : "–"}</td>
                <td>{p.values.RS07 !== undefined ? `${fmt(l, p.values.RS07)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sx-muted sx-note">
        {es
          ? "Índice general PROMETEO: 0–100, promedio de percentiles de entorno, acceso, clima y riesgos (100 = mejor). Zona de inundación: % de residentes dentro de zonas de inundación oficiales."
          : "PROMETEO overall score: 0–100, mean of percentiles for environment, access, climate and hazards (100 = best). Flood zone: % of residents inside official flood zones."}{" "}
        <Link href="/methods">{es ? "Metodología" : "Methodology"}</Link>
      </p>
    </section>
  );
}
