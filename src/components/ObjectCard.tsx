"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ObjectReport, { type PriceInfo } from "./ObjectReport";
import { buildReportInput } from "@/lib/report/input";
import { catastroOf } from "@/lib/object/catastro";
import { ACCESSORY, KINDS, loadTypePrices, mainKind, mixOf, unitKind, unitLabel, valuation, type TypePricesFile, type Unit } from "@/lib/object/units";
import UnitPicker from "./UnitPicker";
import BuyReport from "./commerce/BuyReport";
import { ReportInfoButton } from "./commerce/ReportInfo";
import type { AreaCollection } from "@/lib/geo";
import { pointFacts, observations, type PointFacts, type PoisFile, type HazardsFile, type Observation, type LngLat } from "@/lib/object/facts";

/** object context files are loaded once, on the first object card */
let ctxPromise: Promise<[PoisFile, HazardsFile]> | null = null;
const loadCtx = () =>
  (ctxPromise ??= Promise.all([fetch("/data/obj/pois.json").then((r) => r.json()), fetch("/data/obj/hazards.json").then((r) => r.json())]));


/** footprint area in m² (local projection, shoelace) */
export function footprintArea(g: GeoJSON.Geometry | null): number | null {
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let area = 0;
  for (const poly of polys)
    poly.forEach((ring, i) => {
      const lat0 = ring[0][1], kx = 111_320 * Math.cos((lat0 * Math.PI) / 180), ky = 110_574;
      let s = 0;
      for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) s += (ring[k][0] * kx) * (ring[j][1] * ky) - (ring[j][0] * kx) * (ring[k][1] * ky);
      area += (i === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  return Math.round(area);
}

export default function ObjectCard({ lngLat, footprint, osm, zone, comuna, title, zones, comunas, price, pricePeriod }: {
  lngLat: LngLat;
  footprint: GeoJSON.Geometry | null;
  osm: Record<string, string | number>;
  zone?: Record<string, unknown>;
  comuna?: Record<string, unknown>;
  title: string;
  zones: AreaCollection | null;
  comunas: AreaCollection | null;
  price?: PriceInfo;
  pricePeriod?: [string, string];
}) {
  const t = useTranslations("object");
  const [facts, setFacts] = useState<PointFacts | null>(null);
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [fetched, setFetched] = useState<{ key: string; units: Unit[] } | null>(null);
  const [picked, setPicked] = useState<{ key: string; unit: Unit | null } | null>(null);
  const [picking, setPicking] = useState<"card" | "buy" | null>(null);
  const [typePrices, setTypePrices] = useState<TypePricesFile | null>(null);
  const locale = useLocale();
  const cat = catastroOf(osm);
  const rolKey = osm.rol ? String(osm.rol) : null;
  const objKey = rolKey ?? `${lngLat[0]},${lngLat[1]}`;
  useEffect(() => { loadTypePrices().then(setTypePrices); }, []);
  // the SII rols of this building (a rol search hit is one known unit, built below)
  const hasCat = Boolean(cat);
  useEffect(() => {
    if (rolKey || !hasCat) return;
    let live = true;
    const key = `${lngLat[0]},${lngLat[1]}`;
    const rings = footprint?.type === "Polygon" ? [footprint.coordinates[0]] : footprint?.type === "MultiPolygon" ? footprint.coordinates.map((p) => p[0]) : [];
    fetch("/api/units", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lng: lngLat[0], lat: lngLat[1], rings }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { units?: Unit[] } | null) => { if (live && d?.units) setFetched({ key, units: d.units }); })
      .catch(() => {});
    return () => { live = false; };
  }, [lngLat, footprint, rolKey, hasCat]);
  const rolUnit: Unit | null = rolKey
    ? { rol: rolKey, cut: Number(comuna?.code ?? 0), dir: String(osm.dir ?? ""), ds: String(osm.ds ?? ""), kind: unitKind(String(osm.ds ?? ""), String(osm.dir ?? "")), m2: Number(osm.m2u) || 0, yr: Number(osm.yr) || 0, av: Number(osm.av) || 0 }
    : null;
  const units = rolUnit ? [rolUnit] : fetched?.key === objKey ? fetched.units : null;
  // a house or a single shop: the report is about that unit without asking
  const mainUnits = units?.filter((u) => !ACCESSORY.has(u.kind)) ?? [];
  const unit = picked?.key === objKey ? picked.unit : rolUnit ?? (mainUnits.length === 1 ? mainUnits[0] : null);
  const setUnit = (u: Unit | null) => setPicked({ key: objKey, unit: u });
  useEffect(() => {
    let live = true;
    loadCtx().then(([p, h]) => live && setFacts(pointFacts(lngLat, p, h))).catch(() => live && setFacts(null));
    return () => { live = false; };
  }, [lngLat]);

  const area = footprintArea(footprint);
  const height = Number(osm.render_height);
  const obs = facts ? observations(facts, { zone, comuna }) : null;
  const mix = units?.length ? mixOf(units) : null;
  // kind of what the report is about: the picked unit, else the building's main kind (tile fallback: homes)
  const kind = unit?.kind ?? (mix ? mainKind(mix) : cat?.ds === "H" ? null : cat?.ds ? unitKind(cat.ds) : null);
  const where = { zone: zone ? String(zone.id) : null, cut: comuna?.code as string | number | undefined };
  const bench = valuation(typePrices, kind, where);
  const makeInput = () => {
    if (!facts || !obs) return null;
    return buildReportInput({
      locale: locale === "en" ? "en" : "es", title: unit && !rolKey ? `${title} · ${unitLabel(unit.dir)}` : title, lngLat, area, height: Number.isFinite(height) && height > 0 ? height : undefined, facts, obs, zone, comuna, zones, comunas, price, pricePeriod,
      catastro: cat ? { ...cat, ...(osm.rol ? { rol: String(osm.rol) } : {}) } : null,
      unit, mix, valuation: valuation(typePrices, kind, where, unit?.m2),
    });
  };
  const canPick = (units?.length ?? 0) > 1;
  const unitLine = (u: Unit) => [t(`unit.kind_${u.kind}`), unitLabel(u.dir) !== u.dir || !rolKey ? unitLabel(u.dir) : null, u.m2 ? t("cat.m2", { m2: u.m2 }) : null, u.yr ? t("cat.year", { y: u.yr }) : null].filter(Boolean).join(" · ");
  const unitSlot = canPick ? (
    <div className="pm-unit-pick">
      <div><small>{t("unit.reportFor")}</small><b>{unit ? unitLine(unit) : t("unit.wholeBuilding")}</b></div>
      <button type="button" className="at-secondary" onClick={() => { setBuying(false); setPicking("buy"); }}>{t(unit ? "unit.change" : "unit.pick")}</button>
    </div>
  ) : null;
  const getReport = () => setBuying(true);
  // teaser: the card shows the first findings; the paid report explains all of them
  const SHOWN = 2;
  const hidden = obs ? Math.max(0, obs.cons.length - SHOWN) + Math.max(0, obs.pros.length - SHOWN) : 0;
  const lvl = (o: Observation) => t(`lvl_${o.level}`);
  const item = (o: Observation) => (
    <li key={o.key}>
      {t(`obs.${o.key}`, o.params ?? {})} <small className="at-obs-level">{lvl(o)}</small>
    </li>
  );

  return (
    <div className="at-object">
      <div className="at-observation">
        <strong>{t("identified")}</strong>
        <p>
          {footprint ? t("building", { area: area ?? "?" }) : t("pointOnly")}
          {footprint && Number.isFinite(height) && height > 0 ? ` ${t("height", { h: Math.round(height) })}` : ""}
          <br />
          <small>{t("identityNote")}</small>
        </p>
      </div>

      {cat && (
        <div className="at-observation">
          <strong>{osm.rol ? t("cat.titleRol", { rol: String(osm.rol) }) : t("cat.title")}</strong>
          <p>
            {mix && !rolKey
              ? KINDS.filter((k) => mix[k]).map((k) => t(`unit.kinds_${k}`, { n: mix[k]! })).join(" · ")
              : [
                  t.has(`cat.ds_${cat.ds}`) ? t(`cat.ds_${cat.ds}`) : null,
                  cat.u > 1 ? t("cat.units", { n: cat.u }) : null,
                  cat.yr ? t("cat.year", { y: cat.yr }) : null,
                  cat.m2u ? t(cat.u > 1 ? "cat.m2unit" : "cat.m2", { m2: cat.m2u }) : null,
                ].filter(Boolean).join(" · ")}
            {mix && !rolKey && cat.yr ? <><br />{t("cat.year", { y: cat.yr })}{cat.m2u ? ` · ${t("cat.m2unit", { m2: cat.m2u })}` : ""}</> : null}
            {unit && <><br /><b>{t("unit.selected")}</b> {unitLine(unit)}</>}
            {unit?.av && !rolKey ? <><br />{t("cat.avaluoRol", { uf: unit.av.toLocaleString(locale) })}</> : cat.av ? <><br />{t(osm.rol ? "cat.avaluoRol" : "cat.avaluo", { uf: cat.av.toLocaleString(locale) })}</> : null}
            {cat.ufm2 && cat.nd ? <><br />{t("cat.sales", { ufm2: Math.round(cat.ufm2), n: cat.nd })}</> : null}
            {bench && (
              <><br />{t(`unit.bench_${bench.basis}`, { kind: t(`unit.kindsGen_${bench.kind}`), where: t(`unit.where_${bench.level}`), med: bench.med.toLocaleString(locale), p25: bench.p25.toLocaleString(locale), p75: bench.p75.toLocaleString(locale), n: bench.n.toLocaleString(locale) })}</>
            )}
            <br />
            <small>{osm.rol ? t(osm.how === "m" ? "cat.noteRolMz" : "cat.noteRol") : t("cat.note")}</small>
          </p>
          {canPick && (
            <button type="button" className="at-secondary at-unit-btn" onClick={() => setPicking("card")}>{t(unit ? "unit.change" : "unit.pickCard")}</button>
          )}
        </div>
      )}

      {!obs && <p className="at-subline">{t("loading")}</p>}
      {obs && (
        <>
          {obs.cons.length > 0 && (
            <div className="at-observation at-obs-cons">
              <strong>{t("cons")}</strong>
              <ul>{obs.cons.slice(0, SHOWN).map(item)}</ul>
            </div>
          )}
          {obs.pros.length > 0 && (
            <div className="at-observation at-obs-pros">
              <strong>{t("pros")}</strong>
              <ul>{obs.pros.slice(0, SHOWN).map(item)}</ul>
            </div>
          )}
          <div className="at-observation">
            <strong>{t("walk")}</strong>
            <p className="at-walk-line">
              {(["metro", "food", "park"] as const).filter((g) => facts!.minutes[g] !== undefined)
                .map((g) => `${t(`g_${g}`)} ${facts!.minutes[g]! > 60 ? ">60" : `~${facts!.minutes[g]}`} min`).join(" · ")}
            </p>
          </div>
          <button type="button" className="at-secondary at-more" onClick={() => setOpen(true)}>{t("more")}</button>
          <div className="at-teaser">
            <strong>{hidden > 0 ? t("teaserMore", { n: hidden }) : t("teaserTitle")}</strong>
            <p className="pm-teaser-line">{unit && valuation(typePrices, kind, where, unit.m2)?.estimate ? t("unit.teaserValue", { unit: unitLabel(unit.dir) }) : t("teaserLine")}</p>
            <div className="pm-cta-row">
              <button type="button" className="at-primary" onClick={getReport}>{t("teaserCta")}</button>
              <ReportInfoButton />
            </div>
          </div>
        </>
      )}
      {buying && <BuyReport title={unit && !rolKey ? `${title} · ${unitLabel(unit.dir)}` : title} makeInput={makeInput} unitSlot={unitSlot} onClose={() => setBuying(false)} />}
      {picking && units && <UnitPicker units={units} value={unit} onPick={setUnit} onClose={() => { if (picking === "buy") setBuying(true); setPicking(null); }} />}
      {open && facts && obs && (
        <ObjectReport
          onClose={() => setOpen(false)}
          title={title}
          lngLat={lngLat}
          area={area}
          height={Number.isFinite(height) && height > 0 ? height : undefined}
          hasFootprint={!!footprint}
          facts={facts}
          obs={obs}
          zone={zone}
          comuna={comuna}
          zones={zones}
          comunas={comunas}
          price={price}
          pricePeriod={pricePeriod}
          onReport={getReport}
        />
      )}
    </div>
  );
}
