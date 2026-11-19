"use client";
import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker, StyleSpecification, MapGeoJSONFeature, FilterSpecification, ExpressionSpecification } from "maplibre-gl";
import type { Metric, Level } from "@/lib/layers/registry";
import { familyById } from "@/lib/layers/registry";
import type { LayerPlan } from "@/lib/layers/priority";
import { fillColorExpression } from "@/lib/layers/style";
import type { AreaCollection, BBox } from "@/lib/geo";

export const SANTIAGO: [number, number] = [-70.62, -33.46];
export const SANTIAGO_ZOOM = 10;

export interface MapCommand {
  kind: "fly" | "fit";
  center?: [number, number];
  zoom?: number;
  bbox?: BBox;
  /** increments so the same target can be requested twice */
  seq: number;
}

interface Props {
  chile: unknown;
  comunas: AreaCollection | null;
  zones: AreaCollection | null;
  metric: Metric;
  plan: LayerPlan;
  selected: { level: Level; id: string } | null;
  highlighted: string[];
  marker: [number, number] | null;
  command: MapCommand | null;
  onZoom: (z: number) => void;
  onPick: (level: Level, props: Record<string, string | number>, lngLat: [number, number]) => void;
}

const EMPTY = { type: "FeatureCollection", features: [] } as const;

// Basemap: OpenFreeMap vector tiles (OpenMapTiles schema) restyled with the concept palette.
// If the tiles are unreachable the data layers still render on the plain land background.
const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "© OpenStreetMap · OpenFreeMap" },
    chile: { type: "geojson", data: EMPTY as never },
    comunas: { type: "geojson", data: EMPTY as never, promoteId: "code" },
    zones: { type: "geojson", data: EMPTY as never, promoteId: "id" },
    labels: { type: "geojson", data: "/data/comuna-labels.geojson" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#f0f2ee" } },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#dce9ed" } },
    { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": "#e2eadf", "fill-opacity": 0.8 } },
    { id: "chile-fill", type: "fill", source: "chile", maxzoom: 9, paint: { "fill-color": "#e7eae0", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.7, 9, 0] } },
    // data surfaces (only one visible at a time, decided by the priority plan)
    { id: "comunas-fill", type: "fill", source: "comunas", paint: { "fill-opacity": 0.85 } },
    // zones without buildings (empty land) are drawn faint: coarse values describe settled areas (spec §2.3)
    { id: "zones-fill", type: "fill", source: "zones", paint: { "fill-opacity": ["case", [">", ["coalesce", ["get", "bld"], 0], 0], 0.85, 0.25] } },
    { id: "zones-line", type: "line", source: "zones", minzoom: 13, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 16, 0.8], "line-opacity": 0.35 } },
    // roads above fills so the street grid stays readable through the color
    {
      id: "roads", type: "line", source: "omt", "source-layer": "transportation", minzoom: 9,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]],
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.75,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "class"], ["motorway", "trunk"], 1.2, 0.3], 16, ["match", ["get", "class"], ["motorway", "trunk", "primary"], 6, ["secondary", "tertiary"], 4, 2]],
      },
    },
    { id: "chile-line", type: "line", source: "chile", paint: { "line-color": "#8a9a90", "line-width": 0.8 } },
    // background context: coarser level as outline only
    { id: "comunas-line", type: "line", source: "comunas", paint: { "line-color": "#5f6f66", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 13, 1.6], "line-opacity": 0.8 } },
    { id: "match-line", type: "line", source: "comunas", filter: ["in", ["get", "code"], ["literal", []]], paint: { "line-color": "#234f43", "line-width": 2.5, "line-dasharray": [2, 1] } },
    { id: "selected-comuna", type: "line", source: "comunas", filter: ["==", ["get", "code"], ""], paint: { "line-color": "#202d29", "line-width": 2.4 } },
    { id: "selected-zone", type: "line", source: "zones", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#202d29", "line-width": 2 } },
    {
      id: "comuna-labels", type: "symbol", source: "labels", minzoom: 9.5,
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13], "text-max-width": 7 },
      paint: { "text-color": "#202d29", "text-halo-color": "#ffffffcc", "text-halo-width": 1.4 },
    },
    {
      id: "places", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 9.5,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: { "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 11 },
      paint: { "text-color": "#4a5a52", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    },
  ],
};

export default function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  // init once
  useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      if (disposed || !container.current) return;
      const map = new maplibre.Map({
        container: container.current,
        style: BASE_STYLE,
        center: SANTIAGO,
        zoom: SANTIAGO_ZOOM,
        minZoom: 3,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("error", (e) => console.warn("[map]", e.error?.message ?? e));
      map.once("style.load", () => {
        ready.current = true;
        syncData();
        syncStyle();
        latest.current.onZoom(map.getZoom());
      });
      map.on("zoomend", () => latest.current.onZoom(map.getZoom()));
      map.on("click", (e) => {
        const layers = ["zones-fill", "comunas-fill"].filter((id) => map.getLayoutProperty(id, "visibility") !== "none");
        const hit: MapGeoJSONFeature | undefined = map.queryRenderedFeatures(e.point, { layers })[0];
        if (!hit) return;
        latest.current.onPick(hit.layer.id === "zones-fill" ? "D" : "C", hit.properties as Record<string, string | number>, [e.lngLat.lng, e.lngLat.lat]);
      });
      for (const id of ["zones-fill", "comunas-fill"]) {
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }
      (window as unknown as { __atlasMap?: MLMap }).__atlasMap = map;
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  function syncData() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { chile, comunas, zones } = latest.current;
    const set = (id: string, data: unknown) => (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(data ?? EMPTY);
    set("chile", chile);
    set("comunas", comunas);
    set("zones", zones);
  }

  function syncStyle() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { metric, plan, selected, highlighted } = latest.current;
    const color = fillColorExpression(metric) as ExpressionSpecification;
    const vis = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");

    vis("comunas-fill", plan.fillLevel === "C");
    vis("zones-fill", plan.fillLevel === "D");
    vis("zones-line", plan.fillLevel === "D");
    // comuna outlines: always as context once the city is in view; stronger when they are background to zones
    vis("comunas-line", true);
    map.setPaintProperty("comunas-line", "line-opacity", plan.outlineLevels.includes("C") ? 0.9 : 0.45);
    if (plan.fillLevel === "C") map.setPaintProperty("comunas-fill", "fill-color", color);
    if (plan.fillLevel === "D") map.setPaintProperty("zones-fill", "fill-color", color);

    map.setFilter("match-line", ["in", ["get", "code"], ["literal", highlighted]] as FilterSpecification);
    map.setFilter("selected-comuna", ["==", ["get", "code"], selected?.level === "C" ? selected.id : ""] as FilterSpecification);
    map.setFilter("selected-zone", ["==", ["get", "id"], selected?.level === "D" ? selected.id : ""] as FilterSpecification);
    map.setPaintProperty("match-line", "line-color", familyById(metric.family).color);
  }

  useEffect(syncData, [props.chile, props.comunas, props.zones]);
  useEffect(syncStyle, [props.metric, props.plan, props.selected, props.highlighted]);

  // marker
  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      markerRef.current?.remove();
      markerRef.current = null;
      if (!map || !props.marker) return;
      const maplibre = await import("maplibre-gl");
      markerRef.current = new maplibre.Marker({ color: "#234f43" }).setLngLat(props.marker).addTo(map);
    })();
  }, [props.marker]);

  // camera commands
  useEffect(() => {
    const map = mapRef.current;
    const c = props.command;
    if (!map || !c) return;
    if (c.kind === "fly" && c.center) map.flyTo({ center: c.center, zoom: c.zoom ?? map.getZoom(), duration: 900 });
    if (c.kind === "fit" && c.bbox) map.fitBounds(c.bbox, { padding: { top: 60, bottom: 120, left: 260, right: 300 }, duration: 900, maxZoom: 13 });
  }, [props.command]);

  return <div ref={container} className="at-map-canvas" />;
}

/** imperative zoom helpers for the custom +/- buttons */
export function zoomBy(delta: number) {
  const map = (window as unknown as { __atlasMap?: MLMap }).__atlasMap;
  map?.easeTo({ zoom: map.getZoom() + delta, duration: 300 });
}
