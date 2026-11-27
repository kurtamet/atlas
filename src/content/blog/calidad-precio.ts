import type { Post } from "./types";

const post: Post = {
  slug: "comunas-calidad-precio-santiago",
  date: "2026-11-27",
  tags: ["inversión", "transporte", "calidad de vida"],
  es: {
    title: "Las comunas con mejor relación calidad-precio de Santiago: transporte, entorno y UF/m²",
    description: "Qué comunas del Gran Santiago dan más calidad de vida y transporte público por cada UF pagada por m². Ranking con datos del SII, DTPM, MINVU y MMA.",
    body: `
Comprar en la comuna más cara no garantiza vivir mejor, y la más barata puede salir cara si queda lejos de todo o en zona de inundación. Para comparar con algo más que intuición, PROMETEO combina el precio real por m² (compraventas del SII) con un **índice general de 0 a 100** que resume entorno, acceso a servicios y transporte, clima y riesgos naturales de cada comuna.

## Las 12 comunas con más calidad por cada UF/m²

{{table:value-score}}

La tabla divide el índice general por el precio mediano del m² de departamentos. No dice dónde se vive mejor, sino dónde cada UF rinde más.

### Lo que muestran los datos

- [Recoleta](/comunas/recoleta) logra {{QX00:recoleta}} puntos con departamentos a {{Hd:recoleta}} UF/m², casi el mismo índice que [La Reina](/comunas/la-reina) ({{QX00:la-reina}}), que cuesta {{Hd:la-reina}} UF/m².
- [La Pintana](/comunas/la-pintana) y [La Granja](/comunas/la-granja) superan los 50 puntos con precios bajo 36 UF/m², gracias a una buena oferta de buses y baja exposición a inundaciones.
- [Independencia](/comunas/independencia) ({{QX00:independencia}} puntos, {{Hd:independencia}} UF/m²) y [San Miguel](/comunas/san-miguel) ({{QX00:san-miguel}}, {{Hd:san-miguel}} UF/m²) combinan cercanía al centro, metro y servicios a pie con precios bajo el promedio regional de {{rm:Hd}} UF/m².
- Entre las comunas caras, [Macul](/comunas/macul) ({{QX00:macul}} puntos, {{Hd:macul}} UF/m²) queda cerca de [Ñuñoa](/comunas/nunoa) ({{QX00:nunoa}}, {{Hd:nunoa}} UF/m²) por bastante menos.

## Transporte público: dónde pasa más locomoción

{{table:transit-value}}

[Santiago](/comunas/santiago) lidera con {{IN04:santiago}} salidas de buses y metro por hora en la punta de la mañana a menos de 500 m de cada edificio. Varias comunas del sur y del poniente, como [Lo Espejo](/comunas/lo-espejo), [Lo Prado](/comunas/lo-prado) o [El Bosque](/comunas/el-bosque), tienen más frecuencia que Las Condes o Vitacura. Para quien se mueve en transporte público, esa diferencia pesa tanto como los metros cuadrados.

## Cómo usar este ranking

1. Define tu presupuesto en UF/m² y mira qué comunas caen en ese rango en el [ranking de precios](/blog/precio-m2-santiago-2026).
2. Dentro de ese rango, ordena por índice general y por lo que más te importa: transporte, áreas verdes, ruido o riesgos.
3. Baja al barrio y a la dirección: el índice de comuna es un promedio y dentro de una misma comuna hay manzanas muy distintas.

{{cta}}

> El índice general es un promedio de percentiles por familia de capas (entorno, acceso, clima y riesgos) y no incluye precios ni densidad. Ver [metodología](/methods).
`,
  },
  en: {
    title: "Santiago comunas with the best value for money: transit, environment and UF/m²",
    description: "Which Greater Santiago comunas give the most livability and public transport for every UF paid per m². Ranking built on SII, DTPM, MINVU and Ministry of Environment data.",
    body: `
Buying in the most expensive comuna does not guarantee a better life, and the cheapest one can turn out costly if it is far from everything or in a flood zone. To compare with more than intuition, PROMETEO combines the actual price per m² (SII sales) with a **0–100 overall score** that sums up environment, access to services and transit, climate and natural hazards for each comuna.

## The 12 comunas with the most quality per UF/m²

{{table:value-score}}

The table divides the overall score by the median apartment price per m². It does not say where life is best, but where each UF goes furthest.

### What the data shows

- [Recoleta](/comunas/recoleta) scores {{QX00:recoleta}} with apartments at {{Hd:recoleta}} UF/m², almost the same score as [La Reina](/comunas/la-reina) ({{QX00:la-reina}}), which costs {{Hd:la-reina}} UF/m².
- [La Pintana](/comunas/la-pintana) and [La Granja](/comunas/la-granja) pass 50 points with prices under 36 UF/m², thanks to good bus service and low flood exposure.
- [Independencia](/comunas/independencia) ({{QX00:independencia}} points, {{Hd:independencia}} UF/m²) and [San Miguel](/comunas/san-miguel) ({{QX00:san-miguel}}, {{Hd:san-miguel}} UF/m²) combine proximity to downtown, metro and walkable services with prices below the regional median of {{rm:Hd}} UF/m².
- Among the pricier comunas, [Macul](/comunas/macul) ({{QX00:macul}} points, {{Hd:macul}} UF/m²) comes close to [Ñuñoa](/comunas/nunoa) ({{QX00:nunoa}}, {{Hd:nunoa}} UF/m²) for noticeably less.

## Public transport: where service is most frequent

{{table:transit-value}}

[Santiago](/comunas/santiago) leads with {{IN04:santiago}} bus and metro departures per hour in the morning peak within 500 m of each building. Several southern and western comunas such as [Lo Espejo](/comunas/lo-espejo), [Lo Prado](/comunas/lo-prado) or [El Bosque](/comunas/el-bosque) have more frequent service than Las Condes or Vitacura. For anyone who relies on public transport this matters as much as square metres.

## How to use this ranking

1. Set your budget in UF/m² and check which comunas fit it in the [price ranking](/blog/precio-m2-santiago-2026).
2. Within that range, sort by overall score and by what matters most to you: transit, green space, noise or hazards.
3. Zoom into the neighbourhood and the address: the comuna score is an average and blocks within one comuna differ a lot.

{{cta}}

> The overall score is a mean of percentiles per layer family (environment, access, climate and hazards) and excludes prices and density. See the [methodology](/methods).
`,
  },
};

export default post;
