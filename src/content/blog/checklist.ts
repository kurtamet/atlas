import type { Post } from "./types";

const post: Post = {
  slug: "como-evaluar-propiedad-santiago",
  date: "2026-11-27",
  tags: ["guía", "compra", "rol SII"],
  es: {
    title: "Cómo evaluar una propiedad en Santiago antes de comprar: checklist con datos abiertos",
    description: "Guía paso a paso para revisar precio, rol, avalúo, riesgos naturales, ruido, transporte y seguridad de una propiedad en Santiago usando fuentes oficiales y gratuitas.",
    body: `
Comprar una vivienda es la decisión financiera más grande para la mayoría de las familias, y en Chile gran parte de la información para evaluarla es pública. El problema es que está repartida entre el SII, el MINVU, el Ministerio del Medio Ambiente, el DTPM y la policía. Esta guía ordena qué revisar y dónde.

## 1. Identifica la propiedad por su rol

Cada inmueble tiene un **rol de avalúo** del SII (por ejemplo 1234-56). Pídelo al vendedor o búscalo en la escritura o en el certificado de avalúo fiscal. Con el rol se confirma la superficie construida, el destino (habitacional, oficina, comercio), el año de construcción y el avalúo fiscal. En PROMETEO puedes escribir el rol en el buscador para ubicar la propiedad en el mapa.

## 2. Compara el precio con ventas reales, no con avisos

Un aviso dice lo que pide el vendedor. Las compraventas inscritas dicen lo que se pagó. Divide el precio pedido por los m² construidos y compáralo con la mediana de la comuna y de la zona.

- En la Región Metropolitana, un departamento se vendió a una mediana de {{rm:Hd}} UF/m² entre {{from}} y {{to}}.
- Revisa el [ranking de precio por m² por comuna](/blog/precio-m2-santiago-2026) y la ficha de tu comuna, por ejemplo [Ñuñoa](/comunas/nunoa) o [Providencia](/comunas/providencia).
- Si el precio está sobre el percentil 75 de la zona, busca la razón: vista, piso, terminaciones, estacionamientos incluidos.

## 3. Revisa los riesgos naturales

Consulta si la manzana está en zona de inundación, de remoción en masa o en suelo de mala respuesta sísmica según el PRMS. Explicamos cada riesgo en [qué comunas están más expuestas](/blog/riesgo-inundacion-remocion-santiago). Para el detalle legal, pide el certificado de informaciones previas en la municipalidad.

## 4. Mide el entorno

- **Ruido:** una calle interior y una avenida pueden diferir en más de 10 dBA.
- **Áreas verdes:** cerca de parques y calles arboladas hace menos calor en verano.
- **Aire:** el PM2.5 es más alto en el poniente y el sur de la ciudad en invierno.

Más en [áreas verdes, ruido y contaminación por comuna](/blog/areas-verdes-ruido-aire-santiago).

## 5. Comprueba transporte y servicios

Cuenta cuántas salidas de buses y metro pasan cerca en hora punta y a cuántos minutos a pie están el supermercado, la farmacia y el consultorio. En [calidad-precio](/blog/comunas-calidad-precio-santiago) comparamos el transporte de todas las comunas.

## 6. Mira la seguridad con datos, no con titulares

El CEAD publica los casos policiales por comuna y la ENUSC mide la victimización de los hogares. Compara la tasa por cada 100 mil habitantes y su variación anual, no el número absoluto.

## 7. Pide un informe consolidado

Si quieres todo lo anterior en un solo documento para una dirección concreta, el informe de PROMETEO reúne precio estimado por tipo de propiedad, riesgos, entorno, transporte y seguridad, con las fuentes citadas.

{{cta}}

## Checklist rápido

- Rol, superficie y destino confirmados en el SII
- Precio por m² comparado con la mediana de la comuna y la zona
- Zona de inundación, remoción en masa y suelo sísmico revisados
- Ruido y vegetación de la calle exacta
- Transporte en hora punta y servicios a pie
- Tasa de delitos y su tendencia
- Certificado de informaciones previas y de avalúo fiscal
`,
  },
  en: {
    title: "How to evaluate a property in Santiago before buying: a checklist with open data",
    description: "Step-by-step guide to checking price, rol, assessed value, natural hazards, noise, transit and safety of a property in Santiago, Chile, using free official sources.",
    body: `
Buying a home is the largest financial decision most families make, and in Chile much of the information needed to assess it is public. The problem is that it is spread across SII, MINVU, the Ministry of Environment, DTPM and the police. This guide puts in order what to check and where.

## 1. Identify the property by its rol

Every property has an SII **assessment number, the rol** (for example 1234-56). Ask the seller or find it in the deed or the tax assessment certificate. The rol confirms built area, use (residential, office, retail), year built and assessed value. On PROMETEO you can type the rol into the search box to locate the property on the map.

## 2. Compare the price with actual sales, not listings

A listing says what the seller asks. Recorded sales say what was paid. Divide the asking price by the built m² and compare it with the comuna and zone median.

- Across the Metropolitan Region an apartment sold at a median of {{rm:Hd}} UF/m² between {{from}} and {{to}}.
- See the [price per m² ranking by comuna](/blog/precio-m2-santiago-2026) and your comuna page, for example [Ñuñoa](/comunas/nunoa) or [Providencia](/comunas/providencia).
- If the price is above the zone's 75th percentile, look for the reason: view, floor, finishes, parking included.

## 3. Check natural hazards

Find out whether the block lies in a flood zone, landslide zone or on poor seismic soil under the PRMS. We explain each hazard in [which comunas are most exposed](/blog/riesgo-inundacion-remocion-santiago). For the legal detail, request the "certificado de informaciones previas" from the municipality.

## 4. Measure the surroundings

- **Noise:** an inner street and an avenue can differ by more than 10 dBA.
- **Green space:** near parks and tree-lined streets summers are cooler.
- **Air:** PM2.5 is higher in the west and south of the city in winter.

More in [green space, noise and air pollution by comuna](/blog/areas-verdes-ruido-aire-santiago).

## 5. Check transit and services

Count how many bus and metro departures pass nearby at peak hour and how many minutes on foot the supermarket, pharmacy and clinic are. In [value for money](/blog/comunas-calidad-precio-santiago) we compare transit across all comunas.

## 6. Look at safety with data, not headlines

CEAD publishes police cases by comuna and the ENUSC survey measures household victimisation. Compare the rate per 100,000 residents and its yearly change, not the absolute count.

## 7. Get a consolidated report

If you want all of the above in one document for a specific address, the PROMETEO report brings together an estimated price by property type, hazards, surroundings, transit and safety, with sources cited.

{{cta}}

## Quick checklist

- Rol, area and use confirmed with SII
- Price per m² compared with the comuna and zone median
- Flood, landslide and seismic soil zones checked
- Noise and vegetation of the exact street
- Peak-hour transit and walkable services
- Crime rate and its trend
- Certificado de informaciones previas and tax assessment certificate
`,
  },
};

export default post;
