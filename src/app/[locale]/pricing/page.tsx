import { getTranslations, setRequestLocale } from "next-intl/server";
import Pricing from "@/components/commerce/Pricing";
import { pageMeta } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return pageMeta({ locale, path: "/pricing", title: t("metaTitle"), description: t("lead") });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Pricing />;
}
