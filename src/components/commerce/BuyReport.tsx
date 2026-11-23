"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Modal from "./Modal";
import Consent from "./Consent";
import { ReportInfoButton } from "./ReportInfo";
import { startCheckout, type CheckoutError } from "./checkout";
import { useMe, refreshMe } from "@/lib/access";
import { requestReport } from "@/lib/report/client";
import { PACKS, PLANS, RETAIL_CLP, formatClp, perReport } from "@/lib/commerce/plans";
import type { ReportInput } from "@/lib/report/input";

/**
 * The step between "get the full report" and the report: uses what the user already has
 * (plan allowance, pack credit) or sells one report on the spot, without an account.
 */
export default function BuyReport({ title, makeInput, onClose, unitSlot }: { title: string; makeInput: () => ReportInput | null; onClose: () => void; unitSlot?: React.ReactNode }) {
  const t = useTranslations("buy");
  const locale = useLocale();
  const { me } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<CheckoutError | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [missing, setMissing] = useState(false);
  const fmt = (n: number) => formatClp(n, locale);
  const bestPack = PACKS[0];
  const cheapestPlan = PLANS[0];

  const generate = () => {
    const input = makeInput();
    if (!input) return;
    requestReport(input, locale);
    setTimeout(() => void refreshMe(), 4000);
    onClose();
  };
  const buySingle = async () => {
    if (!agreed) { setMissing(true); return; }
    const input = makeInput();
    if (!input) return;
    setBusy(true);
    setErr(null);
    const e = await startCheckout("single", locale, { input, title });
    if (e === "not_configured") { generate(); return; } // payments not live yet (local preview): open report as before
    if (e) { setErr(e); setBusy(false); }
  };

  const paid = Boolean(me?.canReport) || (me !== null && !me.configured);
  const source = me?.role === "admin" ? t("viaAdmin")
    : me?.plan && (me.planReportsLeft === null || me.planReportsLeft > 0) ? (me.planReportsLeft === null ? t("viaUnlimited") : t("viaPlan", { n: me.planReportsLeft }))
    : me && me.credits > 0 ? t("viaCredits", { n: me.credits }) : "";

  return (
    <Modal onClose={onClose} label={t("title")}>
      <div className="pm-buy">
        <span className="at-eyebrow">{t("eyebrow")} <ReportInfoButton /></span>
        <h2>{title}</h2>
        {unitSlot}
        {paid ? (
          <>
            <p className="pm-lead">{source || t("ready")}</p>
            <button type="button" className="at-primary pm-block" onClick={generate}>{t("generate")}</button>
          </>
        ) : (
          <>
            <p className="pm-lead">{t("lead")}</p>
            <div className="pm-offer pm-offer-main">
              <div>
                <b>{t("single")}</b>
                <small>{t("singleNote")}</small>
              </div>
              <button type="button" className="at-primary" disabled={busy} onClick={buySingle}>{busy ? t("redirecting") : t("pay", { price: fmt(RETAIL_CLP) })}</button>
            </div>
            <Consent kind="single" checked={agreed} missing={missing} onChange={setAgreed} />
            {err && <p className="ac-error">{t(`err_${err}`)}</p>}
            <p className="pm-or">{t("or")}</p>
            <Link href="/pricing" className="pm-offer">
              <div>
                <b>{t("plansTitle", { price: fmt(cheapestPlan.clp) })}</b>
                <small>{t("plansNote", { each: fmt(perReport(cheapestPlan.clp, cheapestPlan.reports!).each) })}</small>
              </div>
              <span className="pm-save">−{perReport(cheapestPlan.clp, cheapestPlan.reports!).savePct}%</span>
            </Link>
            <Link href="/pricing#packs" className="pm-offer">
              <div>
                <b>{t("packsTitle", { n: bestPack.credits, price: fmt(bestPack.clp) })}</b>
                <small>{t("packsNote", { each: fmt(perReport(PACKS[2].clp, PACKS[2].credits).each) })}</small>
              </div>
              <span className="pm-save">{t("upTo", { pct: perReport(PACKS[2].clp, PACKS[2].credits).savePct })}</span>
            </Link>
            {me && !me.email && me.configured && <p className="pm-fine">{t("haveAccount")} <Link href="/account">{t("signIn")}</Link></p>}
          </>
        )}
        <p className="pm-fine">{t("trust")}</p>
      </div>
    </Modal>
  );
}
