import type { Post } from "./types";

const post: Post = {
  slug: "riesgo-inundacion-remocion-santiago",
  date: "2026-11-27",
  tags: ["riesgos", "inundación", "sismos"],
  es: {
    title: "Riesgo de inundación, remoción en masa y suelo sísmico en Santiago: qué comunas están más expuestas",
    description: "Porcentaje de residentes de cada comuna del Gran Santiago que vive en zonas de inundación, remoción en masa o suelo de mala respuesta sísmica, según el MINVU y el Censo 2024.",
    body: `
Antes de comprar, casi todos revisan metros, orientación y precio. Pocos revisan si la propiedad está en una zona de amenaza natural reconocida por el Estado. En Santiago esa información existe: el Plan Regulador Metropolitano (PRMS) y los estudios de amenaza del MINVU delimitan áreas de inundación, de remoción en masa y de suelos con mala respuesta sísmica. PROMETEO cruzó esas áreas con la población del Censo 2024 manzana por manzana.

## Tres riesgos distintos

- **Inundación.** Cauces, quebradas, canales y zonas bajas que pueden anegarse con lluvias intensas o desbordes.
- **Remoción en masa.** Aluviones, derrumbes y deslizamientos, sobre todo en la precordillera y en laderas de cerros.
- **Suelo de muy mala respuesta sísmica.** Suelos finos o saturados donde un terremoto se siente con más fuerza. No impide construir, pero exige mejor ingeniería.

## Exposición por comuna

{{table:hazards}}

### Lo que muestran los datos

- [Quilicura](/comunas/quilicura) tiene la mayor proporción de residentes en zonas de inundación ({{RS07:quilicura}}%) y además {{RS05:quilicura}}% sobre suelo de muy mala respuesta sísmica.
- Las comunas del oriente tampoco están libres de riesgo: [Vitacura](/comunas/vitacura) tiene {{RS07:vitacura}}% de residentes en zonas de inundación y [Lo Barnechea](/comunas/lo-barnechea) {{RS07:lo-barnechea}}%, por la cercanía al río Mapocho y a quebradas.
- La remoción en masa se concentra en la precordillera: [La Reina](/comunas/la-reina) ({{RS09:la-reina}}%) y [Peñalolén](/comunas/penalolen) ({{RS09:penalolen}}%) encabezan la lista.
- En el poniente y norte, [Cerro Navia](/comunas/cerro-navia), [Quinta Normal](/comunas/quinta-normal), [Renca](/comunas/renca) y [Conchalí](/comunas/conchali) tienen casi toda su población sobre suelos de mala respuesta sísmica.
- [Lo Prado](/comunas/lo-prado), [La Granja](/comunas/la-granja), [Independencia](/comunas/independencia) y [Providencia](/comunas/providencia) tienen muy pocos residentes en zonas de inundación.

## Qué hacer con esta información

1. **Revisa la manzana, no solo la comuna.** Un mismo barrio puede tener calles dentro y fuera de la zona. En el mapa de PROMETEO las capas de riesgo se ven por zona y por edificio.
2. **Consulta el certificado de informaciones previas** en la Dirección de Obras Municipales: indica las restricciones del PRMS para el predio.
3. **Pregunta por mitigación.** Muchas zonas de inundación tienen obras de canalización o colectores. Un edificio en suelo sísmico malo puede estar muy bien diseñado.
4. **Piensa en el seguro.** La exposición a amenazas influye en las condiciones de seguros de incendio y sismo.

{{cta}}

> Las zonas del PRMS son de planificación y no equivalen a una probabilidad anual de inundación. Son una señal para investigar, no un veredicto.
`,
  },
  en: {
    title: "Flood, landslide and seismic soil risk in Santiago: which comunas are most exposed",
    description: "Share of residents of each Greater Santiago comuna living in flood zones, landslide zones or very poor seismic soil, according to MINVU and the 2024 Census.",
    body: `
Before buying, almost everyone checks size, orientation and price. Few check whether the property sits in a natural hazard zone recognised by the State. In Santiago that information exists: the Metropolitan Zoning Plan (PRMS) and MINVU hazard studies map flood areas, landslide areas and soils with poor seismic response. PROMETEO crossed those areas with 2024 Census population, block by block.

## Three different hazards

- **Flooding.** Riverbeds, ravines, canals and low ground that can flood in heavy rain or overflow.
- **Landslides.** Debris flows, rockfalls and slides, mostly in the Andean foothills and on hillsides.
- **Very poor seismic soil.** Fine or saturated soils where an earthquake is felt more strongly. It does not prevent building but demands better engineering.

## Exposure by comuna

{{table:hazards}}

### What the data shows

- [Quilicura](/comunas/quilicura) has the largest share of residents in flood zones ({{RS07:quilicura}}%), and {{RS05:quilicura}}% live on very poor seismic soil.
- Eastern comunas are not risk-free either: [Vitacura](/comunas/vitacura) has {{RS07:vitacura}}% of residents in flood zones and [Lo Barnechea](/comunas/lo-barnechea) {{RS07:lo-barnechea}}%, due to the Mapocho river and ravines.
- Landslide exposure is concentrated in the foothills: [La Reina](/comunas/la-reina) ({{RS09:la-reina}}%) and [Peñalolén](/comunas/penalolen) ({{RS09:penalolen}}%) top the list.
- In the west and north, [Cerro Navia](/comunas/cerro-navia), [Quinta Normal](/comunas/quinta-normal), [Renca](/comunas/renca) and [Conchalí](/comunas/conchali) have almost all of their population on poor seismic soil.
- [Lo Prado](/comunas/lo-prado), [La Granja](/comunas/la-granja), [Independencia](/comunas/independencia) and [Providencia](/comunas/providencia) have very few residents in flood zones.

## What to do with this information

1. **Check the block, not just the comuna.** One neighbourhood can have streets inside and outside a zone. On the PROMETEO map hazard layers show by zone and by building.
2. **Request the "certificado de informaciones previas"** from the municipal works department: it lists the PRMS restrictions for the plot.
3. **Ask about mitigation.** Many flood zones have canals or storm drains. A building on poor seismic soil can be very well engineered.
4. **Think about insurance.** Hazard exposure affects the terms of fire and earthquake insurance.

{{cta}}

> PRMS zones are planning designations and do not equal an annual flood probability. Treat them as a reason to look closer, not as a verdict.
`,
  },
};

export default post;
