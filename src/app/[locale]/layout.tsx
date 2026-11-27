import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ORGANIZATION, SITE_NAME, SITE_URL, VERIFICATION, asLocale, ldJson, localeUrl } from "@/lib/seo/site";
import "../concept.css";
import "../app.css";
import "../seo.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s · ${SITE_NAME}` },
    description: t("description"),
    applicationName: SITE_NAME,
    icons: { icon: "/favicon.ico", apple: "/icon.png" },
    openGraph: { siteName: SITE_NAME, type: "website", locale: asLocale(locale) === "en" ? "en_US" : "es_CL" },
    twitter: { card: "summary_large_image" },
    verification: {
      ...(VERIFICATION.google ? { google: VERIFICATION.google } : {}),
      ...(VERIFICATION.bing ? { other: { "msvalidate.01": VERIFICATION.bing } } : {}),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION,
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: localeUrl(locale, "/"),
        name: SITE_NAME,
        description: t("description"),
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#org` },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${localeUrl(locale, "/")}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
    ],
  };

  return (
    <html lang={locale === "es" ? "es-CL" : "en"}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
        <NextIntlClientProvider>
          <div className="atlas-root">
            <div className="at-app">
              <Header />
              <main>{children}</main>
              <Footer />
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
