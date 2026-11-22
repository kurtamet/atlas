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
    const q = new URLSearchParams(window.location.search);
    const saved = q.get("saved");
    if (saved) {
      // a report kept in the account
      fetch(`/api/reports/${saved}`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<StoredReport>) : null)).then(setRep).catch(() => setRep(null));
      return;
    }
    const id = q.get("id") ?? "";
    const load = () => setRep(readReport(id));
    load();
    const onStorage = (e: StorageEvent) => e.key === storageKey(id) && load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // the browser names the saved PDF after the page title: use the object's address (e.g. "San Juan 7163")
  const title = rep?.input.object.title;
  useEffect(() => {
    if (!title) return;
    // Next's metadata may set the title again after hydration: keep ours
    const keep = () => { if (document.title !== title) document.title = title; };
    keep();
    const el = document.querySelector("title");
    const mo = el ? new MutationObserver(keep) : null;
    if (el) mo!.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo?.disconnect();
  }, [title]);

  if (rep === undefined) return null;
  if (rep === null) return <section className="at-page"><h1>{d("notFound")}</h1><p className="at-lead">{d("notFoundText")}</p></section>;
  return (
    <div className="rd-wrap">
      <div className="rd-toolbar">
        <span>{rep.ai ? d("ready") : rep.error ? d("failed") : d("generating")}{rep.ai && rep.savedId ? ` · ${d("savedToAccount")}` : ""}</span>
        {rep.ai && <button type="button" className="at-primary" onClick={() => { if (title) document.title = title; window.print(); }}>{d("pdf")}</button>}
      </div>
      {rep.ai && rep.source ? <ReportDocument input={rep.input} ai={rep.ai} source={rep.source} /> : (
        <div className="rd-wait"><div className="rd-spinner" /><p>{rep.error ? d("failedText") : d("generatingText")}</p></div>
      )}
    </div>
  );
}
