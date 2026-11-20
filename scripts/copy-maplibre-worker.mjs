// MapLibre v6 loads its worker from a URL next to the main bundle; bundlers don't follow it,
// so we serve the worker as a static file and point MapLibre at it (see MapView.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
