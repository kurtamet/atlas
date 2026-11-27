import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { POSTS } from "@/content/blog";
import { asLocale, ldJson, localeUrl, pageMeta, SITE_URL } from "@/lib/seo/site";
import { longDate } from "@/lib/seo/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const es = asLocale(locale) === "es";
  return pageMeta({
    locale,
    path: "/blog",
    title: es ? "Blog: datos del mercado inmobiliario de Santiago" : "Blog: Santiago real-estate data",
    description: es
      ? "Análisis con datos abiertos del SII, MINVU, MMA y DTPM: precio del m² por comuna, riesgos naturales, entorno, transporte y guías para comprar en Santiago."
      : "Analysis with open data from SII, MINVU, the Ministry of Environment and DTPM: price per m² by comuna, natural hazards, environment, transit and buying guides for Santiago.",
  });
}

export default async function BlogIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const l = asLocale(raw);
  const es = l === "es";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "PROMETEO Blog",
    url: localeUrl(l, "/blog"),
    inLanguage: l,
    publisher: { "@id": `${SITE_URL}/#org` },
    blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p[l].title, url: localeUrl(l, `/blog/${p.slug}`), datePublished: p.date })),
  };
  return (
    <section className="at-page sx-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <p className="at-eyebrow">Blog</p>
      <h1>{es ? "El mercado inmobiliario de Santiago, con datos" : "Santiago real estate, by the numbers"}</h1>
      <p className="at-lead">
        {es
          ? "Análisis basados en compraventas reales del SII y en fuentes oficiales de riesgo, entorno y transporte. Las cifras se recalculan cuando actualizamos los datos."
          : "Analysis based on actual SII sales and official hazard, environment and transit sources. Figures are recomputed whenever we update the data."}
      </p>
      <div className="sx-posts">
        {POSTS.map((p) => (
          <article key={p.slug} className="sx-post-card">
            <p className="at-eyebrow">{longDate(l, p.date)} · {p.tags.slice(0, 2).join(" · ")}</p>
            <h2><Link href={`/blog/${p.slug}`}>{p[l].title}</Link></h2>
            <p>{p[l].description}</p>
          </article>
        ))}
      </div>
      <p className="sx-note">
        <Link href="/comunas">{es ? "Fichas de las 32 comunas →" : "Profiles of all 32 comunas →"}</Link>
      </p>
    </section>
  );
}
