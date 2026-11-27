import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { POSTS, postBySlug } from "@/content/blog";
import Markdown from "@/components/blog/Markdown";
import { loadDataset } from "@/lib/seo/comunas";
import { asLocale, ldJson, localeUrl, ogImage, pageMeta, SITE_URL } from "@/lib/seo/site";
import { longDate } from "@/lib/seo/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => POSTS.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const p = postBySlug(slug);
  if (!p) return {};
  const t = p[asLocale(locale)];
  return pageMeta({ locale, path: `/blog/${slug}`, title: t.title, description: t.description, type: "article", publishedTime: p.date, modifiedTime: p.updated, og: { b: slug } });
}

export default async function BlogPost({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  setRequestLocale(raw);
  const l = asLocale(raw);
  const es = l === "es";
  const p = postBySlug(slug);
  if (!p) notFound();
  const t = p[l];
  const ds = await loadDataset();
  const url = localeUrl(l, `/blog/${slug}`);
  const others = POSTS.filter((x) => x.slug !== slug).slice(0, 4);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: t.title,
        description: t.description,
        url,
        mainEntityOfPage: url,
        inLanguage: l,
        datePublished: p.date,
        dateModified: p.updated ?? p.date,
        keywords: p.tags.join(", "),
        author: { "@type": "Organization", name: "PROMETEO", url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#org` },
        image: ogImage(l, { b: slug }),
        isBasedOn: ["https://www.sii.cl", "https://www.minvu.gob.cl", "https://mma.gob.cl", "https://www.dtpm.cl"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PROMETEO", item: localeUrl(l, "/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: localeUrl(l, "/blog") },
          { "@type": "ListItem", position: 3, name: t.title, item: url },
        ],
      },
    ],
  };
  return (
    <article className="at-page sx-page sx-article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <nav className="sx-crumbs" aria-label={es ? "Ruta" : "Breadcrumb"}>
        <Link href="/">PROMETEO</Link> / <Link href="/blog">Blog</Link>
      </nav>
      <p className="at-eyebrow">
        <time dateTime={p.date}>{longDate(l, p.date)}</time> · {es ? "Equipo PROMETEO" : "PROMETEO team"}
      </p>
      <h1>{t.title}</h1>
      <p className="at-lead">{t.description}</p>
      <div className="sx-body">
        <Markdown source={t.body} ds={ds} l={l} />
      </div>
      <section className="sx-section">
        <h2>{es ? "Sigue leyendo" : "Keep reading"}</h2>
        <ul className="sx-links">
          {others.map((o) => (
            <li key={o.slug}><Link href={`/blog/${o.slug}`}>{o[l].title}</Link></li>
          ))}
          <li><Link href="/comunas">{es ? "Fichas de las 32 comunas del Gran Santiago" : "Profiles of all 32 Greater Santiago comunas"}</Link></li>
        </ul>
      </section>
      <p className="sx-muted sx-note">
        {es
          ? "Cita libremente estas cifras mencionando a PROMETEO (prometeo.land) como fuente. Para prensa y datos a medida: "
          : "Feel free to quote these figures citing PROMETEO (prometeo.land) as the source. Press and custom data: "}
        <a href="mailto:hola@prometeo.land">hola@prometeo.land</a>
      </p>
    </article>
  );
}
