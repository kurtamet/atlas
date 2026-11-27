import type { Post } from "./types";

const post: Post = {
  slug: "areas-verdes-ruido-aire-santiago",
  date: "2026-11-27",
  tags: ["medio ambiente", "ruido", "áreas verdes"],
  es: {
    title: "Áreas verdes, ruido y contaminación por comuna en Santiago: el mapa ambiental con datos satelitales",
    description: "Qué comunas del Gran Santiago son más verdes, más tranquilas y con mejor aire. Ranking con imágenes Sentinel-2, el Mapa de Ruido del MMA y estaciones SINCA.",
    body: `
El entorno no aparece en la escritura, pero se nota todos los días: la sombra de los árboles en verano, el ruido de la avenida de noche, el aire en invierno. PROMETEO mide tres cosas en cada comuna del Gran Santiago con fuentes públicas y comparables.

- **Vegetación (NDVI).** Índice satelital de 0 a 1 calculado con imágenes Sentinel-2 de enero de 2026. Sobre 0,3 indica barrios con mucho arbolado; bajo 0,15, muy poca vegetación.
- **Ruido de tránsito diurno.** Nivel promedio en decibeles del Mapa de Ruido del Gran Santiago (Ministerio del Medio Ambiente, 2023). La OMS recomienda que el ruido de tránsito no supere 53 dB; todas las comunas del Gran Santiago promedian más de 60 dBA de día.
- **PM2.5.** Material particulado fino, promedio anual 2023–2025 de las estaciones SINCA, interpolado a cada comuna.

## Ranking ambiental

{{table:environment}}

## Lo que muestran los datos

- Las comunas más verdes son [Lo Barnechea](/comunas/lo-barnechea) (NDVI {{EN04:lo-barnechea}}), [Vitacura](/comunas/vitacura) ({{EN04:vitacura}}), [Las Condes](/comunas/las-condes) ({{EN04:las-condes}}) y [La Reina](/comunas/la-reina) ({{EN04:la-reina}}). Las con menos vegetación, [Lo Espejo](/comunas/lo-espejo) ({{EN04:lo-espejo}}), [La Granja](/comunas/la-granja) y [San Ramón](/comunas/san-ramon).
- El aire también mejora hacia el oriente: Lo Barnechea registra {{EN01:lo-barnechea}} µg/m³ de PM2.5 y [La Cisterna](/comunas/la-cisterna) {{EN01:la-cisterna}} µg/m³.
- El ruido no sigue el mismo patrón. Vitacura ({{EN03:vitacura}} dBA), [Maipú](/comunas/maipu) ({{EN03:maipu}}) y [Santiago](/comunas/santiago) ({{EN03:santiago}}) están entre las más ruidosas por sus grandes avenidas, mientras [El Bosque](/comunas/el-bosque) y [La Pintana](/comunas/la-pintana) están entre las más tranquilas.

## Por qué importa al comprar

Las áreas verdes bajan la temperatura en verano y se asocian a precios más altos. El ruido es uno de los motivos más frecuentes de arrepentimiento después de mudarse, y cambia mucho entre una calle interior y una que da a una avenida. Por eso conviene mirar la dirección exacta: en el mapa de PROMETEO el ruido y la vegetación se ven por zona, y la ficha de cada edificio muestra el nivel de su entorno.

{{cta}}
`,
  },
  en: {
    title: "Green space, noise and air pollution by comuna in Santiago: an environmental map from satellite data",
    description: "Which Greater Santiago comunas are greenest, quietest and have the cleanest air. Ranking from Sentinel-2 imagery, the Ministry of Environment noise map and SINCA stations.",
    body: `
The environment is not in the deed, but you feel it every day: tree shade in summer, avenue noise at night, the air in winter. PROMETEO measures three things in every Greater Santiago comuna with public, comparable sources.

- **Vegetation (NDVI).** A 0–1 satellite index computed from Sentinel-2 imagery of January 2026. Above 0.3 means leafy neighbourhoods; below 0.15, very little vegetation.
- **Daytime traffic noise.** Average decibel level from the Greater Santiago noise map (Ministry of Environment, 2023). The WHO recommends keeping road traffic noise below 53 dB; every Greater Santiago comuna averages above 60 dBA in daytime.
- **PM2.5.** Fine particulate matter, 2023–2025 annual mean from SINCA stations, interpolated to each comuna.

## Environmental ranking

{{table:environment}}

## What the data shows

- The greenest comunas are [Lo Barnechea](/comunas/lo-barnechea) (NDVI {{EN04:lo-barnechea}}), [Vitacura](/comunas/vitacura) ({{EN04:vitacura}}), [Las Condes](/comunas/las-condes) ({{EN04:las-condes}}) and [La Reina](/comunas/la-reina) ({{EN04:la-reina}}). The least green are [Lo Espejo](/comunas/lo-espejo) ({{EN04:lo-espejo}}), [La Granja](/comunas/la-granja) and [San Ramón](/comunas/san-ramon).
- Air also improves towards the east: Lo Barnechea records {{EN01:lo-barnechea}} µg/m³ of PM2.5 and [La Cisterna](/comunas/la-cisterna) {{EN01:la-cisterna}} µg/m³.
- Noise follows a different pattern. Vitacura ({{EN03:vitacura}} dBA), [Maipú](/comunas/maipu) ({{EN03:maipu}}) and [Santiago](/comunas/santiago) ({{EN03:santiago}}) are among the loudest because of their large avenues, while [El Bosque](/comunas/el-bosque) and [La Pintana](/comunas/la-pintana) are among the quietest.

## Why it matters when buying

Green space cools neighbourhoods in summer and is associated with higher prices. Noise is one of the most common reasons for regret after moving, and it changes a lot between an inner street and one facing an avenue. That is why the exact address matters: the PROMETEO map shows noise and vegetation by zone, and each building card shows the level around it.

{{cta}}
`,
  },
};

export default post;
