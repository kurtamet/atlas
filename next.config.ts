import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // /api/trends reads the precomputed comuna files from disk; ship them with the serverless function
  outputFileTracingIncludes: { "/api/trends": ["./public/data/*.json", "./public/data/*.geojson"] },
};

export default createNextIntlPlugin()(nextConfig);
