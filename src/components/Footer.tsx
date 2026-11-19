"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <footer className="at-footer" data-explore={pathname === "/" ? "true" : undefined}>
      <span>{t("tagline")}</span>
      <div className="at-footer-links">
        <Link href="/methods">{t("methods")}</Link>
        <Link href="/partners">{t("api")}</Link>
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
