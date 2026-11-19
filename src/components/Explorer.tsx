"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, METRICS, metricById, metricsOfFamily, type FamilyId, type Level } from "@/lib/layers/registry";
import { planLayers } from "@/lib/layers/priority";
import { formatValue, rampFor } from "@/lib/layers/style";
import { parseQuery, rankByCriteria, type Criterion } from "@/lib/search/parse";
import { bboxOf, findContaining, valuesOf, type AreaCollection, type AreaFeature } from "@/lib/geo";
import type { MapCommand } from "./MapView";
import { SANTIAGO, SANTIAGO_ZOOM, zoomBy } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const AVAILABLE_LEVELS: Level[] = ["N", "C", "D"];

interface PricesFile {
  period: [string, string];
  comunas: Record<string, { n: number; median: number; p25: number; p75: number; years: Record<string, { n: number; median: number }> }>;
}

const ACCESS_GROUPS = ["food", "pharmacy", "health", "transport"] as const;
interface AccessFile {
  zones: Record<string, { v: number } & Partial<Record<(typeof ACCESS_GROUPS)[number], number | null>>>;
  comunas: Record<string, number>;
}

const fmtDate = (d: string) => `${d.slice(4, 6)}/${d.slice(0, 4)}`;

type Selection =
  | { kind: "area"; level: "C" | "D"; id: string; comuna?: AreaFeature; zone?: AreaFeature; address?: string }
  | { kind: "matches"; criteria: Criterion[]; items: Array<{ code: string; name: string; score: number }> };

interface CensoFile { comunas: Record<string, { SO01: number; pop: number }>; zones: Record<string, { SO01: number; pop: number }> }

export default function Explorer() {
  const t = useTranslations();
  const locale = useLocale();

  const [chile, setChile] = useState<unknown>(null);
  const [comunas, setComunas] = useState<AreaCollection | null>(null);
  const [zones, setZones] = useState<AreaCollection | null>(null);
  const [prices, setPrices] = useState<PricesFile | null>(null);
  const [family, setFamily] = useState<FamilyId>("environment");
  const [metricId, setMetricId] = useState("EN04");
  const [zoom, setZoom] = useState(SANTIAGO_ZOOM);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<"summary" | "evidence">("summary");
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);

  useEffect(() => {
    const load = (f: string) => fetch(`/data/${f}`).then((r) => r.json());
    load("chile.geojson").then(setChile);
    // Real layers are merged into the comuna features; demo values stay for the rest.
    Promise.all([load("comunas.geojson"), load("prices-comunas.json"), load("transit.json"), load("access.json"), load("censo.json")]).then(([fc, prices, transit, access, censo]: [AreaCollection, PricesFile, { comunas: Record<string, number> }, AccessFile, CensoFile]) => {
      for (const f of fc.features) {
        const cs = censo.comunas[String(f.properties.code)];
        if (cs) Object.assign(f.properties, { SO01: cs.SO01, pop: cs.pop });
        else delete f.properties.SO01;
        const ac = access.comunas[String(f.properties.code)];
        if (ac !== undefined) f.properties.IN01 = ac;
        const t = transit.comunas[String(f.properties.code)];
        if (t !== undefined) f.properties.IN04 = t;
        const p = prices.comunas[String(f.properties.code)];
        if (!p) continue;
        Object.assign(f.properties, { EC02: p.median, EC02_n: p.n, EC02_p25: p.p25, EC02_p75: p.p75 });
      }
      setPrices(prices);
      setComunas(fc);
    });
    Promise.all([load("zones.geojson"), load("transit.json"), load("zone-weights.json"), load("access.json"), load("censo.json")]).then(
      ([fc, transit, w, access, censo]: [AreaCollection, { zones: Record<string, number> }, { weights: Record<string, number> }, AccessFile, CensoFile]) => {
        for (const f of fc.features) {
          const id = String(f.properties.id);
          const cz = censo.zones[id];
          // zones without Censo residents have no density value (unknown ≠ 0 for non-residential land)
          if (cz) Object.assign(f.properties, { SO01: cz.SO01, pop: cz.pop });
          else delete f.properties.SO01;
          if (id in transit.zones) f.properties.IN04 = transit.zones[id];
          const acc = access.zones[id];
          if (acc) {
            f.properties.IN01 = acc.v;
            for (const g of ACCESS_GROUPS) if (acc[g] != null) f.properties[`IN01_${g}`] = acc[g] as number;
          }
          f.properties.bld = w.weights[id] ?? 0;
        }
        setZones(fc);
      },
    );
  }, []);

  const metric = metricById(metricId);
  const plan = useMemo(() => planLayers(metric, zoom, AVAILABLE_LEVELS), [metric, zoom]);
  const comunaByCode = useMemo(() => new Map(comunas?.features.map((f) => [String(f.properties.code), f]) ?? []), [comunas]);
  const fly = (c: Omit<MapCommand, "seq">) => setCommand((prev) => ({ ...c, seq: (prev?.seq ?? 0) + 1 }));

  function chooseFamily(f: FamilyId) {
    setFamily(f);
    setMetricId(metricsOfFamily(f)[0].id);
  }

  function selectArea(level: "C" | "D", props: Record<string, string | number>, address?: string) {
    if (level === "C") {
      const comuna = comunaByCode.get(String(props.code));
      setSelection({ kind: "area", level, id: String(props.code), comuna, address });
    } else {
      const zone = zones?.features.find((z) => z.properties.id === props.id);
      setSelection({ kind: "area", level, id: String(props.id), zone, comuna: comunaByCode.get(String(props.comuna)), address });
    }
    setTab("summary");
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const names = comunas?.features.map((f) => String(f.properties.name)) ?? [];
    const parsed = parseQuery(query, names);
    switch (parsed.kind) {
      case "empty":
        return;
      case "link":
        setMessage(t("search.link"));
        return;
      case "comuna": {
        const f = comunas!.features.find((x) => x.properties.name === parsed.name)!;
        setMarker(null);
        selectArea("C", f.properties);
        fly({ kind: "fit", bbox: bboxOf([f]) });
        return;
      }
      case "criteria": {
        const first = metricById(parsed.criteria[0].metric);
        setFamily(first.family);
        setMetricId(first.id);
        const domains = Object.fromEntries(METRICS.map((m) => [m.id, m.domain])) as Record<string, [number, number]>;
        const ranked = rankByCriteria(
          (comunas?.features ?? []).map((f) => ({ code: String(f.properties.code), name: String(f.properties.name), values: valuesOf(f.properties) })),
          parsed.criteria,
          domains,
        ).slice(0, 5);
        setMarker(null);
        setSelection({ kind: "matches", criteria: parsed.criteria, items: ranked.map(({ code, name, score }) => ({ code, name, score })) });
        const feats = ranked.map((r) => comunaByCode.get(r.code)).filter(Boolean) as AreaFeature[];
        if (feats.length) fly({ kind: "fit", bbox: bboxOf(feats) });
        return;
      }
      case "address": {
        setMessage(t("search.searching"));
        try {
          // Photon (OSM) for development; spec M9 — deterministic geocoding, no LLM.
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(parsed.text)}&limit=1&lang=${locale === "es" ? "default" : "en"}&bbox=-75.8,-56,-66.4,-17.4`;
          const res = await fetch(url);
          const data = await res.json();
          const hit = data.features?.[0];
          if (!hit) {
            setMessage(t("search.notFound", { q: parsed.text }));
            return;
          }
          const pt = hit.geometry.coordinates as [number, number];
          const p = hit.properties ?? {};
          const label = [p.street ? `${p.street} ${p.housenumber ?? ""}`.trim() : p.name, p.district ?? p.city].filter(Boolean).join(", ");
          setMarker(pt);
          fly({ kind: "fly", center: pt, zoom: 15 });
          const zone = findContaining(zones, pt);
          const comuna = findContaining(comunas, pt);
          if (zone) selectArea("D", zone.properties, label);
          else if (comuna) selectArea("C", comuna.properties, label);
          else {
            setSelection(null);
            setMessage(t("search.outside"));
            return;
          }
          setMessage(null);
        } catch {
          setMessage(t("search.notFound", { q: parsed.text }));
        }
      }
    }
  }

  const selectedRef = selection?.kind === "area" ? { level: selection.level as Level, id: selection.id } : null;
  const highlighted = selection?.kind === "matches" ? selection.items.map((i) => i.code) : [];
  const placeName =
    selection?.kind === "area" ? String(selection.comuna?.properties.name ?? "Santiago") : zoom < 7 ? "" : "Santiago";

  return (
    <div className={`at-workspace${selection ? " at-selected" : ""}`}>
      <aside className={`at-layers${layersOpen ? "" : " is-collapsed"}`} aria-label={t("layers.heading")}>
        <div className="at-widget-heading">
          <button type="button" aria-expanded={layersOpen} onClick={() => setLayersOpen((v) => !v)} title={t("layers.collapse")}>
            {t("layers.heading")}
          </button>
          <span className="at-count">{t(`families.${family}`)}</span>
        </div>
        <div className="at-layer-list" role="radiogroup">
          {FAMILIES.map((f) => (
            <div className="at-layer-row" key={f.id}>
              <label className="at-layer-label">
                <input type="radio" name="family" checked={family === f.id} onChange={() => chooseFamily(f.id)} />
                <span className="at-layer-dot" style={{ background: f.color }} />
                {t(`families.${f.id}`)}
              </label>
              {family === f.id && (
                <div className="at-metric-list" role="radiogroup" aria-label={t("layers.indicator")}>
                  {metricsOfFamily(f.id).map((m) => (
                    <label key={m.id}>
                      <input type="radio" name="metric" checked={metricId === m.id} onChange={() => setMetricId(m.id)} />
                      {t(`metrics.${m.id}`)}
                      <span className="at-level-tag" title={m.levels.map((l) => t(`levels.${l}`)).join(", ")}>
                        {m.levels.at(-1)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="at-layer-detail">
          <p>{t("layers.hint")}</p>
        </div>
      </aside>

      <div className="at-map">
        <MapView
          chile={chile}
          comunas={comunas}
          zones={zones}
          metric={metric}
          plan={plan}
          selected={selectedRef}
          highlighted={highlighted}
          marker={marker}
          command={command}
          onZoom={setZoom}
          onPick={(level, props) => {
            setMarker(null);
            selectArea(level as "C" | "D", props);
          }}
        />
        <div className="at-map-top">
          <div className="at-map-location">
            <span>Chile /</span>
            <strong>{placeName}</strong>
          </div>
        </div>
        {metric.demo && <div className="at-demo">{t("explore.demo")}</div>}

        <Legend metricId={metricId} plan={plan} period={prices?.period} />

        <div className="at-zoom" aria-label="zoom">
          <button type="button" aria-label={t("explore.zoomIn")} onClick={() => zoomBy(1)}>+</button>
          <button type="button" aria-label={t("explore.zoomOut")} onClick={() => zoomBy(-1)}>−</button>
          <button type="button" aria-label={t("explore.recenter")} onClick={() => fly({ kind: "fly", center: SANTIAGO, zoom: SANTIAGO_ZOOM })}>◎</button>
        </div>

        {message && <div className="at-search-message" role="status">{message}</div>}
        <form className="at-search" onSubmit={onSearch} role="search">
          <input
            aria-label={t("explore.searchLabel")}
            placeholder={t("explore.searchPlaceholder")}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="at-primary">{t("explore.analyze")}</button>
        </form>
      </div>

      {selection && (
        <aside className="at-drawer" aria-label={t("drawer.label")} aria-live="polite">
          <div className="at-drawer-top">
            <span className="at-eyebrow">
              {selection.kind === "matches" ? t("drawer.matches") : selection.address ? t("drawer.address") : selection.level === "D" ? t("drawer.zone") : t("drawer.territory")}
            </span>
            <button type="button" className="at-close" aria-label={t("drawer.close")} onClick={() => { setSelection(null); setMarker(null); }}>×</button>
          </div>
          {selection.kind === "matches" ? (
            <Matches selection={selection} onPick={(code) => {
              const f = comunaByCode.get(code);
              if (!f) return;
              selectArea("C", f.properties);
              fly({ kind: "fit", bbox: bboxOf([f]) });
            }} />
          ) : (
            <>
              <h2>{selection.address ?? String(selection.comuna?.properties.name)}</h2>
              <p className="at-subline">
                {selection.address ? `${selection.comuna?.properties.name} · ` : ""}
                {selection.level === "D" ? `${t("drawer.zone")} ${selection.zone?.properties.id} · ` : ""}
                {t("drawer.region")}
              </p>
              <div className="at-detail-tabs">
                <button type="button" aria-pressed={tab === "summary"} onClick={() => setTab("summary")}>{t("drawer.summary")}</button>
                <button type="button" aria-pressed={tab === "evidence"} onClick={() => setTab("evidence")}>{t("drawer.evidence")}</button>
              </div>
              {tab === "summary" ? (
                <PlaceValues zone={selection.zone} comuna={selection.comuna} locale={locale} prices={prices} />
              ) : (
                <Evidence />
              )}
              <div className="at-report-teaser">
                <span className="at-eyebrow">{t("drawer.teaserEyebrow")}</span>
                <h3>{t("drawer.teaserTitle")}</h3>
                <p>{t("drawer.teaserText")}</p>
                <button type="button" className="at-primary" disabled title={t("pages.account.soon")}>{t("drawer.teaserCta")}</button>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function Legend({ metricId, plan, period }: { metricId: string; plan: ReturnType<typeof planLayers>; period?: [string, string] }) {
  const t = useTranslations();
  const metric = metricById(metricId);
  const ramp = rampFor(metric);
  const [lo, hi] = metric.domain;
  return (
    <div className="at-legend">
      <h3>{t(`metrics.${metric.id}`)}</h3>
      {plan.fillLevel ? (
        <>
          <div className="at-ramp">{ramp.map((c) => <span key={c} style={{ background: c }} />)}</div>
          <div className="at-ramp-labels">
            <span>{lo}</span>
            <span>{metric.unit}</span>
            <span>{hi}</span>
          </div>
          <p className="at-legend-scale">
            {t("legend.levelNow", { level: t(`levels.${plan.viewLevel}`) })} · <strong>{t("legend.dataAt", { level: t(`levels.${plan.fillLevel}`) })}</strong>
            {plan.isFallback && <><br />{t("legend.fallback", { level: t(`levels.${plan.fillLevel}`) })}</>}
          </p>
          {!metric.demo && metric.id === "EC02" && period && (
            <p className="at-legend-scale">{t("legend.ec02", { from: fmtDate(period[0]), to: fmtDate(period[1]) })}</p>
          )}
          {metric.id === "IN04" && <p className="at-legend-scale">{t("legend.in04")}</p>}
          {metric.id === "IN01" && <p className="at-legend-scale">{t("legend.in01")}</p>}
          {metric.id === "SO01" && <p className="at-legend-scale">{t("legend.so01")}</p>}
        </>
      ) : (
        <p className="at-legend-scale">{t("legend.noData")}</p>
      )}
    </div>
  );
}

function PlaceValues({ zone, comuna, locale, prices }: { zone?: AreaFeature; comuna?: AreaFeature; locale: string; prices: PricesFile | null }) {
  const t = useTranslations();
  return (
    <div>
      {FAMILIES.map((f) => (
        <div key={f.id}>
          <p className="at-family-head"><span className="at-layer-dot" style={{ background: f.color }} />{t(`families.${f.id}`)}</p>
          {metricsOfFamily(f.id).map((m) => {
            // take the finest level the metric has for this place; say which level it is
            const fromZone = zone && m.levels.includes("D") ? (zone.properties[m.id] as number | undefined) : undefined;
            const value = fromZone ?? (comuna?.properties[m.id] as number | undefined);
            const level: Level = fromZone !== undefined ? "D" : "C";
            return (
              <div className="at-observation" key={m.id}>
                <div className="at-value-row">
                  <strong>{t(`metrics.${m.id}`)}</strong>
                  <b>{formatValue(m, value, locale)}<small>{m.unit}</small></b>
                </div>
                <span className="at-status">{t("drawer.atLevel", { level: t(`levels.${level}`) })} · {m.demo ? t("drawer.status") : t("drawer.real")}</span>
                {m.id === "IN01" && fromZone !== undefined && zone && (
                  <p>{ACCESS_GROUPS.map((g) => `${t(`drawer.acc_${g}`)} ~${Math.round(Number(zone.properties[`IN01_${g}`]))} min`).join(" · ")}<br />{t("drawer.accNote")}</p>
                )}
                {m.id === "EC02" && comuna && prices?.comunas[String(comuna.properties.code)] && (
                  <PriceDetail p={prices.comunas[String(comuna.properties.code)]} period={prices.period} locale={locale} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PriceDetail({ p, period, locale }: { p: PricesFile["comunas"][string]; period: [string, string]; locale: string }) {
  const t = useTranslations("drawer");
  const nf = new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US");
  const years = Object.entries(p.years).filter(([y]) => y >= "2019");
  return (
    <p>
      {t("ec02Sample", { n: nf.format(p.n), from: fmtDate(period[0]), to: fmtDate(period[1]), p25: nf.format(p.p25), p75: nf.format(p.p75) })}
      <br />
      {t("ec02Trend")}: {years.map(([y, v]) => `${y} ${nf.format(v.median)}`).join(" · ")}
    </p>
  );
}

function Evidence() {
  const t = useTranslations();
  return (
    <div>
      <div className="at-observation"><p>{t("drawer.demoNote")}</p></div>
      {METRICS.map((m) => (
        <div className="at-observation" key={m.id}>
          <strong>{m.id} · {t(`metrics.${m.id}`)}</strong>
          <p>{m.demo ? t("drawer.sources", { sources: m.sources.join(", ") }) : t(`drawer.method_${m.id}`)}</p>
          <span className="at-status">{m.levels.map((l) => t(`levels.${l}`)).join(" · ")}</span>
        </div>
      ))}
    </div>
  );
}

function Matches({ selection, onPick }: { selection: Extract<Selection, { kind: "matches" }>; onPick: (code: string) => void }) {
  const t = useTranslations();
  const criteria = selection.criteria
    .map((c) => `${t(`metrics.${c.metric}`)} ${c.prefer === "low" ? "↓" : "↑"}`)
    .join(" · ");
  return (
    <>
      <p className="at-subline" style={{ marginTop: 8 }}>{t("drawer.matchesNote", { criteria })}</p>
      <div style={{ marginTop: 10 }}>
        {selection.items.map((i) => (
          <button type="button" className="at-match" key={i.code} onClick={() => onPick(i.code)}>
            {i.name}
            <span>{Math.round(i.score * 100)}</span>
          </button>
        ))}
      </div>
      <div className="at-observation"><p>{t("drawer.demoNote")}</p></div>
    </>
  );
}

