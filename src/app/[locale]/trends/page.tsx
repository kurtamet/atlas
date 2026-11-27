import { setRequestLocale } from "next-intl/server";
import TrendsGate from "@/components/trends/TrendsGate";
import { pageMeta, asLocale } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const es = asLocale(locale) === "es";
  return pageMeta({
    locale,
    path: "/trends",
    title: es ? "Datos y tendencias por comuna: precios, seguridad, entorno" : "Data and trends by comuna: prices, safety, environment",
    description: es
      ? "Compara las 32 comunas del Gran Santiago en precios de compraventa, transporte, ruido, vegetación, riesgos y seguridad, y mira su evolución en el tiempo."
      : "Compare the 32 Greater Santiago comunas on sale prices, transit, noise, vegetation, hazards and safety, and see how they change over time.",
  });
}

export default async function TrendsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrendsGate />;
}
