import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import Explorer from "@/components/Explorer";
import { pageMeta } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMeta({ locale, path: "/", title: t("title"), description: t("description"), absoluteTitle: true });
}

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return (
    <>
      <h1 className="sx-sr-only">{t("h1")}</h1>
      <Explorer />
    </>
  );
}
