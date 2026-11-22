"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PACKS, PLANS, RETAIL_CLP, formatClp, perReport, unlimitedBreakEven, type ProductId } from "@/lib/commerce/plans";
import { startCheckout, type CheckoutError } from "./checkout";
import { ReportInfoButton } from "./ReportInfo";
import { useMe } from "@/lib/access";

const FAQ = ["account", "cancel", "unused", "single", "pay", "data"] as const;

export default function Pricing() {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const { me } = useMe();
  const [busy, setBusy] = useState<ProductId | null>(null);
  const [err, setErr] = useState<CheckoutError | null>(null);
  const fmt = (n: number) => formatClp(n, locale);
  const buy = async (p: ProductId) => {
    setBusy(p);
    setErr(null);
    const e = await startCheckout(p, locale);
    if (e) { setErr(e); setBusy(null); }
  };

  return (
    <section className="at-page pr">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <p className="at-lead">{t("lead")}</p>
      {err && <p className="ac-error">{t(`err_${err}`)}</p>}

      <h2 className="pr-h">{t("plansTitle")}</h2>
      <p className="pr-sub">{t("plansSub")}</p>
      <div className="pr-grid">
        {PLANS.map((p) => {
          const s = p.reports ? perReport(p.clp, p.reports) : null;
          const current = me?.plan === p.id;
          return (
            <article key={p.id} className={p.id === "partner" ? "pr-card pr-featured" : "pr-card"}>
              {p.id === "partner" && <span className="pr-badge">{t("popular")}</span>}
              <h3>{t(`plan_${p.id}`)}</h3>
              <p className="pr-for">{t(`planFor_${p.id}`)}</p>
              <p className="pr-price"><b>{fmt(p.clp)}</b><span>{t("perMonth")}</span></p>
              <p className="pr-save-line">
                {s ? <><span className="pm-save">−{s.savePct}%</span> {t("planSave", { each: fmt(s.each), n: p.reports!, value: fmt(p.reports! * RETAIL_CLP) })}</> : <><span className="pm-save">∞</span> {t("unlimitedSave", { n: unlimitedBreakEven() })}</>}
              </p>
              <ul className="pr-list">
                <li>{p.reports ? t("fReports", { n: p.reports }) : t("fUnlimited")}</li>
                <li>{t("fTrends")}</li>
                <li>{t("fCompare")}</li>
                <li>{t("fCsv")}</li>
                <li>{t("fAccount")}</li>
              </ul>
              {current
                ? <Link href="/account" className="at-secondary pm-block">{t("currentPlan")}</Link>
                : <button type="button" className={p.id === "partner" ? "at-primary pm-block" : "at-secondary pm-block"} disabled={busy !== null} onClick={() => buy(p.id)}>{busy === p.id ? t("redirecting") : me?.plan ? t("switch") : t("subscribe")}</button>}
            </article>
          );
        })}
      </div>
      <p className="pr-note">{t("plansNote")}</p>

      <h2 className="pr-h" id="packs">{t("packsTitle")}</h2>
      <p className="pr-sub">{t("packsSub")}</p>
      <div className="pr-grid">
        {PACKS.map((p) => {
          const s = perReport(p.clp, p.credits);
          return (
            <article key={p.id} className="pr-card pr-pack">
              <h3>{t("packName", { n: p.credits })}</h3>
              <p className="pr-price"><b>{fmt(p.clp)}</b><span>{t("oneTime")}</span></p>
              <p className="pr-save-line"><span className="pm-save">−{s.savePct}%</span> {t("packSave", { each: fmt(s.each), save: fmt(s.saveClp) })}</p>
              <button type="button" className="at-secondary pm-block" disabled={busy !== null} onClick={() => buy(p.id)}>{busy === p.id ? t("redirecting") : t("buy")}</button>
            </article>
          );
        })}
      </div>
      <p className="pr-note">{t("plansBetter")}</p>

      <div className="pr-single">
        <div>
          <b>{t("singleTitle", { price: fmt(RETAIL_CLP) })}</b> <ReportInfoButton />
          <p>{t("singleText")}</p>
        </div>
        <Link href="/" className="at-secondary">{t("singleCta")}</Link>
      </div>

      <div className="pr-why">
        <div>
          <h2 className="pr-h">{t("whyTitle")}</h2>
          <p>{t("why1")}</p>
          <p>{t("why2")}</p>
          <p>{t("why3")}</p>
        </div>
        <div className="pr-faq">
          <h2 className="pr-h">{t("faqTitle")}</h2>
          {FAQ.map((k) => (
            <details key={k}>
              <summary>{t(`q_${k}`)}</summary>
              <p>{t(`a_${k}`)}</p>
            </details>
          ))}
        </div>
      </div>
      <p className="pr-note">{t("legal")}</p>
    </section>
  );
}
