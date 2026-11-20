"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ReportDocument from "./ReportDocument";
import { readReport, storageKey, type StoredReport } from "@/lib/report/client";

/** report tab: waits for the generation started in the map tab, then renders the template */
export default function ReportView() {
  const d = useTranslations("reportDoc");
  const [rep, setRep] = useState<StoredReport | null | undefined>(undefined);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    const load = () => setRep(readReport(id));
    load();
    const onStorage = (e: StorageEvent) => e.key === storageKey(id) && load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (rep === undefined) return null;
  if (rep === null) return <section className="at-page"><h1>{d("notFound")}</h1><p className="at-lead">{d("notFoundText")}</p></section>;
  return (
    <div className="rd-wrap">
      <div className="rd-toolbar">
        <span>{rep.ai ? d("ready") : rep.error ? d("failed") : d("generating")}</span>
        {rep.ai && <button type="button" className="at-primary" onClick={() => window.print()}>{d("pdf")}</button>}
      </div>
      {rep.ai && rep.source ? <ReportDocument input={rep.input} ai={rep.ai} source={rep.source} /> : (
        <div className="rd-wait"><div className="rd-spinner" /><p>{rep.error ? d("failedText") : d("generatingText")}</p></div>
      )}
    </div>
  );
}
