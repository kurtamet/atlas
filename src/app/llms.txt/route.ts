import { llmsTxt } from "@/lib/seo/llms";

export const dynamic = "force-static";

export async function GET() {
  return new Response(await llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
