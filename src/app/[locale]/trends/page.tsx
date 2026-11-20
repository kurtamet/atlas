import { setRequestLocale } from "next-intl/server";
import TrendsView from "@/components/trends/TrendsView";

export default async function TrendsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrendsView />;
}
