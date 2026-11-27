/**
 * Deterministic ES/EN text for a comuna profile. The same sentences feed the comuna page, its FAQ
 * structured data and llms-full.txt, so what search engines and AI assistants read is exactly what
 * a visitor sees.
 */
import type { Dataset, Profile, TypeKey } from "./comunas.ts";
import type { Locale } from "./site.ts";
import { fmt, monthYear } from "./format.ts";

export const TYPE_LABEL: Record<Locale, Record<TypeKey, string>> = {
  es: { Hd: "Departamentos", Hc: "Casas", O: "Oficinas", C: "Locales comerciales", I: "Bodegas e industria", W: "Terrenos", Z: "Estacionamientos", L: "Bodegas (unidades)" },
  en: { Hd: "Apartments", Hc: "Houses", O: "Offices", C: "Retail units", I: "Warehouses and industrial", W: "Land", Z: "Parking spaces", L: "Storage units" },
};
export const TYPE_UNIT: Record<Locale, Record<TypeKey, string>> = {
  es: { Hd: "UF/m² construido", Hc: "UF/m² construido", O: "UF/m² construido", C: "UF/m² construido", I: "UF/m² construido", W: "UF/m² de terreno", Z: "UF por unidad", L: "UF por unidad" },
  en: { Hd: "UF/m² built", Hc: "UF/m² built", O: "UF/m² built", C: "UF/m² built", I: "UF/m² built", W: "UF/m² of land", Z: "UF per unit", L: "UF per unit" },
};

export interface Fact { label: string; value: string; note?: string }
export interface Section { id: string; title: string; paragraphs: string[]; facts: Fact[] }
export interface ComunaCopy {
  title: string;
  metaTitle: string;
  description: string;
  summary: string[];
  keyFacts: Fact[];
  sections: Section[];
  faq: Array<{ q: string; a: string }>;
}

const share = (l: Locale, v: number) => {
  if (v < 0.5) return l === "es" ? "prácticamente sin residentes expuestos" : "practically no residents exposed";
  if (v < 10) return l === "es" ? "exposición baja" : "low exposure";
  if (v < 30) return l === "es" ? "exposición moderada" : "moderate exposure";
  return l === "es" ? "exposición alta" : "high exposure";
};

/** rank → "alto / medio / bajo" in thirds of the comunas */
const tier = (l: Locale, rank: number, total: number, words: [string, string, string]) => (rank <= total / 3 ? words[0] : rank <= (2 * total) / 3 ? words[1] : words[2]);

export function comunaCopy(p: Profile, ds: Dataset, l: Locale): ComunaCopy {
  const es = l === "es";
  const N = ds.total;
  const v = p.values;
  const f = (x: number, d = 0) => fmt(l, x, d);
  const from = monthYear(l, ds.period[0]), to = monthYear(l, ds.period[1]);
  const hd = p.types.Hd, hc = p.types.Hc;
  const q = v.QX00;

  const title = es ? `${p.name}: precio del m², riesgos y calidad de vida` : `${p.name}, Santiago: price per m², hazards and livability`;
  const metaTitle = es ? `${p.name}: precio m² 2026, riesgos, transporte y entorno` : `${p.name} (Santiago) price per m² 2026, hazards, transit`;

  const priceLine = hd
    ? es
      ? `En ${p.name}, los departamentos se vendieron a una mediana de ${f(hd.med, 1)} UF/m² construido entre ${from} y ${to} (${f(hd.n)} compraventas registradas en el SII), puesto ${p.ranks.Hd} de ${N} comunas del Gran Santiago.`
      : `In ${p.name}, apartments sold at a median of ${f(hd.med, 1)} UF per built m² between ${from} and ${to} (${f(hd.n)} sales recorded by Chile's tax service SII), rank ${p.ranks.Hd} of ${N} comunas in Greater Santiago.`
    : "";
  const houseLine = hc ? (es ? ` Las casas: ${f(hc.med, 1)} UF/m² (puesto ${p.ranks.Hc}).` : ` Houses: ${f(hc.med, 1)} UF/m² (rank ${p.ranks.Hc}).`) : "";
  const scoreLine =
    q !== undefined
      ? es
        ? `Su índice general PROMETEO, que combina entorno, acceso, clima y riesgos, es ${q}/100 (puesto ${p.ranks.QX00} de ${N}).`
        : `Its PROMETEO overall score, combining environment, access, climate and hazards, is ${q}/100 (rank ${p.ranks.QX00} of ${N}).`
      : "";
  const summary = [priceLine + houseLine, scoreLine].filter(Boolean);

  const description = es
    ? `${p.name}${hd ? `: departamentos a ${f(hd.med, 1)} UF/m²` : ""}${hc ? `, casas a ${f(hc.med, 1)} UF/m²` : ""} (SII ${from}–${to}). Riesgo de inundación, ruido, áreas verdes, transporte y seguridad comparados con las ${N} comunas.`
    : `${p.name}${hd ? `: apartments at ${f(hd.med, 1)} UF/m²` : ""}${hc ? `, houses at ${f(hc.med, 1)} UF/m²` : ""} (SII ${from}–${to}). Flood risk, noise, green space, transit and safety compared across ${N} comunas.`;

  const keyFacts: Fact[] = [];
  if (hd) keyFacts.push({ label: es ? "Departamentos" : "Apartments", value: `${f(hd.med, 1)} UF/m²`, note: es ? `puesto ${p.ranks.Hd}/${N}` : `rank ${p.ranks.Hd}/${N}` });
  if (hc) keyFacts.push({ label: es ? "Casas" : "Houses", value: `${f(hc.med, 1)} UF/m²`, note: es ? `puesto ${p.ranks.Hc}/${N}` : `rank ${p.ranks.Hc}/${N}` });
  if (p.deals) keyFacts.push({ label: es ? "Compraventa mediana" : "Median sale", value: `${f(p.deals.median)} UF`, note: es ? "todos los tipos" : "all property types" });
  if (q !== undefined) keyFacts.push({ label: es ? "Índice general" : "Overall score", value: `${q}/100`, note: es ? `puesto ${p.ranks.QX00}/${N}` : `rank ${p.ranks.QX00}/${N}` });
  if (p.pop) keyFacts.push({ label: es ? "Población" : "Population", value: f(p.pop), note: "Censo 2024" });
  if (v.SO01 !== undefined) keyFacts.push({ label: es ? "Densidad" : "Density", value: `${f(v.SO01)} ${es ? "hab/km²" : "people/km²"}` });

  const sections: Section[] = [];

  // prices
  const priceFacts: Fact[] = [];
  for (const t of ["Hd", "Hc", "O", "C", "W", "Z", "L"] as TypeKey[]) {
    const s = p.types[t];
    if (!s) continue;
    const rm = ds.rm[t];
    const diff = rm ? Math.round(((s.med - rm.med) / rm.med) * 100) : null;
    priceFacts.push({
      label: TYPE_LABEL[l][t],
      value: `${f(s.med, s.med < 100 ? 1 : 0)} ${TYPE_UNIT[l][t]}`,
      note: `${es ? "rango típico" : "typical range"} ${f(s.p25, s.p25 < 100 ? 1 : 0)}–${f(s.p75, s.p75 < 100 ? 1 : 0)} · ${f(s.n)} ${es ? "ventas" : "sales"}${diff !== null ? ` · ${diff >= 0 ? "+" : ""}${diff}% ${es ? "vs. RM" : "vs. region"}` : ""}`,
    });
  }
  sections.push({
    id: "precios",
    title: es ? `Precio del m² en ${p.name}` : `Price per m² in ${p.name}`,
    paragraphs: [
      es
        ? `Medianas de compraventas inscritas entre ${from} y ${to}, calculadas por PROMETEO cruzando el registro de transacciones del SII (formulario F2890) con la superficie del Catastro de Bienes Raíces. El rango típico es el intervalo entre el percentil 25 y el 75.`
        : `Medians of sales recorded between ${from} and ${to}, computed by PROMETEO by joining SII transaction records (form F2890) with the built area from the national property register (Catastro). The typical range is the 25th to 75th percentile.`,
    ],
    facts: priceFacts,
  });

  // transit and services
  const acc: Fact[] = [];
  const accP: string[] = [];
  if (v.IN04 !== undefined) {
    acc.push({ label: es ? "Salidas de transporte público (7–9 h)" : "Public transport departures (7–9 am)", value: `${f(v.IN04)} ${es ? "por hora" : "per hour"}`, note: es ? `puesto ${p.ranks.IN04}/${N}` : `rank ${p.ranks.IN04}/${N}` });
    accP.push(
      es
        ? `En hora punta de la mañana pasan en promedio ${f(v.IN04)} salidas de buses y metro por hora a menos de 500 m de cada edificio, una oferta ${tier(l, p.ranks.IN04, N, ["alta", "media", "baja"])} para Santiago.`
        : `In the morning peak an average of ${f(v.IN04)} bus and metro departures per hour stop within 500 m of each building, a ${tier(l, p.ranks.IN04, N, ["high", "medium", "low"])} level for Santiago.`,
    );
  }
  if (v.IN01 !== undefined) {
    acc.push({ label: es ? "Servicios cotidianos a pie" : "Daily services on foot", value: `${f(v.IN01)}/100`, note: es ? `puesto ${p.ranks.IN01}/${N}` : `rank ${p.ranks.IN01}/${N}` });
    accP.push(
      es
        ? `El índice de servicios a pie (comercio de alimentos, salud, farmacias y paraderos a menos de 5–20 minutos caminando) es ${f(v.IN01)}/100.`
        : `The walkable services index (groceries, health, pharmacies and transit stops within a 5–20 minute walk) is ${f(v.IN01)}/100.`,
    );
  }
  if (acc.length) sections.push({ id: "transporte", title: es ? "Transporte y servicios" : "Transit and services", paragraphs: accP, facts: acc });

  // environment
  const env: Fact[] = [];
  const envP: string[] = [];
  if (v.EN03 !== undefined) env.push({ label: es ? "Ruido de tránsito diurno" : "Daytime traffic noise", value: `${f(v.EN03)} dBA`, note: es ? `puesto ${p.ranks.EN03}/${N} (1 = más ruidosa)` : `rank ${p.ranks.EN03}/${N} (1 = loudest)` });
  if (v.EN04 !== undefined) env.push({ label: es ? "Vegetación (NDVI)" : "Vegetation (NDVI)", value: f(v.EN04, 2), note: es ? `puesto ${p.ranks.EN04}/${N} (1 = más verde)` : `rank ${p.ranks.EN04}/${N} (1 = greenest)` });
  if (v.EN01 !== undefined) env.push({ label: "PM2.5", value: `${f(v.EN01, 1)} µg/m³`, note: es ? "promedio anual 2023–2025" : "annual mean 2023–2025" });
  if (v.CL01 !== undefined) env.push({ label: es ? "Días sobre 30 °C" : "Days above 30 °C", value: `${f(v.CL01)} ${es ? "al año" : "per year"}`, note: "ARClim 1980–2010" });
  if (v.EN04 !== undefined && v.EN03 !== undefined)
    envP.push(
      es
        ? `${p.name} es una comuna ${tier(l, p.ranks.EN04, N, ["más verde que el promedio", "de vegetación media", "con poca vegetación"])} y ${tier(l, p.ranks.EN03, N, ["de las más ruidosas", "de ruido medio", "de las más tranquilas"])} del Gran Santiago, según imágenes Sentinel-2 y el Mapa de Ruido del Ministerio del Medio Ambiente.`
        : `${p.name} is ${tier(l, p.ranks.EN04, N, ["greener than average", "of average greenery", "low in vegetation"])} and ${tier(l, p.ranks.EN03, N, ["among the loudest", "of average noise", "among the quietest"])} comunas of Greater Santiago, based on Sentinel-2 imagery and the Ministry of Environment noise map.`,
    );
  if (env.length) sections.push({ id: "entorno", title: es ? "Medio ambiente" : "Environment", paragraphs: envP, facts: env });

  // hazards
  const hz: Fact[] = [];
  const hzP: string[] = [];
  if (v.RS07 !== undefined) {
    hz.push({ label: es ? "Residentes en zonas de inundación" : "Residents in flood zones", value: `${f(v.RS07)}%`, note: share(l, v.RS07) });
    hzP.push(
      es
        ? `${f(v.RS07)}% de los residentes vive dentro de zonas de inundación definidas por el Plan Regulador Metropolitano y los estudios de amenaza del MINVU (${share(l, v.RS07)}).`
        : `${f(v.RS07)}% of residents live inside flood zones defined by the Metropolitan Zoning Plan and MINVU hazard studies (${share(l, v.RS07)}).`,
    );
  }
  if (v.RS09 !== undefined) hz.push({ label: es ? "Residentes en zonas de remoción en masa" : "Residents in landslide zones", value: `${f(v.RS09)}%`, note: share(l, v.RS09) });
  if (v.RS05 !== undefined) hz.push({ label: es ? "Suelo de muy mala respuesta sísmica" : "Very poor seismic soil", value: `${f(v.RS05)}%`, note: share(l, v.RS05) });
  hzP.push(
    es
      ? "Es una referencia a escala de comuna: el riesgo de una dirección concreta depende de su manzana, por eso el mapa y el informe lo muestran por zona y edificio."
      : "This is a comuna-level reference: the risk of a specific address depends on its block, which is why the map and the report show it by zone and building.",
  );
  if (hz.length) sections.push({ id: "riesgos", title: es ? "Riesgos naturales" : "Natural hazards", paragraphs: hzP, facts: hz });

  // safety
  const sf: Fact[] = [];
  const sfP: string[] = [];
  if (v.RS01 !== undefined) {
    const chg = p.extras.RS01_chg;
    sf.push({ label: es ? "Delitos violentos registrados" : "Recorded violent crime", value: `${f(v.RS01)} ${es ? "por 100 mil hab." : "per 100k people"}`, note: `CEAD 2025${typeof chg === "number" ? ` · ${chg >= 0 ? "+" : ""}${chg}% ${es ? "vs. 2024" : "vs. 2024"}` : ""}` });
    sfP.push(
      es
        ? `La tasa de casos policiales por delitos violentos es ${tier(l, p.ranks.RS01, N, ["de las más altas", "intermedia", "de las más bajas"])} entre las ${N} comunas (puesto ${p.ranks.RS01}, donde 1 es la tasa más alta).`
        : `The rate of police cases for violent crime is ${tier(l, p.ranks.RS01, N, ["among the highest", "intermediate", "among the lowest"])} of the ${N} comunas (rank ${p.ranks.RS01}, where 1 is the highest rate).`,
    );
  }
  if (v.RS03 !== undefined) sf.push({ label: es ? "Hogares víctimas de delitos violentos" : "Households victim of violent crime", value: `${f(v.RS03, 1)}%`, note: "ENUSC 2024" });
  if (sf.length) sections.push({ id: "seguridad", title: es ? "Seguridad" : "Safety", paragraphs: sfP, facts: sf });

  const faq: ComunaCopy["faq"] = [];
  if (hd)
    faq.push({
      q: es ? `¿Cuánto cuesta el metro cuadrado en ${p.name}?` : `How much does a square metre cost in ${p.name}?`,
      a: es
        ? `Según compraventas del SII entre ${from} y ${to}, la mediana es ${f(hd.med, 1)} UF/m² construido para departamentos${hc ? ` y ${f(hc.med, 1)} UF/m² para casas` : ""}. La mitad central de las ventas de departamentos estuvo entre ${f(hd.p25, 1)} y ${f(hd.p75, 1)} UF/m².`
        : `Based on SII sales between ${from} and ${to}, the median is ${f(hd.med, 1)} UF per built m² for apartments${hc ? ` and ${f(hc.med, 1)} UF/m² for houses` : ""}. The middle half of apartment sales ranged from ${f(hd.p25, 1)} to ${f(hd.p75, 1)} UF/m².`,
    });
  if (v.RS07 !== undefined)
    faq.push({
      q: es ? `¿${p.name} tiene riesgo de inundación?` : `Is ${p.name} at risk of flooding?`,
      a: es
        ? `${f(v.RS07)}% de sus residentes vive en zonas de inundación oficiales (PRMS y estudios del MINVU)${v.RS09 ? ` y ${f(v.RS09)}% en zonas de remoción en masa` : ""}. Revisa la dirección exacta en el mapa de PROMETEO: el riesgo cambia de una manzana a otra.`
        : `${f(v.RS07)}% of its residents live in official flood zones (PRMS and MINVU studies)${v.RS09 ? ` and ${f(v.RS09)}% in landslide zones` : ""}. Check the exact address on the PROMETEO map: risk changes from block to block.`,
    });
  if (v.IN04 !== undefined)
    faq.push({
      q: es ? `¿Cómo es el transporte público en ${p.name}?` : `How good is public transport in ${p.name}?`,
      a: es
        ? `En promedio hay ${f(v.IN04)} salidas de buses y metro por hora en hora punta a menos de 500 m de cada edificio (puesto ${p.ranks.IN04} de ${N}, datos GTFS del DTPM).`
        : `On average there are ${f(v.IN04)} bus and metro departures per hour in the morning peak within 500 m of each building (rank ${p.ranks.IN04} of ${N}, DTPM GTFS data).`,
    });
  if (v.RS01 !== undefined)
    faq.push({
      q: es ? `¿Es segura ${p.name}?` : `Is ${p.name} safe?`,
      a: es
        ? `Registró ${f(v.RS01)} casos policiales por delitos violentos por cada 100 mil habitantes en 2025 (CEAD)${v.RS03 !== undefined ? ` y ${f(v.RS03, 1)}% de hogares declaró haber sido víctima según la ENUSC 2024` : ""}.`
        : `It recorded ${f(v.RS01)} police cases of violent crime per 100,000 residents in 2025 (CEAD)${v.RS03 !== undefined ? `, and ${f(v.RS03, 1)}% of households reported being victims in the 2024 ENUSC survey` : ""}.`,
    });

  return { title, metaTitle, description, summary, keyFacts, sections, faq };
}
