import { getTranslations, setRequestLocale } from "next-intl/server";

const BLOCKS = [
  ["portals", "portalsTitle", "portalsText"],
  ["agencies", "agenciesTitle", "agenciesText"],
  ["public", "publicTitle", "publicText"],
] as const;

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.partners");
  return (
    <section className="at-page">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <p className="at-lead">{t("lead")}</p>
      <div className="at-partners">
        {BLOCKS.map(([e, h, p]) => (
          <article className="at-partner" key={e}>
            <span className="at-eyebrow">{t(e)}</span>
            <h2>{t(h)}</h2>
            <p>{t(p)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
