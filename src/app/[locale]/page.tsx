import { setRequestLocale } from "next-intl/server";
import Explorer from "@/components/Explorer";

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Explorer />;
}
