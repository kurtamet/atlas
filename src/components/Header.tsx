"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useMe } from "@/lib/access";

const NAV = [
  { href: "/", key: "explore" },
  { href: "/trends", key: "trends" },
  { href: "/partners", key: "partners" },
] as const;

export default function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const { me } = useMe();
  return (
    <>
      <header className="at-header">
        <Link href="/" className="at-wordmark" aria-label="Atlas Chile">
          <strong>ATLAS</strong>
          <div className="at-brand-rule" />
          <span>CHILE</span>
        </Link>
        <nav className="at-nav" aria-label={t("nav.label")}>
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
              {t(`nav.${n.key}`)}
            </Link>
          ))}
        </nav>
        <Link href="/account" className="at-account" aria-current={pathname === "/account" ? "page" : undefined}>
          <span className="at-account-label">{me && !me.email && me.configured ? t("nav.signIn") : t("nav.account")}</span>
        </Link>
      </header>
      <div className="at-note">
        <span>{t("note.left")}</span>
        <span>{t("note.right")}</span>
      </div>
    </>
  );
}
