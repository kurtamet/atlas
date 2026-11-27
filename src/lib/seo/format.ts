import type { Locale } from "./site.ts";

export const fmt = (locale: Locale, v: number, decimals = 0) =>
  v.toLocaleString(locale === "en" ? "en-US" : "es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "2024-10-01" → "oct 2024" / "Oct 2024" */
export const monthYear = (locale: Locale, isoDate: string) => `${MONTHS[locale][Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}`;

/** long date for articles */
export const longDate = (locale: Locale, isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-US" : "es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
