import { setRequestLocale } from "next-intl/server";
import TrendsGate from "@/components/trends/TrendsGate";

export default async function TrendsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrendsGate />;
}
