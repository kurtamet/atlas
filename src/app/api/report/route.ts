/**
 * POST /api/report  { input: ReportInput }  ->  { ai: ReportAI, source: "claude" | "rules" }
 *
 * One structured-output call: Claude gets the compact facts and returns short texts per block.
 * Without ANTHROPIC_API_KEY (local preview) or on failure it answers with the rule-based draft,
 * so the template always renders. A signed-in user's report is saved to their account (savedId).
 * Payment gating goes in front of this route once payments are live.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ReportAI, SYSTEM_PROMPT } from "@/lib/report/schema";
import { promptPayload, type ReportInput } from "@/lib/report/input";
import { ruleDraft } from "@/lib/report/fallback";
import { saveReport } from "@/lib/report/save";
import es from "../../../../messages/es.json";
import en from "../../../../messages/en.json";

export const maxDuration = 120;
const MODEL = process.env.REPORT_MODEL ?? "claude-opus-5-5";

export async function POST(req: Request) {
  let input: ReportInput;
  try {
    input = (await req.json()).input;
    if (!input?.object || !Array.isArray(input.metrics)) throw new Error("bad input");
  } catch {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  const msgs = input.locale === "en" ? en : es;
  const answer = async (ai: ReportAI, source: "claude" | "rules", model?: string) =>
    Response.json({ ai, source, model, savedId: await saveReport(input, ai, source) });
  const rules = () => answer(ruleDraft(input, msgs), "rules");
  if (!process.env.ANTHROPIC_API_KEY) return rules();

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000, // thinking is always on and counts toward this; a low cap would cut the JSON
      // the system prompt is identical for every report, so it is cached
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(promptPayload(input)) }],
      output_config: { effort: "low", format: betaZodOutputFormat(ReportAI) },
      // on a safety decline the API re-runs the request on a fallback model inside the same call
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      console.warn("report: no parsed output", res.stop_reason);
      return rules();
    }
    console.info("report usage", res.usage.input_tokens, res.usage.output_tokens, res.usage.cache_read_input_tokens);
    return answer(res.parsed_output, "claude", res.model);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("report: rate limited");
    else if (e instanceof Anthropic.APIError) console.error("report: API error", e.status, e.message);
    else console.error("report: failed", e);
    return rules();
  }
}
