/**
 * Site-wide SEO helpers: canonical URLs, hreflang alternates and page metadata.
 * Every public page builds its metadata through pageMeta() so canonical, es/en alternates,
 * Open Graph and Twitter cards stay consistent.
 */
import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.prometeo.land").replace(/\/$/, "");
export const SITE_NAME = "PROMETEO";
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const asLocale = (l: string): Locale => (l === "en" ? "en" : "es");

/** search-engine ownership tokens (public by design); env wins so they can change without a deploy of code */
export const VERIFICATION = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "216ECA4E114A7C86B3F7687F14301021",
};

/** path inside a locale ("/comunas/nunoa") → absolute URL; Spanish is the default locale and has no prefix */
export function localeUrl(locale: string, path: string): string {
  const p = path === "/" ? "" : path;
  return `${SITE_URL}${asLocale(locale) === "es" ? "" : "/en"}${p}` || SITE_URL;
}

export function alternates(locale: string, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localeUrl(locale, path),
    languages: { es: localeUrl("es", path), en: localeUrl("en", path), "x-default": localeUrl("es", path) },
  };
}

interface PageMetaInput {
  locale: string;
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** set false for private pages (account, admin, report) */
  index?: boolean;
  /** title without the " · PROMETEO" suffix (home) */
  absoluteTitle?: boolean;
  /** social card query, e.g. { c: "nunoa" } or { b: "<post slug>" }; default is the site card */
  og?: Record<string, string>;
}

export const ogImage = (locale: string, og: Record<string, string> = {}) => `${SITE_URL}/og?${new URLSearchParams({ l: asLocale(locale), ...og })}`;

export function pageMeta(i: PageMetaInput): Metadata {
  const url = localeUrl(i.locale, i.path);
  const ogLocale = asLocale(i.locale) === "en" ? "en_US" : "es_CL";
  const image = { url: ogImage(i.locale, i.og), width: 1200, height: 630, alt: i.title };
  return {
    title: i.absoluteTitle ? { absolute: i.title } : i.title,
    description: i.description,
    alternates: alternates(i.locale, i.path),
    robots: i.index === false ? { index: false, follow: false } : undefined,
    openGraph: {
      type: i.type ?? "website",
      url,
      siteName: SITE_NAME,
      title: i.title,
      description: i.description,
      locale: ogLocale,
      images: [image],
      alternateLocale: ogLocale === "es_CL" ? ["en_US"] : ["es_CL"],
      ...(i.type === "article" ? { publishedTime: i.publishedTime, modifiedTime: i.modifiedTime ?? i.publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: i.title, description: i.description, images: [image.url] },
  };
}

/** JSON-LD payload as a safe string for <script type="application/ld+json"> */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: SITE_NAME,
  url: SITE_URL,
  email: "hola@prometeo.land",
  logo: `${SITE_URL}/icon.png`,
  areaServed: { "@type": "City", name: "Santiago", containedInPlace: { "@type": "Country", name: "Chile" } },
  description: "Territorial intelligence for real estate in Santiago de Chile: SII transaction prices, official hazards, environment, transit and services for every address.",
};

/** strips accents and punctuation: "Ñuñoa" → "nunoa", "Pedro Aguirre Cerda" → "pedro-aguirre-cerda" */
export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
