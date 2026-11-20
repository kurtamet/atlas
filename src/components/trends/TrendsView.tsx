"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, METRICS, familyById, metricById } from "@/lib/layers/registry";
import { formatValue } from "@/lib/layers/style";
import { median, FREE_LAYERS, FREE_EDGE, type ComunaRow } from "@/lib/data/comunas";
import { metricValue } from "@/lib/report/input";
import { PercentileStrip } from "@/components/report/charts";
import { RankBars, PriceLines, ChangeBars, Dumbbells, Scatter } from "./charts";
import { Locked } from "./Locked";
import { useAccess, previewQuery } from "@/lib/access";

const REAL = METRICS.filter((m) => !m.demo);

export default function TrendsView() {
  const t = useTranslations();
  const tr = useTranslations("trends");
  const locale = useLocale();
  const [rows, setRows] = useState<ComunaRow[] | null>(null);
  const [metric, setMetric] = useState("EC02");
  const [comuna, setComuna] = useState<string | null>("13120");
  const [xId, setX] = useState("IN01");
  const [yId, setY] = useState("EC02");
  const access = useAccess();
  const [served, setServed] = useState(false);
  // the server decides what we receive: free visitors get no series or extras
  useEffect(() => {
    if (access.loading) return;
    fetch(`/api/trends${previewQuery()}`, { cache: "no-store" }).then((r) => r.json() as Promise<{ subscriber: boolean; rows: ComunaRow[] }>)
      .then((d) => { setRows(d.rows); setServed(d.subscriber); }).catch(() => setRows([]));
  }, [access.loading, access.subscriber]);
  const subscriber = served;

  const m = metricById(metric);
  const ranked = useMemo(() => (rows ?? []).filter((r) => r.values[metric] !== undefined).map((r) => ({ code: r.code, name: r.name, value: r.values[metric] })).sort((a, b) => b.value - a.value), [rows, metric]);
  const sel = rows?.find((r) => r.code === comuna) ?? null;
  const layerLocked = !subscriber && !FREE_LAYERS.has(metric);
  const shownRank = subscriber ? ranked : ranked.map((r, i) => (i < FREE_EDGE || i >= ranked.length - FREE_EDGE || r.code === comuna ? r : { code: `x${i}`, name: "", value: 0, locked: true }));
  const exportCsv = () => {
    const ids = REAL.map((x) => x.id);
    const lines = [["code", "comuna", ...ids].join(","), ...(rows ?? []).map((r) => [r.code, `"${r.name}"`, ...ids.map((id) => r.values[id] ?? "")].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "atlas-comunas.csv";
    a.click();
  };
  if (!rows) return <section className="at-page"><p className="at-lead">{tr("loading")}</p></section>;

  // prices over time: selected comuna vs median of comunas, years with data for most comunas
  const years = Array.from(new Set(rows.flatMap((r) => Object.keys(r.prices?.years ?? {})))).sort().filter((y) => rows.filter((r) => r.prices?.years[y]).length >= rows.length / 2).slice(-9);
  const allMed = years.map((y) => median(rows.map((r) => r.prices?.years[y]?.median).filter((v): v is number => typeof v === "number")));
  const selLine = years.map((y) => sel?.prices?.years[y]?.median ?? null);
  const lastYear = years[years.length - 1];
  const crimeChg = rows.filter((r) => typeof r.extras.RS01_chg === "number").map((r) => ({ code: r.code, name: r.name, value: r.extras.RS01_chg as number })).sort((a, b) => b.value - a.value);
  const hot = rows.filter((r) => r.values.CL01 !== undefined && typeof r.extras.CL01_d === "number").map((r) => ({ code: r.code, name: r.name, now: r.values.CL01, future: r.values.CL01 + (r.extras.CL01_d as number) })).sort((a, b) => b.future - a.future);
  const comunasFc = { features: rows.map((r) => ({ properties: r.values as Record<string, unknown> })) };
  const scatter = rows.filter((r) => r.values[xId] !== undefined && r.values[yId] !== undefined).map((r) => ({ code: r.code, name: r.name, x: r.values[xId], y: r.values[yId] }));
  const metricSelect = (value: string, on: (v: string) => void, label: string) => (
    <label className="tr-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => on(e.target.value)}>
        {FAMILIES.map((f) => (
          <optgroup key={f.id} label={t(`families.${f.id}`)}>
            {REAL.filter((x) => x.family === f.id).map((x) => <option key={x.id} value={x.id}>{t(`metrics.${x.id}`)}{!subscriber && !FREE_LAYERS.has(x.id) ? ` · ${tr("subOnly")}` : ""}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );

  return (
    <div className="tr">
      <header className="tr-head">
        <p className="at-eyebrow">{t("pages.trends.eyebrow")}</p>
        <h1>{t("pages.trends.title")}</h1>
        <p className="at-lead">{tr("lead", { n: rows.length })}</p>
        <div className="tr-filters">
          {metricSelect(metric, setMetric, tr("layer"))}
          <label className="tr-select">
            <span>{tr("comuna")}</span>
            <select value={comuna ?? ""} onChange={(e) => setComuna(e.target.value || null)}>
              {[...rows].sort((a, b) => a.name.localeCompare(b.name, "es")).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <section className="tr-card tr-wide">
        <h2>{tr("rankTitle", { metric: t(`metrics.${metric}`) })}</h2>
        <p className="tr-sub">{m.unit} · {tr("rankSub")}</p>
        {layerLocked ? <Locked rows={10} /> : <RankBars rows={shownRank} color={familyById(m.family).color} selected={comuna} onSelect={setComuna} unit={m.unit} decimals={m.decimals} locale={locale} />}
        {!subscriber && !layerLocked && <p className="tr-note tr-upsell">{tr("rankUpsell", { n: ranked.length - 2 * FREE_EDGE })}</p>}
        <p className="tr-note">{t(`drawer.method_${metric}`)}</p>
      </section>

      {sel && (
        <section className="tr-card tr-tall">
          <h2>{tr("profileTitle", { comuna: sel.name })}</h2>
          <p className="tr-sub">{tr("profileSub")}</p>
          {FAMILIES.map((f) => {
            const ms = REAL.filter((x) => x.family === f.id).map((x) => metricValue(x, undefined, sel.values, null, comunasFc)).filter((v) => v !== null);
            if (!ms.length) return null;
            return (
              <div key={f.id}>
                <p className="tr-fam" style={{ color: f.color }}>{t(`families.${f.id}`)}</p>
                {ms.map((v) => <PercentileStrip key={v!.id} m={v!} label={t(`metrics.${v!.id}`)} valueText={`${formatValue(metricById(v!.id), v!.value, locale)} ${v!.unit}`} />)}
              </div>
            );
          })}
        </section>
      )}

      <section className="tr-card">
        <h2>{tr("priceTitle")}</h2>
        <p className="tr-sub">{tr("priceSub")}</p>
        {!subscriber ? <Locked rows={6} compact /> : <PriceLines years={years} comuna={selLine} all={allMed} comunaName={sel?.name ?? ""} allName={tr("allComunas")} locale={locale} />}
        {subscriber && sel?.prices && lastYear && sel.prices.years[lastYear] && (
          <p className="tr-note">{tr("priceNote", { comuna: sel.name, year: lastYear, n: sel.prices.years[lastYear].n.toLocaleString(locale) })}</p>
        )}
      </section>

      <section className="tr-card">
        <h2>{tr("crimeTitle")}</h2>
        <p className="tr-sub">{tr("crimeSub")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <ChangeBars rows={crimeChg} selected={comuna} worseIfUp unit="%" locale={locale} />}
      </section>

      <section className="tr-card">
        <h2>{tr("heatTitle")}</h2>
        <p className="tr-sub">{tr("heatSub")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <Dumbbells rows={hot} unit={metricById("CL01").unit} locale={locale} nowLabel={tr("heatNow")} futureLabel={tr("heatFuture")} />}
      </section>

      <section className="tr-card tr-wide">
        <h2>{tr("scatterTitle")}</h2>
        <p className="tr-sub">{tr("scatterSub")}</p>
        {!subscriber ? <Locked rows={7} /> : (<>
        <div className="tr-filters">
          {metricSelect(xId, setX, tr("axisX"))}
          {metricSelect(yId, setY, tr("axisY"))}
        </div>
        <Scatter points={scatter} xLabel={`${t(`metrics.${xId}`)} (${metricById(xId).unit})`} yLabel={`${t(`metrics.${yId}`)} (${metricById(yId).unit})`} selected={comuna} onSelect={setComuna} locale={locale} xDec={metricById(xId).decimals} yDec={metricById(yId).decimals} />
        </>)}
      </section>

      <p className="tr-note tr-foot">{tr("foot")} {subscriber && <button type="button" className="at-secondary tr-csv" onClick={exportCsv}>{tr("csv")}</button>}</p>
    </div>
  );
}
