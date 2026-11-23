"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { OPERATOR } from "@/lib/legal/operator";

export default function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <footer className="at-footer" data-explore={pathname === "/" ? "true" : undefined}>
      <span>{t("tagline")} · © {new Date().getFullYear()} {OPERATOR.name}</span>
      <div className="at-footer-links">
        <Link href="/methods">{t("methods")}</Link>
        <Link href="/partners">{t("api")}</Link>
        <Link href="/legal/terms">{t("terms")}</Link>
        <Link href="/legal/privacy">{t("privacy")}</Link>
        <Link href="/legal/refunds">{t("refunds")}</Link>
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        <span aria-label={t("language")} className="at-lang">
          {routing.locales.map((l) => (
            <Link key={l} href={pathname} locale={l} aria-current={l === locale ? "true" : undefined}>
              {l.toUpperCase()}
            </Link>
          ))}
        </span>
      </div>
    </footer>
  );
}
