import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OPERATOR } from "@/lib/legal/operator";
import { FAMILIES as FAMILY_LIST } from "@/lib/layers/registry";

const STATS = ["1", "2", "3", "4"] as const;
const HOW = ["how1", "how2", "how3"] as const;
const FAMILY_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const FAMILIES = FAMILY_KEYS.map((k, i) => [k, FAMILY_LIST[i].color] as const);
const UNIT = ["u1", "u2", "u3", "u4", "u5"] as const;
const METHOD = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;
const FOR = ["for1", "for2", "for3"] as const;
const ROAD = ["r1", "r2", "r3", "r4"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.about" });
  return { title: `${t("eyebrow")}`, description: t("lead") };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.about");
  return (
    <section className="at-page at-about">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <p className="at-lead">{t("lead")}</p>

      <div className="at-about-stats">
        {STATS.map((k) => (
          <div key={k}>
            <strong>{t(`stats.n${k}`)}</strong>
            <span>{t(`stats.s${k}`)}</span>
          </div>
        ))}
      </div>

      <div className="at-about-block">
        <h2>{t("problemTitle")}</h2>
        <p>{t("problemText")}</p>
      </div>

      <div className="at-about-block">
        <h2>{t("howTitle")}</h2>
        <div className="at-partners">
          {HOW.map((k, i) => (
            <article className="at-partner" key={k}>
              <span className="at-eyebrow">0{i + 1}</span>
              <h3>{t(k)}</h3>
              <p>{t(`${k}Text`)}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="at-about-block at-about-new">
        <h2>{t("unitTitle")}</h2>
        <p>{t("unitLead")}</p>
        <ul className="at-about-list">
          {UNIT.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <p className="at-about-note">{t("uStats")}</p>
      </div>

      <div className="at-about-block">
        <h2>{t("layersTitle")}</h2>
        <p>{t("layersLead")}</p>
        <ul className="at-about-families">
          {FAMILIES.map(([k, c]) => (
            <li key={k}>
              <i style={{ background: c }} />
              <b>{t(k)}</b>
              <span>{t(`${k}Text`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="at-about-block">
        <h2>{t("methodTitle")}</h2>
        <ul className="at-about-list">
          {METHOD.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <Link href="/methods" className="at-about-link">{t("methodLink")} →</Link>
      </div>

      <div className="at-about-block">
        <h2>{t("forTitle")}</h2>
        <div className="at-partners">
          {FOR.map((k) => (
            <article className="at-partner" key={k}>
              <h3>{t(k)}</h3>
              <p>{t(`${k}Text`)}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="at-about-block">
        <h2>{t("roadTitle")}</h2>
        <ol className="at-about-road">
          {ROAD.map((k) => (
            <li key={k}>
              <span className="at-eyebrow">{t(k)}</span>
              <p>{t(`${k}Text`)}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="at-about-cta">
        <Link href="/" className="at-primary">{t("ctaMap")}</Link>
        <Link href="/trends" className="at-secondary">{t("ctaTrends")}</Link>
        <a href={`mailto:${OPERATOR.email}`} className="at-secondary">{t("ctaContact")}</a>
      </div>
      <p className="at-about-op">{t("operator", { name: OPERATOR.name })}</p>
    </section>
  );
}
