"use client";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, metricsOfFamily, type Metric } from "@/lib/layers/registry";
import { formatValue } from "@/lib/layers/style";
import type { PointFacts, Observation, PoiGroup, LngLat } from "@/lib/object/facts";
import type { AreaCollection } from "@/lib/geo";
import { buildReportInput, ruleVerdict } from "@/lib/report/input";
import { ScoreBars, FAVOUR } from "./report/charts";

import type { PriceInfo } from "@/lib/report/input";
export type { PriceInfo };

const GROUPS: PoiGroup[] = ["metro", "transport", "food", "pharmacy", "health", "park", "school"];

/** share of areas (with a value) below v: "higher than X% of comunas/zones" */
function percentile(all: AreaCollection | null, id: string, v: number): number | null {
  const vals = (all?.features ?? []).map((f) => f.properties[id]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (vals.length < 5) return null;
  return Math.round((100 * vals.filter((x) => x < v).length) / vals.length);
}

export default function ObjectReport(props: {
  onClose: () => void;
  title: string;
  lngLat: LngLat;
  area: number | null;
  height?: number;
  hasFootprint: boolean;
  facts: PointFacts;
  obs: { pros: Observation[]; cons: Observation[]; unknown: Observation[] };
  zone?: Record<string, unknown>;
  comuna?: Record<string, unknown>;
  zones: AreaCollection | null;
  comunas: AreaCollection | null;
  price?: PriceInfo;
  pricePeriod?: [string, string];
  onReport: () => void;
}) {
  const t = useTranslations();
  const r = useTranslations("report");
  const o = useTranslations("object");
  const locale = useLocale();
  const { facts, obs, zone, comuna, onClose } = props;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);

  const valueOf = (m: Metric) => {
    const z = m.levels.includes("D") ? (zone?.[m.id] as number | undefined) : undefined;
    if (typeof z === "number") return { v: z, level: "D" as const, pct: percentile(props.zones, m.id, z) };
    const c = comuna?.[m.id] as number | undefined;
    if (typeof c === "number") return { v: c, level: "C" as const, pct: percentile(props.comunas, m.id, c) };
    return null;
  };
  // free preview of the report's first page: scores and verdict are deterministic, texts stay blurred
  const preview = buildReportInput({ locale: locale === "en" ? "en" : "es", title: props.title, lngLat: props.lngLat, area: props.area, height: props.height, facts, obs, zone, comuna, zones: props.zones, comunas: props.comunas, price: props.price, pricePeriod: props.pricePeriod });
  const verdict = ruleVerdict(preview);
  const d = useTranslations("reportDoc");
  const yesNo = (b: boolean) => (b ? r("yes") : r("no"));
  const item = (x: Observation) => <li key={x.key}>{o(`obs.${x.key}`, x.params ?? {})} <small className="at-obs-level">{o(`lvl_${x.level}`)}</small></li>;
  const years = props.price ? Object.entries(props.price.years).sort(([a], [b]) => a.localeCompare(b)).slice(-6) : [];
  const maxY = Math.max(1, ...years.map(([, y]) => y.median));

  return (
    <div className="at-report-overlay" role="dialog" aria-modal="true" aria-label={r("title")} onClick={onClose}>
      <div className="at-report" onClick={(e) => e.stopPropagation()}>
        <div className="at-report-head">
          <div>
            <span className="at-eyebrow">{r("eyebrow")}</span>
            <h1>{props.title}</h1>
            <p className="at-subline">
              {String(comuna?.name ?? "")}{zone ? ` · ${t("drawer.zone")} ${String(zone.id)}` : ""} · {props.lngLat[1].toFixed(5)}, {props.lngLat[0].toFixed(5)}
            </p>
          </div>
          <div className="at-report-actions">
            <button type="button" className="at-primary" onClick={props.onReport}>{t("drawer.teaserCta")}</button>
            <button type="button" className="at-close" aria-label={t("drawer.close")} onClick={onClose}>×</button>
          </div>
        </div>

        <div className="at-report-preview">
          <div>
            <span className="at-eyebrow">{r("previewEyebrow")}</span>
            <p className="at-preview-verdict"><span className="rd-badge" style={{ background: verdict === "favorable" ? FAVOUR.good : verdict === "mixed" ? FAVOUR.mid : FAVOUR.bad }}>{d(`verdict_${verdict}`)}</span> {r("previewCounts", { pros: obs.pros.length, cons: obs.cons.length })}</p>
            <ScoreBars rows={(["daily", "environment", "safety", "climate"] as const).map((k) => ({ label: d(`score_${k}`), value: preview.scores[k] }))} />
          </div>
          <div className="at-preview-locked" aria-hidden="true">
            <div className="at-preview-blur">
              <b>{d("strengths")}</b><i /><i /><i className="s" />
              <b>{d("risks")}</b><i /><i className="s" />
              <b>{d("checks")}</b><i /><i /><i className="s" />
            </div>
            <div className="at-preview-lock">
              <p>{r("previewLocked")}</p>
              <button type="button" className="at-primary" onClick={props.onReport}>{t("drawer.teaserCta")}</button>
            </div>
          </div>
        </div>

        <div className="at-report-grid">
          <section>
            <h2>{r("summary")}</h2>
            {obs.cons.length > 0 && <div className="at-obs-cons"><strong>{o("cons")}</strong><ul>{obs.cons.map(item)}</ul></div>}
            {obs.pros.length > 0 && <div className="at-obs-pros"><strong>{o("pros")}</strong><ul>{obs.pros.map(item)}</ul></div>}
            {!obs.cons.length && !obs.pros.length && <p>{r("noFlags")}</p>}
            <p className="at-report-hint">{r("explainedInReport")}</p>

            <h2>{o("identified")}</h2>
            <p>
              {props.hasFootprint ? o("building", { area: props.area ?? "?" }) : o("pointOnly")}
              {props.hasFootprint && props.height ? ` ${o("height", { h: Math.round(props.height) })}` : ""}
            </p>
            <p className="at-subline">{o("identityNote")}</p>

            <h2>{r("hazards")}</h2>
            <table className="at-report-table">
              <tbody>
                <tr><td>{t("metrics.RS07")}</td><td>{yesNo(facts.hazards.RS07)}</td></tr>
                <tr><td>{t("metrics.RS09")}</td><td>{yesNo(facts.hazards.RS09)}</td></tr>
                <tr><td>{t("metrics.RS05")}</td><td>{yesNo(facts.hazards.RS05)}</td></tr>
                {facts.faultKm !== undefined && <tr><td>{r("fault")}</td><td>{facts.faultKm} km</td></tr>}
              </tbody>
            </table>
            <p className="at-subline">{r("hazardNote")}</p>

            <h2>{o("walk")}</h2>
            <table className="at-report-table">
              <tbody>
                {GROUPS.filter((g) => facts.minutes[g] !== undefined).map((g) => (
                  <tr key={g}><td>{o(`g_${g}`)}{g === "metro" && facts.metroName ? ` · ${facts.metroName}` : ""}</td><td>{facts.minutes[g]! > 60 ? ">60" : `~${facts.minutes[g]}`} min</td></tr>
                ))}
              </tbody>
            </table>
            <p className="at-subline">{o("walkNote")}</p>

            {props.price && (
              <>
                <h2>{r("price")}</h2>
                <p>{r("priceText", { comuna: String(comuna?.name ?? ""), median: props.price.median.toLocaleString(locale), p25: props.price.p25.toLocaleString(locale), p75: props.price.p75.toLocaleString(locale), n: props.price.n.toLocaleString(locale) })}</p>
                <div className="at-report-bars">
                  {years.map(([y, v]) => (
                    <div key={y}><span style={{ height: `${Math.round((60 * v.median) / maxY)}px` }} /><small>{y}</small><small>{Math.round(v.median / 100) / 10}k</small></div>
                  ))}
                </div>
                <p className="at-subline">{r("priceNote")}</p>
              </>
            )}
          </section>

          <section>
            <h2>{r("layers")}</h2>
            {/* methods shared by several metrics (e.g. the three hazards) are printed once */}
            {FAMILIES.map((f) => (
              <div key={f.id} className="at-report-family">
                <p className="at-family-head"><span className="at-layer-dot" style={{ background: f.color }} />{t(`families.${f.id}`)}</p>
                {metricsOfFamily(f.id).map((m, i, arr) => {
                  const v = valueOf(m);
                  const method = m.demo ? "" : t(`drawer.method_${m.id}`);
                  const repeated = arr.slice(0, i).some((p) => !p.demo && t(`drawer.method_${p.id}`) === method);
                  return (
                    <div className="at-report-metric" key={m.id}>
                      <div className="at-value-row">
                        <strong>{t(`metrics.${m.id}`)}</strong>
                        <b>{formatValue(m, v?.v, locale)}<small>{m.unit}</small></b>
                      </div>
                      <span className="at-status">
                        {v ? t("drawer.atLevel", { level: t(`levels.${v.level}`) }) : r("noValue")} · {m.demo ? t("drawer.status") : t("drawer.real")}
                        {v?.pct != null && v.pct > 0 && !m.demo ? ` · ${r(v.level === "D" ? "pctZones" : "pctComunas", { pct: v.pct })}` : ""}
                      </span>
                      {method && !repeated && <p className="at-report-method">{method}</p>}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        </div>

        <div className="at-report-foot">
          <div>
            <h2>{o("unknown")}</h2>
            <ul>{obs.unknown.map((x) => <li key={x.key}>{o(`obs.${x.key}`)}</li>)}</ul>
          </div>
          <div className="at-report-teaser">
            <span className="at-eyebrow">{t("drawer.teaserEyebrow")}</span>
            <h3>{t("drawer.teaserTitle")}</h3>
            <p>{r("paidAdds")}</p>
            <button type="button" className="at-primary" onClick={props.onReport}>{t("drawer.teaserCta")}</button>
          </div>
        </div>
        <p className="at-subline">{r("disclaimer")}</p>
      </div>
    </div>
  );
}
