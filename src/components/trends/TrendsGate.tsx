"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import TrendsView from "./TrendsView";
import { PLANS, formatClp } from "@/lib/commerce/plans";

interface Status { plan: boolean; previewEndsAt: string | null; previewUsed: boolean }

/**
 * Timed preview around the trends section: asks the server for the preview state first (which starts
 * the 5-minute window), shows a countdown, and remounts TrendsView when the window closes so it
 * fetches the free view. The server decides what data is sent; this only draws the banner.
 */
export default function TrendsGate() {
  const t = useTranslations("trendsGate");
  const locale = useLocale();
  const [st, setSt] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [round, setRound] = useState(0);

  useEffect(() => {
    fetch("/api/trends?status=1", { cache: "no-store" }).then((r) => r.json() as Promise<Status>).then(setSt)
      .catch(() => setSt({ plan: false, previewEndsAt: null, previewUsed: false }));
  }, []);
  const ends = st?.previewEndsAt ? Date.parse(st.previewEndsAt) : null;
  useEffect(() => {
    if (!ends) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= ends) {
        clearInterval(id);
        setSt((s) => (s ? { ...s, previewEndsAt: null, previewUsed: true } : s));
        setRound((r) => r + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ends]);

  if (!st) return <section className="at-page"><p className="at-lead">…</p></section>;
  const left = ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : 0;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const from = formatClp(PLANS[0].clp, locale);
  return (
    <>
      {!st.plan && ends && (
        <div className="tg-bar" role="status">
          <span><b className="tg-clock">{mmss}</b> {t("previewOn")}</span>
          <Link href="/pricing" className="at-secondary">{t("plans", { from })}</Link>
        </div>
      )}
      {!st.plan && st.previewUsed && (
        <div className="tg-bar tg-ended" role="status">
          <span><b>{t("endedTitle")}</b> {t("endedText", { from })}</span>
          <Link href="/pricing" className="at-primary">{t("subscribe")}</Link>
        </div>
      )}
      <TrendsView key={round} />
    </>
  );
}
