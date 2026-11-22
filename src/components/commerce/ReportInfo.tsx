"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Modal from "./Modal";
import { RETAIL_CLP, formatClp } from "@/lib/commerce/plans";

const ITEMS = ["verdict", "scores", "risks", "price", "hazards", "walk", "audiences", "checks"] as const;

/** what the paid report is, what is inside, and a sample */
export function ReportInfoModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reportInfo");
  const locale = useLocale();
  const sample = `/${locale === "en" ? "en/" : ""}report?sample=1`;
  return (
    <Modal onClose={onClose} label={t("title")} wide>
      <div className="pm-info">
        <div>
          <span className="at-eyebrow">{t("eyebrow")}</span>
          <h2>{t("title")}</h2>
          <p className="pm-lead">{t("lead")}</p>
          <ul className="pm-checks">
            {ITEMS.map((k) => <li key={k}><b>{t(`i_${k}`)}</b> {t(`d_${k}`)}</li>)}
          </ul>
          <p className="pm-fine">{t("sources")}</p>
          <p className="pm-fine">{t("limits")}</p>
        </div>
        <aside className="pm-sample">
          <a href={sample} target="_blank" rel="noreferrer" className="pm-sample-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/sample/report-p1-${locale === "en" ? "en" : "es"}.png`} alt={t("sampleAlt")} loading="lazy" />
          </a>
          <a href={sample} target="_blank" rel="noreferrer" className="at-secondary pm-block">{t("sampleCta")}</a>
          <p className="pm-fine">{t("price", { price: formatClp(RETAIL_CLP, locale) })}</p>
        </aside>
      </div>
    </Modal>
  );
}

/** the "?" next to every report offer */
export function ReportInfoButton({ className = "" }: { className?: string }) {
  const t = useTranslations("reportInfo");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`pm-q ${className}`} aria-label={t("what")} title={t("what")} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>?</button>
      {open && <ReportInfoModal onClose={() => setOpen(false)} />}
    </>
  );
}
