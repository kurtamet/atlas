"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ObjectReport, { type PriceInfo } from "./ObjectReport";
import { buildReportInput } from "@/lib/report/input";
import { requestReport } from "@/lib/report/client";
import type { AreaCollection } from "@/lib/geo";
import { pointFacts, observations, type PointFacts, type PoisFile, type HazardsFile, type Observation, type PoiGroup, type LngLat } from "@/lib/object/facts";

/** object context files are loaded once, on the first object card */
let ctxPromise: Promise<[PoisFile, HazardsFile]> | null = null;
const loadCtx = () =>
  (ctxPromise ??= Promise.all([fetch("/data/obj/pois.json").then((r) => r.json()), fetch("/data/obj/hazards.json").then((r) => r.json())]));

const GROUPS: PoiGroup[] = ["metro", "transport", "food", "pharmacy", "health", "park", "school"];

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
  const locale = useLocale();
  useEffect(() => {
    let live = true;
    loadCtx().then(([p, h]) => live && setFacts(pointFacts(lngLat, p, h))).catch(() => live && setFacts(null));
    return () => { live = false; };
  }, [lngLat]);

  const area = footprintArea(footprint);
  const height = Number(osm.render_height);
  const obs = facts ? observations(facts, { zone, comuna }) : null;
  const getReport = () => {
    if (!facts || !obs) return;
    requestReport(buildReportInput({ locale: locale === "en" ? "en" : "es", title, lngLat, area, height: Number.isFinite(height) && height > 0 ? height : undefined, facts, obs, zone, comuna, zones, comunas, price, pricePeriod }), locale);
  };
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
            <ul className="at-walk">
              {GROUPS.filter((g) => facts!.minutes[g] !== undefined).map((g) => (
                <li key={g}>
                  <span>{t(`g_${g}`)}{g === "metro" && facts!.metroName ? ` · ${facts!.metroName}` : ""}</span>
                  <b>{facts!.minutes[g]! > 60 ? ">60" : `~${facts!.minutes[g]}`} min</b>
                </li>
              ))}
            </ul>
            <small>{t("walkNote")}</small>
          </div>
          <div className="at-teaser">
            <span className="at-eyebrow">{t("teaserEyebrow")}</span>
            <strong>{hidden > 0 ? t("teaserMore", { n: hidden }) : t("teaserTitle")}</strong>
            <ul>
              <li>{t("teaserA")}</li>
              <li>{t("teaserB")}</li>
              <li>{t("teaserC")}</li>
            </ul>
            <button type="button" className="at-primary" onClick={getReport}>{t("teaserCta")}</button>
            <small>{t("teaserNote")}</small>
          </div>
        </>
      )}
      {obs && (
        <button type="button" className="at-secondary at-more" onClick={() => setOpen(true)}>{t("more")}</button>
      )}
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
      <p className="at-family-head" style={{ marginTop: 18 }}>{t("context")}</p>
    </div>
  );
}
