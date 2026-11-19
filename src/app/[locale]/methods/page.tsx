import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function MethodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.methods");
  return (
    <section className="at-page">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <p className="at-lead">{t("lead")}</p>
      <div className="at-methods">
        {(["a", "b", "c", "d"] as const).map((k) => (
          <article key={k}>
            <h2>{t(k)}</h2>
            <p>{t(`${k}Text`)}</p>
          </article>
        ))}
      </div>
      <Link href="/" className="at-secondary" style={{ display: "inline-block", marginTop: 30 }}>
        {t("back")}
      </Link>
    </section>
  );
}
