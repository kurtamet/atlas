"use client";
import type { RolHit } from "@/app/api/rol/route";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, METRICS, familyById, metricById, metricsOfFamily, type FamilyId, type Level } from "@/lib/layers/registry";
import { planLayers } from "@/lib/layers/priority";
import { formatValue, rampFor } from "@/lib/layers/style";
import { parseQuery, rankByCriteria, type Criterion } from "@/lib/search/parse";
import { bboxOf, findContaining, valuesOf, type AreaCollection, type AreaFeature } from "@/lib/geo";
import type { MapCommand } from "./MapView";
import { SANTIAGO, SANTIAGO_ZOOM, zoomBy } from "./MapView";
import { ReportInfoButton } from "./commerce/ReportInfo";
import ObjectCard from "./ObjectCard";
import { COMPOSITE_ID, addComposite, getMetric } from "@/lib/layers/composite";
import AreaModal from "./AreaModal";

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
  | { kind: "area"; level: "C" | "D"; id: string; comuna?: AreaFeature; zone?: AreaFeature; address?: string; object?: ObjectPick }
  | { kind: "matches"; criteria: Criterion[]; items: Array<{ code: string; name: string; score: number }> };

/** a picked building or geocoded point (level O) */
interface ObjectPick { lngLat: [number, number]; footprint: GeoJSON.Geometry | null; osm: Record<string, string | number> }

/** real layers shipped as plain value maps, merged by zone id / comuna code */
const SIMPLE_LAYERS: Array<[string, string]> = [["ndvi.json", "EN04"], ["value.json", "EC01"]];
interface SimpleLayer { metric: string; zones: Record<string, number>; comunas: Record<string, number> }
interface HazardFile { comunas: Record<string, Record<string, number>>; zones: Record<string, Record<string, number>> }
interface NoiseFile { comunas: Record<string, { EN03: number; day65?: number; night55?: number }>; zones: Record<string, number> }
interface CensoFile { comunas: Record<string, { SO01: number; pop: number }>; zones: Record<string, { SO01: number; pop: number }> }

export default function Explorer() {
  const t = useTranslations();
  const locale = useLocale();

  const [chile, setChile] = useState<unknown>(null);
  const [comunas, setComunas] = useState<AreaCollection | null>(null);
  const [zones, setZones] = useState<AreaCollection | null>(null);
  const [prices, setPrices] = useState<PricesFile | null>(null);
  // the composite layer opens first: overall quality before any single indicator
  const [family, setFamily] = useState<FamilyId | "composite">("composite");
  const [metricId, setMetricId] = useState(COMPOSITE_ID);
  const compositeDone = useRef(false);
  const [zoom, setZoom] = useState(SANTIAGO_ZOOM);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);

  useEffect(() => {
    const load = (f: string) => fetch(`/data/${f}`).then((r) => r.json());
    // single-value layers: {zones: {id: v}, comunas: {code: v}}
    const loadSimple = () => Promise.all(SIMPLE_LAYERS.map(([file, metric]) => load(file).then((d) => ({ metric, zones: d.zones ?? {}, comunas: d.comunas ?? {} }))));
    load("chile.geojson").then(setChile);
    // Real layers are merged into the comuna features; demo values stay for the rest.
    Promise.all([load("comunas.geojson"), load("prices-comunas.json"), load("transit.json"), load("access.json"), load("censo.json"), load("noise.json"), load("hazards.json"), loadSimple(), load("climate.json"), load("enusc.json"), load("air.json"), load("crime.json")]).then(([fc, prices, transit, access, censo, noise, hazards, simple, climate, enusc, air, crime]: [AreaCollection, PricesFile, { comunas: Record<string, number> }, AccessFile, CensoFile, NoiseFile, HazardFile, SimpleLayer[], { comunas: Record<string, Record<string, number>> }, { comunas: Record<string, Record<string, number | string>> }, { comunas: Record<string, Record<string, number | string>> }, { comunas: Record<string, Record<string, number | null>> }]) => {
      for (const f of fc.features) {
        const cr = crime.comunas[String(f.properties.code)];
        if (cr) Object.assign(f.properties, cr);
        else delete f.properties.RS01;
        const ai = air.comunas[String(f.properties.code)];
        if (ai) Object.assign(f.properties, ai);
        else delete f.properties.EN01;
        const en = enusc.comunas[String(f.properties.code)];
        if (en) Object.assign(f.properties, en);
        else delete f.properties.RS03;
        const cl = climate.comunas[String(f.properties.code)];
        if (cl) Object.assign(f.properties, cl);
        else for (const k of ["CL01", "CL03"]) delete f.properties[k];
        for (const l of simple) {
          const v = l.comunas[String(f.properties.code)];
          if (v !== undefined) f.properties[l.metric] = v;
          else delete f.properties[l.metric];
        }
        Object.assign(f.properties, hazards.comunas[String(f.properties.code)] ?? {});
        const nz = noise.comunas[String(f.properties.code)];
        if (nz) Object.assign(f.properties, { EN03: nz.EN03, EN03_day65: nz.day65 ?? null, EN03_night55: nz.night55 ?? null });
        else delete f.properties.EN03;
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
    Promise.all([load("zones.geojson"), load("transit.json"), load("zone-weights.json"), load("access.json"), load("censo.json"), load("noise.json"), load("hazards.json"), loadSimple()]).then(
      ([fc, transit, w, access, censo, noise, hazards, simple]: [AreaCollection, { zones: Record<string, number> }, { weights: Record<string, number> }, AccessFile, CensoFile, NoiseFile, HazardFile, SimpleLayer[]]) => {
        for (const f of fc.features) {
          const id = String(f.properties.id);
          for (const l of simple) {
            if (id in l.zones) f.properties[l.metric] = l.zones[id];
            else delete f.properties[l.metric];
          }
          Object.assign(f.properties, hazards.zones[id] ?? {});
          if (id in noise.zones) f.properties.EN03 = noise.zones[id];
          else delete f.properties.EN03;
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

  // composite needs both levels loaded; computed once, then the collections are re-set so the map redraws
  useEffect(() => {
    if (!comunas || !zones || compositeDone.current) return;
    compositeDone.current = true;
    addComposite(comunas, zones);
    setComunas({ ...comunas });
    setZones({ ...zones });
  }, [comunas, zones]);

  const metric = getMetric(metricId, metricById);
  const plan = useMemo(() => planLayers(metric, zoom, AVAILABLE_LEVELS), [metric, zoom]);
  const comunaByCode = useMemo(() => new Map(comunas?.features.map((f) => [String(f.properties.code), f]) ?? []), [comunas]);
  const fly = (c: Omit<MapCommand, "seq">) => setCommand((prev) => ({ ...c, seq: (prev?.seq ?? 0) + 1 }));

  function chooseFamily(f: FamilyId | "composite") {
    setFamily(f);
    setMetricId(f === "composite" ? COMPOSITE_ID : metricsOfFamily(f)[0].id);
  }

  function selectArea(level: "C" | "D", props: Record<string, string | number>, address?: string, object?: ObjectPick) {
    if (level === "C") {
      const comuna = comunaByCode.get(String(props.code));
      setSelection({ kind: "area", level, id: String(props.code), comuna, address, object });
    } else {
      const zone = zones?.features.find((z) => z.properties.id === props.id);
      setSelection({ kind: "area", level, id: String(props.id), zone, comuna: comunaByCode.get(String(props.comuna)), address, object });
    }
    setAreaOpen(false);
  }

  /** open the object card for a point (building click or geocoded address) */
  function selectObject(obj: ObjectPick, address?: string): boolean {
    const zone = findContaining(zones, obj.lngLat);
    const comuna = findContaining(comunas, obj.lngLat);
    if (zone) selectArea("D", zone.properties, address, obj);
    else if (comuna) selectArea("C", comuna.properties, address, obj);
    else return false;
    if (!address) {
      // reverse geocoding (Photon/OSM) only labels the card; facts never depend on it
      const [lon, lat] = obj.lngLat;
      fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          const p = d.features?.[0]?.properties;
          if (!p) return;
          const label = p.street ? `${p.street} ${p.housenumber ?? ""}`.trim() : p.name;
          if (label) setSelection((s) => (s?.kind === "area" && s.object === obj ? { ...s, address: label } : s));
        })
        .catch(() => {});
    }
    return true;
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
      case "rol": {
        setMessage(t("search.searching"));
        const rolTxt = `${parsed.mz}-${parsed.pr}`;
        try {
          const cut = parsed.comuna ? comunas?.features.find((f) => f.properties.name === parsed.comuna)?.properties.code : undefined;
          const res = await fetch(`/api/rol?mz=${parsed.mz}&pr=${parsed.pr}${cut !== undefined ? `&cut=${cut}` : ""}`);
          const hits: RolHit[] = res.ok ? (await res.json()).hits ?? [] : [];
          if (!hits.length) {
            setMessage(t("search.rolNotFound", { rol: rolTxt }));
            return;
          }
          if (hits.length > 1) {
            const names = hits.map((h) => String(comunaByCode.get(String(h.cut))?.properties.name ?? h.cut));
            setMessage(t("search.rolMany", { rol: rolTxt, list: [...new Set(names)].join(", ") }));
            return;
          }
          const h = hits[0];
          if (h.lon === null || h.lat === null) {
            setMessage(t("search.rolNoGeo", { rol: rolTxt, dir: h.dir }));
            return;
          }
          const pt: [number, number] = [h.lon, h.lat];
          setMarker(pt);
          fly({ kind: "fly", center: pt, zoom: 17 });
          const osm = { rol: rolTxt, nr: 1, u: h.ds === "H" ? 1 : 0, ds: h.ds, dir: h.dir, m2u: h.m2 || "", yr: h.yr || "", av: h.av || "", how: h.how };
          if (!selectObject({ lngLat: pt, footprint: null, osm }, h.dir)) {
            setSelection(null);
            setMessage(t("search.outside"));
            return;
          }
          setMessage(null);
        } catch {
          setMessage(t("search.rolNotFound", { rol: rolTxt }));
        }
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
          fly({ kind: "fly", center: pt, zoom: 17 });
          if (!selectObject({ lngLat: pt, footprint: null, osm: {} }, label)) {
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
          <div className="at-layer-row">
            <label className="at-layer-label">
              <input type="radio" name="family" checked={family === "composite"} onChange={() => chooseFamily("composite")} />
              <span className="at-layer-dot at-composite-dot" />
              {t("families.composite")}
            </label>
          </div>
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
          onPickObject={(lngLat, footprint, osm) => {
            setMarker(null);
            selectObject({ lngLat, footprint, osm });
          }}
          objectShape={selection?.kind === "area" ? selection.object?.footprint ?? null : null}
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
              {selection.kind === "matches" ? t("drawer.matches") : selection.object ? t("object.eyebrow") : selection.address ? t("drawer.address") : selection.level === "D" ? t("drawer.zone") : t("drawer.territory")}
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
              <h2>{selection.address ?? (selection.object ? t("object.noAddress") : String(selection.comuna?.properties.name))}</h2>
              <p className="at-subline">
                {selection.address ? `${selection.comuna?.properties.name} · ` : ""}
                {selection.level === "D" ? `${t("drawer.zone")} ${selection.zone?.properties.id} · ` : ""}
                {t("drawer.region")}
              </p>
              {selection.object ? (
                <ObjectCard
                  lngLat={selection.object.lngLat}
                  footprint={selection.object.footprint}
                  osm={selection.object.osm}
                  zone={selection.zone?.properties}
                  comuna={selection.comuna?.properties}
                  title={selection.address ?? t("object.noAddress")}
                  zones={zones}
                  comunas={comunas}
                  price={prices?.comunas[String(selection.comuna?.properties.code)]}
                  pricePeriod={prices?.period}
                />
              ) : (
                <>
                  <AreaSummary zone={selection.zone} comuna={selection.comuna} metricId={metricId} zones={zones} comunas={comunas} locale={locale} />
                  <button type="button" className="at-primary at-more" onClick={() => setAreaOpen(true)}>{t("drawer.more")}</button>
                  <p className="pm-area-hint">{t("drawer.reportHint")} <ReportInfoButton /></p>
                </>
              )}
              {areaOpen && !selection.object && (
                <AreaModal onClose={() => setAreaOpen(false)} title={String(selection.comuna?.properties.name ?? "")} subtitle={selection.level === "D" ? `${t("drawer.zone")} ${selection.zone?.properties.id}` : t("drawer.region")}>
                  <PlaceValues zone={selection.zone} comuna={selection.comuna} locale={locale} prices={prices} />
                  <details className="at-evidence">
                    <summary className="at-area-h">{t("drawer.evidence")}</summary>
                    <Evidence />
                  </details>
                </AreaModal>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function Legend({ metricId, plan, period }: { metricId: string; plan: ReturnType<typeof planLayers>; period?: [string, string] }) {
  const t = useTranslations();
  const metric = getMetric(metricId, metricById);
  const ramp = rampFor(metric);
  const [lo, hi] = metric.domain;
  return (
    <div className="at-legend">
      <h3>{t(`metrics.${metric.id}`)}</h3>
      {plan.fillLevel ? (
        <>
          <div className="at-ramp">{ramp.map((c) => <span key={c} style={{ background: c }} />)}</div>
          <div className="at-ramp-labels">
            {metric.id === COMPOSITE_ID ? (
              <><span>{t("legend.worse")}</span><span /><span>{t("legend.better")}</span></>
            ) : (
              <><span>{lo}</span><span>{metric.unit}</span><span>{hi}</span></>
            )}
          </div>
          <p className="at-legend-scale">
            {t("legend.levelNow", { level: t(`levels.${plan.viewLevel}`) })} · <strong>{t("legend.dataAt", { level: t(`levels.${plan.fillLevel}`) })}</strong>
            {plan.isFallback && <><br />{t("legend.fallback", { level: t(`levels.${plan.fillLevel}`) })}</>}
          </p>
          {!metric.demo && metric.id === "EC02" && period && (
            <p className="at-legend-scale">{t("legend.ec02", { from: fmtDate(period[0]), to: fmtDate(period[1]) })}</p>
          )}
          {metric.id === COMPOSITE_ID && <p className="at-legend-scale">{t("legend.composite")}</p>}
          {metric.id === "IN04" && <p className="at-legend-scale">{t("legend.in04")}</p>}
          {metric.id === "IN01" && <p className="at-legend-scale">{t("legend.in01")}</p>}
          {metric.id === "SO01" && <p className="at-legend-scale">{t("legend.so01")}</p>}
          {metric.id === "EN03" && <p className="at-legend-scale">{t("legend.en03")}</p>}
          {metric.id === "EN04" && <p className="at-legend-scale">{t("legend.en04")}</p>}
          {(metric.id === "CL01" || metric.id === "CL03") && <p className="at-legend-scale">{t("legend.climate")}</p>}
          {metric.id === "RS03" && <p className="at-legend-scale">{t("legend.rs03")}</p>}
          {metric.id === "RS01" && <p className="at-legend-scale">{t("legend.rs01")}</p>}
          {metric.id === "EN01" && <p className="at-legend-scale">{t("legend.en01")}</p>}
          {["RS05", "RS07", "RS09"].includes(metric.id) && <p className="at-legend-scale">{t("legend.hazards")}</p>}
        </>
      ) : (
        <p className="at-legend-scale">{t("legend.noData")}</p>
      )}
    </div>
  );
}

/** the drawer's short view of a comuna/zone: the active layer with its rank, then a few key indicators */
const KEY_METRICS = ["EC02", "IN01", "RS01", "EN03", "EN04", "CL01"];
function AreaSummary({ zone, comuna, metricId, zones, comunas, locale }: { zone?: AreaFeature; comuna?: AreaFeature; metricId: string; zones: AreaCollection | null; comunas: AreaCollection | null; locale: string }) {
  const t = useTranslations();
  const pick = (id: string) => {
    const m = getMetric(id, metricById);
    const z = zone && m.levels.includes("D") ? (zone.properties[id] as number | undefined) : undefined;
    if (typeof z === "number") return { m, v: z, level: "D" as Level, all: zones };
    const c = comuna?.properties[id] as number | undefined;
    return typeof c === "number" ? { m, v: c, level: "C" as Level, all: comunas } : { m, v: undefined, level: "C" as Level, all: comunas };
  };
  const main = pick(metricId);
  const vals = main.v === undefined ? [] : (main.all?.features ?? []).map((f) => f.properties[metricId]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const pct = vals.length >= 5 && main.v !== undefined ? Math.round((100 * vals.filter((x) => x < main.v!).length) / vals.length) : null;
  return (
    <div className="at-area-sum">
      <div className="at-area-main" style={{ borderColor: familyById(main.m.family).color }}>
        <span>{t(`metrics.${metricId}`)}</span>
        <b>{formatValue(main.m, main.v, locale)}<small>{main.m.unit}</small></b>
        <small>{pct !== null ? t(`drawer.rankPct_${main.level}`, { pct }) : t("drawer.atLevel", { level: t(`levels.${main.level}`) })}{main.m.demo ? ` · ${t("drawer.status")}` : ""}</small>
      </div>
      {KEY_METRICS.filter((id) => id !== metricId).slice(0, 5).map((id) => {
        const k = pick(id);
        return (
          <div className="at-value-row at-area-row" key={id}>
            <span><i className="at-layer-dot" style={{ background: familyById(k.m.family).color }} />{t(`metrics.${id}`)}</span>
            <b>{formatValue(k.m, k.v, locale)}<small>{k.m.unit}</small></b>
          </div>
        );
      })}
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
                {m.id === "EN01" && comuna?.properties.EN01_st != null && (
                  <p>{t("drawer.airStation", { st: String(comuna.properties.EN01_st), v: String(comuna.properties.EN01_stv), km: String(comuna.properties.EN01_km) })}</p>
                )}
                {m.id === "RS01" && comuna?.properties.RS01_chg != null && (
                  <p>{t("drawer.crimeChange", { chg: (Number(comuna.properties.RS01_chg) > 0 ? "+" : "") + String(comuna.properties.RS01_chg), prop: String(comuna.properties.RS01_prop ?? "—") })}</p>
                )}
                {m.id === "RS03" && comuna?.properties.RS03_lo != null && (
                  <p>{t("drawer.enuscInterval", { lo: String(comuna.properties.RS03_lo), hi: String(comuna.properties.RS03_hi) })}</p>
                )}
                {m.id === "CL01" && comuna?.properties.CL01_d != null && (
                  <p>{t("drawer.hotFuture", { d: String(comuna.properties.CL01_d) })}</p>
                )}
                {m.id === "CL03" && comuna?.properties.CL03_d != null && (
                  <p>{t("drawer.rainFuture", { d: String(comuna.properties.CL03_d) })}</p>
                )}
                {m.id === "RS05" && zone?.properties.fault_km != null && (
                  <p>{t("drawer.faultKm", { km: String(zone.properties.fault_km) })}</p>
                )}
                {m.id === "EN03" && comuna?.properties.EN03_day65 != null && (
                  <p>{t("drawer.noiseExposure", { day: Math.round(Number(comuna.properties.EN03_day65) * 100), night: Math.round(Number(comuna.properties.EN03_night55) * 100) })}</p>
                )}
                {m.id === "IN01" && fromZone !== undefined && zone && (
                  <p>{ACCESS_GROUPS.map((g) => `${t(`drawer.acc_${g}`)} ${zone.properties[`IN01_${g}`] == null ? ">20" : `~${Math.round(Number(zone.properties[`IN01_${g}`]))}`} min`).join(" · ")}<br />{t("drawer.accNote")}</p>
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

