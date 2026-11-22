"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ReportDocument from "./ReportDocument";
import { readReport, storageKey, type StoredReport } from "@/lib/report/client";
import { useMe } from "@/lib/access";

/**
 * Report tab. Four ways in: a generation started in the map tab (?id, via localStorage),
 * a report kept in the account (?saved), a single purchase (?order&session_id, paid through Stripe),
 * and the public sample (?sample=1).
 */
export default function ReportView() {
  const d = useTranslations("reportDoc");
  const b = useTranslations("buy");
  const locale = useLocale();
  const { me } = useMe();
  const [rep, setRep] = useState<StoredReport | null | undefined>(undefined);
  const [mode, setMode] = useState<"local" | "saved" | "order" | "sample">("local");
  const [link, setLink] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const saved = q.get("saved");
    const order = q.get("order");
    const session = q.get("session_id");
    if (q.get("sample") === "1") {
      setMode("sample");
      fetch(`/sample/report-${locale === "en" ? "en" : "es"}.json`).then((r) => (r.ok ? (r.json() as Promise<StoredReport>) : null)).then(setRep).catch(() => setRep(null));
      return;
    }
    if (saved) {
      setMode("saved");
      fetch(`/api/reports/${saved}`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<StoredReport>) : null)).then(setRep).catch(() => setRep(null));
      return;
    }
    if (order && session) {
      setMode("order");
      setLink(window.location.href);
      let live = true;
      let timer: ReturnType<typeof setTimeout>;
      const poll = (n: number) => {
        fetch("/api/report/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order, session }) })
          .then(async (r) => {
            if (!live) return;
            if (r.status === 202 || r.status === 402) {
              // generating in another tab, or the payment is still being confirmed
              setRep((p) => p ?? ({ input: null, pending: r.status } as unknown as StoredReport));
              if (n < 60) timer = setTimeout(() => poll(n + 1), 4000);
              else setRep({ input: null, error: String(r.status) } as unknown as StoredReport);
              return;
            }
            if (!r.ok) { setRep(null); return; }
            setRep((await r.json()) as StoredReport);
          })
          .catch(() => live && setRep({ input: null, error: "network" } as unknown as StoredReport));
      };
      setRep({ input: null } as unknown as StoredReport);
      poll(0);
      return () => { live = false; clearTimeout(timer); };
    }
    const id = q.get("id") ?? "";
    const load = () => setRep(readReport(id));
    load();
    const onStorage = (e: StorageEvent) => e.key === storageKey(id) && load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [locale]);

  // the browser names the saved PDF after the page title: use the object's address (e.g. "San Juan 7163")
  const title = rep?.input?.object?.title;
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
  if (rep === null) return <section className="at-page"><h1>{d("notFound")}</h1><p className="at-lead">{d(mode === "local" ? "notFoundText" : "notFoundLink")}</p></section>;
  const payment = rep.error === "payment";
  const waitText = rep.error ? (payment ? b("paymentRequired") : mode === "order" ? b("orderFailed") : d("failedText")) : mode === "order" ? b("orderGenerating") : d("generatingText");
  const ready = Boolean(rep.ai && rep.source);
  return (
    <div className="rd-wrap">
      <div className="rd-toolbar">
        <span>{mode === "sample" ? b("sampleBadge") : ready ? d("ready") : rep.error ? d("failed") : d("generating")}{ready && rep.savedId && me?.email ? ` · ${d("savedToAccount")}` : ""}</span>
        {ready && <button type="button" className="at-primary" onClick={() => { if (title) document.title = title; window.print(); }}>{d("pdf")}</button>}
      </div>
      {mode === "sample" && (
        <div className="rd-banner">
          <span>{b("sampleText")}</span>
          <Link href="/pricing" className="at-primary">{b("samplePricing")}</Link>
        </div>
      )}
      {mode === "order" && ready && !me?.email && (
        <div className="rd-banner">
          <span>{b("orderKeep")}</span>
          <button type="button" className="at-secondary" onClick={() => void navigator.clipboard?.writeText(link)}>{b("copyLink")}</button>
          <Link href="/account" className="at-secondary">{b("orderAccount")}</Link>
        </div>
      )}
      {ready ? <ReportDocument input={rep.input} ai={rep.ai!} source={rep.source!} /> : (
        <div className="rd-wait">
          {!rep.error && <div className="rd-spinner" />}
          <p>{waitText}</p>
          {payment && <Link href="/pricing" className="at-primary">{b("seePricing")}</Link>}
        </div>
      )}
    </div>
  );
}
