import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.account");
  return (
    <section className="at-page">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <p className="at-lead">{t("lead")}</p>
      <p className="at-lead">{t("soon")}</p>
    </section>
  );
}
