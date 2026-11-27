import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

/** private areas; everything else (map, comunas, blog, trends, legal) is open to search and AI crawlers */
const PRIVATE = ["/api/", "/account", "/admin", "/report", "/en/account", "/en/admin", "/en/report"];

/**
 * AI assistants and answer engines are welcome explicitly (GEO): being read by them is how PROMETEO gets cited.
 * A crawler follows only its most specific group, so each group repeats the private paths.
 */
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot", "Applebot-Extended",
  "Bingbot", "DuckAssistBot", "Meta-ExternalAgent", "MistralAI-User", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }, { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
