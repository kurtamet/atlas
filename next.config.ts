import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // /api/trends reads the precomputed comuna files from disk; ship them with the serverless function
  // (as do the embed card and the comuna social images, which render on demand)
  outputFileTracingIncludes: {
    "/api/trends": ["./public/data/*.json", "./public/data/*.geojson"],
    "/embed/[slug]": ["./public/data/*.json", "./public/data/*.geojson"],
    "/og": ["./public/data/*.json", "./public/data/*.geojson"],
  },
};

export default createNextIntlPlugin()(nextConfig);
