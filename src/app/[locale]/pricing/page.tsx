import { getTranslations, setRequestLocale } from "next-intl/server";
import Pricing from "@/components/commerce/Pricing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: `${t("metaTitle")} · PROMETEO`, description: t("lead") };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Pricing />;
}
