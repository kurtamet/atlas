import { setRequestLocale } from "next-intl/server";
import ReportView from "@/components/report/ReportView";
import { pageMeta } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMeta({ locale, path: "/report", title: "PROMETEO", description: "", index: false, absoluteTitle: true });
}

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportView />;
}
