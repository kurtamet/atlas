"use client";
/**
 * The paid report template. Layout, numbers and charts come from ReportInput (deterministic);
 * only the texts in `ai` come from Claude. Printed as A4 pages (window.print → PDF).
 */
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, metricById } from "@/lib/layers/registry";
import { formatValue } from "@/lib/layers/style";
import type { ReportInput } from "@/lib/report/input";
import type { ReportAI } from "@/lib/report/schema";
import type { PoiGroup } from "@/lib/object/facts";
import { KINDS, unitLabel } from "@/lib/object/units";
import { ScoreBars, PercentileStrip, WalkBars, PriceColumns, FAVOUR } from "./charts";

const GROUPS: PoiGroup[] = ["metro", "transport", "food", "pharmacy", "health", "park", "school"];
const VERDICT_COLOR = { favorable: FAVOUR.good, mixed: FAVOUR.mid, caution: FAVOUR.bad };
const SEVERITY_COLOR = { low: FAVOUR.none, medium: FAVOUR.mid, high: FAVOUR.bad };
const FIT_COLOR = { good: FAVOUR.good, neutral: FAVOUR.none, poor: FAVOUR.bad };

export default function ReportDocument({ input, ai, source }: { input: ReportInput; ai: ReportAI; source: "claude" | "rules" }) {
  const t = useTranslations();
  const d = useTranslations("reportDoc");
  const o = useTranslations("object");
  const locale = useLocale();
  const num = (v: number, dec = 0) => new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US", { maximumFractionDigits: dec }).format(v);
  const date = new Date(input.createdAt).toLocaleDateString(locale === "es" ? "es-CL" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const metric = (id: string) => input.metrics.find((m) => m.id === id);
  const evidenceLabel = (e: string) => {
    if (input.metrics.some((m) => m.id === e)) return t(`metrics.${e}`);
    const k = `ev_${e.replace(/\W/g, "_")}`;
    return d.has(k) ? d(k) : e;
  };
  const years = input.price ? Object.entries(input.price.years).sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([y, v]) => [y, v.median] as [string, number]) : [];
  const hazards = [input.hazards.RS07, input.hazards.RS09, input.hazards.RS05].filter(Boolean).length;
  const crime = metric("RS01");
  const u = useTranslations("object.unit");
  const val = input.valuation ?? null;
  const benchArgs = val ? { kind: u(`kind_${val.kind}`), where: u(`where_${val.level}`), med: num(val.med, 1), p25: num(val.p25, 1), p75: num(val.p75, 1), n: num(val.n) } : null;
  const page = (n: number) => <footer className="rd-foot"><span>PROMETEO · prometeo.land · {input.object.title}</span><span>{n}</span></footer>;

  // running footer of the printed PDF (Chrome/Edge page margin boxes); the on-screen sheets use .rd-foot
  const pageCss = `@page{@bottom-left{content:${JSON.stringify(`PROMETEO · ${input.object.title.replace(/[<>{}\\"]/g, "")}`)};font:8pt sans-serif;color:#8a948f}@bottom-right{content:counter(page);font:8pt sans-serif;color:#8a948f}}`;

  return (
    <article className="rd">
      <style>{pageCss}</style>
      {/* 1 — cover and verdict */}
      <section className="rd-page">
        <header className="rd-cover">
          <div>
            <p className="rd-eyebrow">{d("eyebrow")}</p>
            <h1>{input.object.title}</h1>
            <p className="rd-sub">{input.object.comuna}{input.object.zone ? ` · ${t("drawer.zone")} ${input.object.zone}` : ""} · {input.object.lngLat[1]}, {input.object.lngLat[0]}</p>
            {(input.unit || input.mix) && (
              <p className="rd-sub">
                {input.unit
                  ? [u(`kind_${input.unit.kind}`), unitLabel(input.unit.dir), input.unit.m2 ? `${num(input.unit.m2)} m²` : null, input.unit.yr ? `${o("cat.year", { y: input.unit.yr })}` : null, `rol ${input.unit.rol}`].filter(Boolean).join(" · ")
                  : `${d("unitWhole")}: ${KINDS.filter((k) => input.mix?.[k]).map((k) => u(`kinds_${k}`, { n: input.mix![k]! })).join(" · ")}`}
              </p>
            )}
          </div>
          <div className="rd-date">{date}</div>
        </header>
        <div className="rd-verdict" style={{ borderColor: VERDICT_COLOR[ai.verdict] }}>
          <span className="rd-badge" style={{ background: VERDICT_COLOR[ai.verdict] }}>{d(`verdict_${ai.verdict}`)}</span>
          <h2>{ai.headline}</h2>
          <p>{ai.summary}</p>
        </div>
        {ai.overview && (
          <div className="rd-overview">
            <h3 className="rd-h">{d("overview")}</h3>
            <p>{ai.overview}</p>
          </div>
        )}
        <div className="rd-tiles">
          <div><b>{input.walk.metro !== undefined ? `~${input.walk.metro} min` : "—"}</b><span>{d("tileMetro")}{input.metroName ? ` · ${input.metroName}` : ""}</span></div>
          {val?.estimate ? (
            <div><b>≈ {num(val.estimate.mid)} UF</b><span>{d("tileEstimate")}</span></div>
          ) : val && val.basis === "m2" ? (
            <div><b>{num(val.med, 1)} UF/m²</b><span>{d("tileBench", { kind: u(`kindsGen_${val.kind}`), where: u(`where_${val.level}`) })}</span></div>
          ) : (
            <div><b>{input.price ? `${num(input.price.median)} UF` : "—"}</b><span>{d("tilePrice", { comuna: input.object.comuna })}</span></div>
          )}
          <div><b style={{ color: hazards ? FAVOUR.bad : FAVOUR.good }}>{hazards ? d("tileHazardsYes", { n: hazards }) : d("tileHazardsNo")}</b><span>{d("tileHazards")}</span></div>
          <div><b>{crime ? num(crime.value) : "—"}</b><span>{d("tileCrime")}</span></div>
        </div>
        <h3 className="rd-h">{d("scores")}</h3>
        <ScoreBars rows={(["daily", "environment", "safety", "climate"] as const).map((k) => ({ label: d(`score_${k}`), value: input.scores[k] }))} />
        <p className="rd-note">{d("scoresNote")}</p>
        {input.object.footprintM2 && <p className="rd-note">{o("building", { area: input.object.footprintM2 })}{input.object.heightM ? ` ${o("height", { h: input.object.heightM })}` : ""} {o("identityNote")}</p>}
        <div className="rd-two">
          <div>
            <h3 className="rd-h">{d("strengths")}</h3>
            {ai.strengths.map((s, i) => (
              <div className="rd-item" key={i} style={{ borderColor: FAVOUR.good }}>
                <strong>{s.title}</strong><p>{s.detail}</p><small>{d("evidence")}: {evidenceLabel(s.evidence)}</small>
              </div>
            ))}
            {!ai.strengths.length && <p className="rd-note">{d("none")}</p>}
          </div>
          <div>
            <h3 className="rd-h">{d("risks")}</h3>
            {ai.risks.map((s, i) => (
              <div className="rd-item" key={i} style={{ borderColor: SEVERITY_COLOR[s.severity] }}>
                <strong>{s.title} <span className="rd-pill" style={{ background: SEVERITY_COLOR[s.severity] }}>{d(`sev_${s.severity}`)}</span></strong>
                <p>{s.detail}</p><p className="rd-mit">→ {s.mitigation}</p><small>{d("evidence")}: {evidenceLabel(s.evidence)}</small>
              </div>
            ))}
            {!ai.risks.length && <p className="rd-note">{d("none")}</p>}
          </div>
        </div>
        {page(1)}
      </section>

      {/* 2 — checks, value, audiences */}
      <section className="rd-page">
        <h3 className="rd-h">{d("checks")}</h3>
        <ol className="rd-list">{ai.checks.map((c, i) => <li key={i}>{c}</li>)}</ol>
        {ai.negotiation.length > 0 && (<><h3 className="rd-h">{d("negotiation")}</h3><ul className="rd-list">{ai.negotiation.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
        <h3 className="rd-h">{d("value")}</h3>
        {val && benchArgs && (
          <>
            {val.estimate && (
              <div className="rd-estimate">
                <span>{d("estimate")}{input.unit ? ` · ${unitLabel(input.unit.dir)}` : ""}</span>
                <b>{d("estimateRange", { low: num(val.estimate.low), high: num(val.estimate.high) })}</b>
                <small>{d("estimateMid", { mid: num(val.estimate.mid) })}</small>
              </div>
            )}
            <p>{d(`valueBench_${val.basis}`, benchArgs)}{val.rmMed && val.level !== "RM" ? ` ${d("valueRm", { med: num(val.rmMed, 1) })}` : ""}</p>
            {val.estimate && <p className="rd-note">{val.basis === "unit" ? d("estimateNoteUnit") : d("estimateNote", { m2: num(val.area ?? 0) })}</p>}
            {input.price && <h4 className="rd-h4">{d("comunaContext")}</h4>}
          </>
        )}
        {input.price ? (
          <>
            <p>{d("priceLine", { comuna: input.object.comuna, median: num(input.price.median), p25: num(input.price.p25), p75: num(input.price.p75), n: num(input.price.n) })}</p>
            <PriceColumns years={years} locale={locale} />
            <p className="rd-note">{d("priceNote")}</p>
          </>
        ) : <p className="rd-note">{d("noPrice")}</p>}
        <div className="rd-callout"><span className="rd-pill rd-pill-dark">{d(`pos_${ai.value.position}`)}</span><p>{ai.value.comment}</p></div>
        <h3 className="rd-h">{d("audiences")}</h3>
        <table className="rd-table">
          <tbody>
            {ai.audiences.map((a) => (
              <tr key={a.audience}>
                <td className="rd-aud">{d(`aud_${a.audience}`)}</td>
                <td><span className="rd-pill" style={{ background: FIT_COLOR[a.fit] }}>{d(`fit_${a.fit}`)}</span></td>
                <td>{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {page(2)}
      </section>

      {/* 3 — indicators */}
      <section className="rd-page">
        <h3 className="rd-h">{d("indicators")}</h3>
        <p className="rd-note">{d("indicatorsNote")}</p>
        <div className="rd-two">
          {FAMILIES.map((f) => {
            const ms = input.metrics.filter((m) => m.family === f.id);
            if (!ms.length) return null;
            return (
              <div key={f.id} className="rd-family">
                <p className="rd-fam" style={{ color: f.color }}>{t(`families.${f.id}`)}</p>
                {ms.map((m) => (
                  <PercentileStrip key={m.id} m={m} label={`${t(`metrics.${m.id}`)} · ${m.level === "D" ? d("lvlD") : d("lvlC")}`} valueText={`${formatValue(metricById(m.id), m.value, locale)} ${m.unit}`} />
                ))}
              </div>
            );
          })}
        </div>
        <div className="rd-two">
          <div>
            <h3 className="rd-h">{d("walk")}</h3>
            <WalkBars rows={GROUPS.filter((g) => input.walk[g] !== undefined).map((g) => ({ label: o(`g_${g}`), min: input.walk[g]! }))} />
            <p className="rd-note">{o("walkNote")}</p>
          </div>
          <div>
            <h3 className="rd-h">{d("hazards")}</h3>
            <table className="rd-table">
              <tbody>
                {(["RS07", "RS09", "RS05"] as const).map((k) => (
                  <tr key={k}><td>{t(`metrics.${k}`)}</td><td><b style={{ color: input.hazards[k] ? FAVOUR.bad : FAVOUR.good }}>{input.hazards[k] ? d("inside") : d("outside")}</b></td></tr>
                ))}
                {input.hazards.faultKm !== null && <tr><td>{d("fault")}</td><td><b>{input.hazards.faultKm} km</b></td></tr>}
              </tbody>
            </table>
            <p className="rd-note">{d("hazardsNote")}</p>
          </div>
        </div>
        {page(3)}
      </section>

      {/* 4 — method */}
      <section className="rd-page rd-method">
        <h3 className="rd-h">{d("method")}</h3>
        <p>{d("methodText")}</p>
        <ul className="rd-list rd-small">
          {input.metrics.map((m) => <li key={m.id}><b>{t(`metrics.${m.id}`)}.</b> {t(`drawer.method_${m.id}`)}</li>)}
        </ul>
        <h3 className="rd-h">{d("unknownTitle")}</h3>
        <ul className="rd-list">{["unit", "documents", "objectPrice", "condition", "rules"].map((k) => <li key={k}>{o(`obs.${k}`)}</li>)}</ul>
        <p className="rd-note">{source === "claude" ? d("aiByClaude") : d("aiRules")} {d("disclaimer")}</p>
        {page(4)}
      </section>
    </article>
  );
}
