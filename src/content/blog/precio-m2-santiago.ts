import type { Post } from "./types";

const post: Post = {
  slug: "precio-m2-santiago-2026",
  date: "2026-11-27",
  tags: ["precios", "SII", "ranking"],
  es: {
    title: "Precio del m² en Santiago 2026: ranking de las 32 comunas con compraventas reales del SII",
    description: "Cuánto se pagó por metro cuadrado de departamentos y casas en cada comuna del Gran Santiago, según compraventas inscritas en el SII. Ranking, rangos típicos y cómo leerlos.",
    body: `
Los portales muestran precios de publicación: lo que el vendedor pide. Para saber lo que de verdad se paga hay que mirar las compraventas inscritas. El Servicio de Impuestos Internos publica cada transacción de bienes raíces (formulario F2890) y su Catastro registra la superficie construida de cada rol. Al cruzar ambos, PROMETEO calculó el precio pagado por metro cuadrado en cada comuna del Gran Santiago entre {{from}} y {{to}}.

## Resumen en cuatro cifras

- En la Región Metropolitana, un departamento se vendió a una mediana de **{{rm:Hd}} UF/m²** construido ({{rmn:Hd}} compraventas).
- Una casa: **{{rm:Hc}} UF/m²** ({{rmn:Hc}} compraventas). Por m² construido, la casa cuesta bastante menos porque parte del valor está en el terreno.
- La comuna más cara para departamentos es [Vitacura](/comunas/vitacura) con **{{Hd:vitacura}} UF/m²**; la más económica, [Lo Espejo](/comunas/lo-espejo) con **{{Hd:lo-espejo}} UF/m²**: más de cuatro veces de diferencia.
- [Ñuñoa](/comunas/nunoa) ({{n:Hd:nunoa}} ventas) y [Santiago](/comunas/santiago) ({{n:Hd:santiago}}) concentran el mayor volumen de compraventas de departamentos.

## Ranking de departamentos por comuna

{{table:apartments}}

El grupo alto lo forman las comunas del oriente: Vitacura, Lo Barnechea, Las Condes, Ñuñoa, Providencia y La Reina. Luego aparece un grupo intermedio entre 50 y 75 UF/m² que mezcla comunas consolidadas (Macul, San Miguel, La Cisterna) con otras donde en la última década se construyeron muchos edificios en altura, como [Independencia](/comunas/independencia) o [San Joaquín](/comunas/san-joaquin). Ahí la mediana depende mucho de cuántas ventas son de edificios nuevos.

## Ranking de casas por comuna

{{table:houses}}

En casas, Vitacura supera las {{Hc:vitacura}} UF/m² construido, seguida de Lo Barnechea y Las Condes. La distancia con el resto es mayor que en departamentos, porque en esas comunas el terreno pesa mucho en el precio.

## Cómo leer estos números

- **Mediana, no promedio.** La mitad de las ventas estuvo por encima y la mitad por debajo. Un par de mansiones no la distorsiona.
- **Rango típico.** La columna p25–p75 contiene la mitad central de las ventas. Si una propiedad se ofrece muy por sobre el p75 de su comuna, conviene preguntar por qué.
- **Una sola unidad principal por venta.** Se descartan las ventas en bloque y las que mezclan varias viviendas. Estacionamientos y bodegas vendidos junto al departamento quedan incluidos en el precio.
- **Precio de la comuna no es precio de la calle.** Dentro de una misma comuna el m² puede variar al doble entre un barrio y otro. En el mapa de PROMETEO el precio se ve por zonas de unos 600 m y, al hacer clic en un edificio, por tipo de propiedad.

{{cta}}

## Preguntas frecuentes

### ¿Cuál es la comuna más cara de Santiago por m²?

Para departamentos, Vitacura ({{Hd:vitacura}} UF/m²), seguida de Lo Barnechea ({{Hd:lo-barnechea}}) y Las Condes ({{Hd:las-condes}}).

### ¿Dónde está el m² más barato del Gran Santiago?

Entre las 32 comunas analizadas, Lo Espejo, El Bosque, Cerro Navia y San Ramón tienen las medianas más bajas para departamentos, alrededor de 23 UF/m².

### ¿De dónde salen los datos?

De las compraventas que el SII publica en su sitio de transparencia (F2890) y del Detalle Catastral 2026, cruzados por rol. PROMETEO solo publica agregados por comuna o zona, nunca datos de una persona.
`,
  },
  en: {
    title: "Price per m² in Santiago 2026: ranking of 32 comunas from actual SII sales",
    description: "What buyers actually paid per square metre for apartments and houses in each Greater Santiago comuna, based on sales recorded by Chile's tax service (SII).",
    body: `
Listing sites show asking prices. To know what people actually pay you need recorded sales. Chile's tax service (SII) publishes every property transaction (form F2890), and its property register (Catastro) holds the built area of every rol. By joining the two, PROMETEO computed the price paid per square metre in every Greater Santiago comuna between {{from}} and {{to}}.

## The summary in four numbers

- Across the Metropolitan Region an apartment sold at a median of **{{rm:Hd}} UF per built m²** ({{rmn:Hd}} sales).
- A house: **{{rm:Hc}} UF/m²** ({{rmn:Hc}} sales). Per built m² a house costs less, because part of its value is the land.
- The most expensive comuna for apartments is [Vitacura](/comunas/vitacura) at **{{Hd:vitacura}} UF/m²**; the cheapest is [Lo Espejo](/comunas/lo-espejo) at **{{Hd:lo-espejo}} UF/m²**, more than a fourfold gap.
- [Ñuñoa](/comunas/nunoa) ({{n:Hd:nunoa}} sales) and [Santiago](/comunas/santiago) ({{n:Hd:santiago}}) have the largest apartment sales volume.

## Apartments ranked by comuna

{{table:apartments}}

The top group is the eastern comunas: Vitacura, Lo Barnechea, Las Condes, Ñuñoa, Providencia and La Reina. A middle band between 50 and 75 UF/m² mixes established comunas (Macul, San Miguel, La Cisterna) with comunas that saw many new high-rise buildings over the last decade, such as [Independencia](/comunas/independencia) or [San Joaquín](/comunas/san-joaquin). There the median depends a lot on how many sales are in new buildings.

## Houses ranked by comuna

{{table:houses}}

For houses Vitacura passes {{Hc:vitacura}} UF per built m², followed by Lo Barnechea and Las Condes. The gap to the rest is wider than for apartments because land weighs heavily in those comunas.

## How to read these numbers

- **Median, not average.** Half of the sales were above and half below, so a few mansions do not distort it.
- **Typical range.** The p25–p75 column holds the middle half of sales. If a property is offered well above the p75 of its comuna, ask why.
- **One main unit per sale.** Block sales and sales of several homes at once are dropped. Parking and storage sold with an apartment stay in the price.
- **A comuna price is not a street price.** Within one comuna the price per m² can double from one neighbourhood to another. The PROMETEO map shows prices by zones of about 600 m and, when you click a building, by property type.

{{cta}}

## Frequently asked questions

### Which Santiago comuna has the highest price per m²?

For apartments, Vitacura ({{Hd:vitacura}} UF/m²), followed by Lo Barnechea ({{Hd:lo-barnechea}}) and Las Condes ({{Hd:las-condes}}).

### Where is the cheapest m² in Greater Santiago?

Among the 32 comunas analysed, Lo Espejo, El Bosque, Cerro Navia and San Ramón have the lowest apartment medians, around 23 UF/m².

### Where does the data come from?

From the sales SII publishes on its transparency site (F2890) and the 2026 Detalle Catastral, joined by rol. PROMETEO only publishes comuna or zone aggregates, never data about a person.
`,
  },
};

export default post;
