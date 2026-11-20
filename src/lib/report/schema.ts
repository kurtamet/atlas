/**
 * What Claude returns for the paid report: short texts per block, nothing else.
 * Figures, charts and layout come from input.ts and the template, so the answer stays small.
 */
import { z } from "zod";

const evidence = z.string().describe("metric id (e.g. EN03, RS01) or fact key (walk.metro, hazard.RS07, price) that supports the point");

export const ReportAI = z.object({
  headline: z.string().describe("one sentence, max 110 characters, the main takeaway about this location"),
  verdict: z.enum(["favorable", "mixed", "caution"]),
  summary: z.string().describe("2–3 sentences for a buyer, plain language, cites the key numbers"),
  strengths: z.array(z.object({ title: z.string().describe("max 50 characters"), detail: z.string().describe("1–2 sentences with the number"), evidence })).describe("2–5 items"),
  risks: z.array(z.object({
    title: z.string().describe("max 50 characters"),
    detail: z.string().describe("1–2 sentences with the number"),
    severity: z.enum(["low", "medium", "high"]),
    mitigation: z.string().describe("one sentence: what to check or do about it"),
    evidence,
  })).describe("1–5 items"),
  value: z.object({
    position: z.enum(["below", "in_line", "above", "unknown"]).describe("comuna price level vs the Santiago comunas in the data; unknown if no price"),
    comment: z.string().describe("2 sentences on price level and trend in the comuna; say that the unit's own price is not known"),
  }),
  audiences: z.array(z.object({
    audience: z.enum(["family", "first_buyer", "investor_rent", "flipper", "senior"]),
    fit: z.enum(["good", "neutral", "poor"]),
    reason: z.string().describe("one sentence"),
  })).describe("exactly 5 items, one per audience"),
  checks: z.array(z.string()).describe("3–6 concrete things to verify before buying (documents, visit at night, permits…), tied to this location"),
  negotiation: z.array(z.string()).describe("0–3 arguments a buyer could use, only if supported by the data"),
});
export type ReportAI = z.infer<typeof ReportAI>;

export const SYSTEM_PROMPT = `You write the interpretation layer of a paid real-estate location report for Santiago, Chile.
You receive a JSON object with measured facts about one building location: layer values with their level (D = zone of ~1 km, C = comuna), percentiles among Santiago zones or comunas, walking minutes to services (straight line ×1.3 at 4.5 km/h), official hazard zones at the point, comuna transaction prices in UF from SII, deterministic flags, and theme scores.
Rules:
- Use only the numbers in the input. Never invent prices, rents, distances, names or facts about the unit (its size, condition, floor, documents are unknown).
- Say which level a figure describes when it matters ("in the comuna", "in this zone").
- Crime rates (RS01) are counted where crimes happen, so commercial comunas look high per resident; RS03 is a survey estimate. Mention this only if crime is a key point.
- Be balanced and specific; short sentences; no marketing language.
- Write in the language given by "locale" (es = Chilean Spanish, en = English). Keep metric ids only inside "evidence".`;
