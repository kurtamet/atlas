import { Fragment, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LEGAL_TEXT } from "@/lib/legal/content";
import { LEGAL_DOCS, LEGAL_UPDATED, LEGAL_VERSION, OPERATOR, isLegalDoc } from "@/lib/legal/operator";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_DOCS.map((doc) => ({ locale, doc })));
}

const lang = (l: string) => (l === "en" ? "en" : "es");

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  if (!isLegalDoc(doc)) return {};
  const d = LEGAL_TEXT[lang(locale)][doc];
  return { title: `${d.title} · PROMETEO`, description: fillText(d.summary) };
}

const TOKENS: Record<string, string> = { name: OPERATOR.name, rut: OPERATOR.rut, address: OPERATOR.address, email: OPERATOR.email, site: OPERATOR.site };
const fillText = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => TOKENS[k] ?? m);

/** fills {tokens}; the e-mail becomes a link and unfilled [placeholders] are highlighted */
function fill(s: string): ReactNode {
  return s.split(/(\{\w+\})/g).map((part, i) => {
    const k = /^\{(\w+)\}$/.exec(part)?.[1];
    if (!k || !(k in TOKENS)) return <Fragment key={i}>{part}</Fragment>;
    const v = TOKENS[k];
    if (k === "email") return <a key={i} href={`mailto:${v}`}>{v}</a>;
    return v.includes("[") ? <mark key={i} className="lg-ph">{v}</mark> : <Fragment key={i}>{v}</Fragment>;
  });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const l = lang(locale);
  const d = LEGAL_TEXT[l][doc];
  return (
    <section className="at-page lg">
      <nav className="lg-tabs" aria-label={t("eyebrow")}>
        {LEGAL_DOCS.map((k) => (
          <Link key={k} href={`/legal/${k}`} aria-current={k === doc ? "page" : undefined}>{t(`tab_${k}`)}</Link>
        ))}
      </nav>
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{d.title}</h1>
      <p className="lg-meta">{t("updated", { date: LEGAL_UPDATED[l], version: LEGAL_VERSION })}</p>
      <p className="lg-beta">{t("beta")}</p>
      <p className="at-lead">{fill(d.summary)}</p>
      <div className="lg-body">
        {d.sections.map((s) => (
          <article key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((p, i) =>
              Array.isArray(p)
                ? <ul key={i}>{p.map((li, j) => <li key={j}>{fill(li)}</li>)}</ul>
                : <p key={i}>{fill(p)}</p>,
            )}
          </article>
        ))}
      </div>
      <p className="lg-contact">{t("contact")} <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a></p>
    </section>
  );
}
