/**
 * Data tables and inline values for blog articles, computed from the comuna dataset at build time,
 * so an article's numbers move with the data instead of going stale.
 *
 * Inline: {{Hd:nunoa}} type median, {{IN04:santiago}} metric value, {{rank:Hd:nunoa}}, {{n:Hd:nunoa}},
 * {{rm:Hd}} region median, {{rmn:Hd}} region sales, {{from}} / {{to}} price window, {{total}} comunas.
 */
import type { Dataset, Profile, TypeKey } from "./comunas.ts";
import { TYPE_KEYS } from "./comunas.ts";
import { METRICS } from "../layers/registry.ts";
import type { Locale } from "./site.ts";
import { fmt, monthYear } from "./format.ts";

export type Cell = string | { text: string; href: string };
export interface DataTable { caption: string; head: string[]; rows: Cell[][]; note?: string }

const isType = (k: string): k is TypeKey => (TYPE_KEYS as readonly string[]).includes(k);
const decimalsOf = (id: string) => (id === "QX00" ? 0 : METRICS.find((m) => m.id === id)?.decimals ?? 0);
const typeVal = (l: Locale, v: number) => fmt(l, v, v < 100 ? 1 : 0);

export function inlineValue(token: string, ds: Dataset, l: Locale): string | null {
  const parts = token.split(":");
  const by = (slug: string): Profile | undefined => ds.profiles.find((p) => p.slug === slug);
  if (parts[0] === "from") return monthYear(l, ds.period[0]);
  if (parts[0] === "to") return monthYear(l, ds.period[1]);
  if (parts[0] === "total") return String(ds.total);
  if (parts[0] === "rm" && isType(parts[1])) return ds.rm[parts[1]] ? typeVal(l, ds.rm[parts[1]]!.med) : null;
  if (parts[0] === "rmn" && isType(parts[1])) return ds.rm[parts[1]] ? fmt(l, ds.rm[parts[1]]!.n) : null;
  if (parts[0] === "rank" && parts.length === 3) {
    const r = by(parts[2])?.ranks[parts[1]];
    return r ? String(r) : null;
  }
  if (parts[0] === "n" && isType(parts[1])) {
    const s = by(parts[2])?.types[parts[1]];
    return s ? fmt(l, s.n) : null;
  }
  if (parts.length === 2) {
    const p = by(parts[1]);
    if (!p) return null;
    if (isType(parts[0])) return p.types[parts[0]] ? typeVal(l, p.types[parts[0]]!.med) : null;
    const v = p.values[parts[0]];
    return typeof v === "number" ? fmt(l, v, decimalsOf(parts[0])) : null;
  }
  return null;
}

const link = (p: Profile): Cell => ({ text: p.name, href: `/comunas/${p.slug}` });
const dash = "–";

export function dataTable(key: string, ds: Dataset, l: Locale): DataTable | null {
  const es = l === "es";
  const P = ds.profiles;
  const f = (v: number | undefined, d = 0) => (typeof v === "number" ? fmt(l, v, d) : dash);
  const window = `${monthYear(l, ds.period[0])}–${monthYear(l, ds.period[1])}`;
  switch (key) {
    case "apartments":
    case "houses": {
      const t: TypeKey = key === "apartments" ? "Hd" : "Hc";
      const rows = P.filter((p) => p.types[t]).sort((a, b) => b.types[t]!.med - a.types[t]!.med);
      return {
        caption: es ? `${key === "apartments" ? "Departamentos" : "Casas"}: UF por m² construido, compraventas ${window}` : `${key === "apartments" ? "Apartments" : "Houses"}: UF per built m², sales ${window}`,
        head: ["#", es ? "Comuna" : "Comuna", es ? "Mediana UF/m²" : "Median UF/m²", es ? "Rango típico (p25–p75)" : "Typical range (p25–p75)", es ? "Ventas" : "Sales"],
        rows: rows.map((p, i) => {
          const s = p.types[t]!;
          return [String(i + 1), link(p), f(s.med, 1), `${f(s.p25, 1)}–${f(s.p75, 1)}`, f(s.n)];
        }),
        note: es ? "Fuente: SII (F2890 + Detalle Catastral 2026-2), cálculo PROMETEO. Medianas por comuna, sin datos personales." : "Source: SII (F2890 + Detalle Catastral 2026-2), PROMETEO calculation. Comuna medians, no personal data.",
      };
    }
    case "transit-value": {
      const rows = P.filter((p) => p.types.Hd && p.values.IN04 !== undefined).sort((a, b) => b.values.IN04 - a.values.IN04).slice(0, 15);
      return {
        caption: es ? "Las 15 comunas con más transporte público en hora punta y su precio por m²" : "The 15 comunas with the most peak-hour public transport and their price per m²",
        head: [es ? "Comuna" : "Comuna", es ? "Salidas/h (7–9 h)" : "Departures/h (7–9 am)", es ? "Deptos UF/m²" : "Apts UF/m²", es ? "Índice general" : "Overall score"],
        rows: rows.map((p) => [link(p), f(p.values.IN04), f(p.types.Hd!.med, 1), f(p.values.QX00)]),
        note: es ? "Transporte: DTPM GTFS, salidas de buses y metro a menos de 500 m de cada edificio, promedio ponderado por edificios." : "Transit: DTPM GTFS, bus and metro departures within 500 m of each building, building-weighted mean.",
      };
    }
    case "value-score": {
      const rows = P.filter((p) => p.types.Hd && p.values.QX00 !== undefined)
        .map((p) => ({ p, ratio: p.values.QX00 / p.types.Hd!.med }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 12);
      return {
        caption: es ? "Más índice general por cada UF/m²: las 12 comunas con mejor relación calidad-precio" : "Most overall score per UF/m²: the 12 comunas with the best value for money",
        head: [es ? "Comuna" : "Comuna", es ? "Índice general" : "Overall score", es ? "Deptos UF/m²" : "Apts UF/m²", es ? "Puntos por cada 10 UF/m²" : "Points per 10 UF/m²"],
        rows: rows.map(({ p, ratio }) => [link(p), f(p.values.QX00), f(p.types.Hd!.med, 1), f(ratio * 10, 1)]),
      };
    }
    case "score": {
      const rows = P.filter((p) => p.values.QX00 !== undefined).sort((a, b) => b.values.QX00 - a.values.QX00);
      return {
        caption: es ? "Índice general PROMETEO por comuna (0–100)" : "PROMETEO overall score by comuna (0–100)",
        head: ["#", "Comuna", es ? "Índice" : "Score", es ? "Deptos UF/m²" : "Apts UF/m²"],
        rows: rows.map((p, i) => [String(i + 1), link(p), f(p.values.QX00), f(p.types.Hd?.med, 1)]),
      };
    }
    case "hazards": {
      const rows = P.filter((p) => p.values.RS07 !== undefined).sort((a, b) => b.values.RS07 + b.values.RS09 - (a.values.RS07 + a.values.RS09));
      return {
        caption: es ? "Porcentaje de residentes en zonas de amenaza natural, por comuna" : "Share of residents in natural hazard zones, by comuna",
        head: ["Comuna", es ? "Inundación" : "Flooding", es ? "Remoción en masa" : "Landslides", es ? "Suelo sísmico muy malo" : "Very poor seismic soil"],
        rows: rows.map((p) => [link(p), `${f(p.values.RS07)}%`, `${f(p.values.RS09)}%`, `${f(p.values.RS05)}%`]),
        note: es ? "Fuente: MINVU, capa OTRAS_AMENAZAS_RMS (Plan Regulador Metropolitano y estudios de amenaza), cruzada con población del Censo 2024 por manzana." : "Source: MINVU OTRAS_AMENAZAS_RMS layer (Metropolitan Zoning Plan and hazard studies), crossed with Census 2024 population by block.",
      };
    }
    case "environment": {
      const rows = P.filter((p) => p.values.EN04 !== undefined).sort((a, b) => b.values.EN04 - a.values.EN04);
      return {
        caption: es ? "Vegetación, ruido y aire por comuna (ordenado de más a menos verde)" : "Vegetation, noise and air by comuna (greenest first)",
        head: ["Comuna", "NDVI", es ? "Ruido día (dBA)" : "Day noise (dBA)", "PM2.5 (µg/m³)"],
        rows: rows.map((p) => [link(p), f(p.values.EN04, 2), f(p.values.EN03), f(p.values.EN01, 1)]),
        note: es ? "NDVI: Sentinel-2, enero 2026. Ruido: MMA 2023. PM2.5: SINCA 2023–2025, interpolado entre estaciones." : "NDVI: Sentinel-2, January 2026. Noise: Ministry of Environment 2023. PM2.5: SINCA 2023–2025, interpolated between stations.",
      };
    }
    default:
      return null;
  }
}
