"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, METRICS, familyById, metricById } from "@/lib/layers/registry";
import { formatValue } from "@/lib/layers/style";
import { loadComunaTable, median, type ComunaRow } from "@/lib/data/comunas";
import { metricValue } from "@/lib/report/input";
import { PercentileStrip } from "@/components/report/charts";
import { RankBars, PriceLines, ChangeBars, Dumbbells, Scatter } from "./charts";

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
  useEffect(() => { loadComunaTable().then(setRows).catch(() => setRows([])); }, []);

  const m = metricById(metric);
  const ranked = useMemo(() => (rows ?? []).filter((r) => r.values[metric] !== undefined).map((r) => ({ code: r.code, name: r.name, value: r.values[metric] })).sort((a, b) => b.value - a.value), [rows, metric]);
  const sel = rows?.find((r) => r.code === comuna) ?? null;
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
            {REAL.filter((x) => x.family === f.id).map((x) => <option key={x.id} value={x.id}>{t(`metrics.${x.id}`)}</option>)}
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
        <RankBars rows={ranked} color={familyById(m.family).color} selected={comuna} onSelect={setComuna} unit={m.unit} decimals={m.decimals} locale={locale} />
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
        <PriceLines years={years} comuna={selLine} all={allMed} comunaName={sel?.name ?? ""} allName={tr("allComunas")} locale={locale} />
        {sel?.prices && lastYear && sel.prices.years[lastYear] && (
          <p className="tr-note">{tr("priceNote", { comuna: sel.name, year: lastYear, n: sel.prices.years[lastYear].n.toLocaleString(locale) })}</p>
        )}
      </section>

      <section className="tr-card">
        <h2>{tr("crimeTitle")}</h2>
        <p className="tr-sub">{tr("crimeSub")}</p>
        <ChangeBars rows={crimeChg} selected={comuna} worseIfUp unit="%" locale={locale} />
      </section>

      <section className="tr-card">
        <h2>{tr("heatTitle")}</h2>
        <p className="tr-sub">{tr("heatSub")}</p>
        <Dumbbells rows={hot} unit={metricById("CL01").unit} locale={locale} nowLabel={tr("heatNow")} futureLabel={tr("heatFuture")} />
      </section>

      <section className="tr-card tr-wide">
        <h2>{tr("scatterTitle")}</h2>
        <p className="tr-sub">{tr("scatterSub")}</p>
        <div className="tr-filters">
          {metricSelect(xId, setX, tr("axisX"))}
          {metricSelect(yId, setY, tr("axisY"))}
        </div>
        <Scatter points={scatter} xLabel={`${t(`metrics.${xId}`)} (${metricById(xId).unit})`} yLabel={`${t(`metrics.${yId}`)} (${metricById(yId).unit})`} selected={comuna} onSelect={setComuna} locale={locale} xDec={metricById(xId).decimals} yDec={metricById(yId).decimals} />
      </section>

      <p className="tr-note tr-foot">{tr("foot")}</p>
    </div>
  );
}
