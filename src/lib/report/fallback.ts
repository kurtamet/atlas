/**
 * Rule-based draft of the AI blocks, used when no Claude API key is configured (local preview, tests)
 * or when the API call fails. Same shape as the model answer, built only from the free-card flags.
 */
import type { ReportAI } from "./schema.ts";
import { ruleVerdict, type ReportInput, type Flag } from "./input.ts";

type Msgs = { object: { obs: Record<string, string> }; reportDoc: Record<string, string> };

/** free-card flag -> evidence key the template knows how to label */
const EVIDENCE: Record<string, string> = {
  metroNear: "walk.metro", transitFar: "walk.transport", dailyNear: "walk.food", dailyFar: "walk.food", parkNear: "walk.park",
  flood: "hazard.RS07", landslide: "hazard.RS09", seismicSoil: "hazard.RS05", fault: "hazard.fault",
  noisy: "EN03", quiet: "EN03", green: "EN04", victimHigh: "RS03", victimLow: "RS03", crimeHigh: "RS01", crimeLow: "RS01",
};
const shortTitle = (t: string) => {
  const s = t.split(/[.:(]/)[0];
  return s.length <= 50 ? s : s.slice(0, s.lastIndexOf(" ", 48)) + "…";
};
const fill = (tpl: string, p: Flag["params"] = {}) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ""));

export function ruleDraft(i: ReportInput, m: Msgs): ReportAI {
  const text = (f: Flag) => fill(m.object.obs[f.key] ?? f.key, f.params);
  const verdict = ruleVerdict(i);
  const high = new Set(["flood", "landslide", "fault", "crimeHigh"]);
  const comunaPrices = i.price ? Object.values(i.price.years) : [];
  return {
    headline: fill(m.reportDoc[`fb_headline_${verdict}`], { comuna: i.object.comuna }),
    verdict,
    summary: fill(m.reportDoc.fb_summary, { pros: i.flags.pros.length, cons: i.flags.cons.length, comuna: i.object.comuna }),
    strengths: i.flags.pros.slice(0, 5).map((f) => ({ title: shortTitle(text(f)), detail: text(f), evidence: EVIDENCE[f.key] ?? f.key })),
    risks: i.flags.cons.slice(0, 5).map((f) => ({ title: shortTitle(text(f)), detail: text(f), severity: high.has(f.key) ? "high" : "medium", mitigation: m.reportDoc.fb_mitigation, evidence: EVIDENCE[f.key] ?? f.key })),
    value: { position: i.price ? "in_line" : "unknown", comment: i.price ? fill(m.reportDoc.fb_value, { comuna: i.object.comuna, median: new Intl.NumberFormat(i.locale === "es" ? "es-CL" : "en-US").format(i.price.median), n: comunaPrices.length }) : m.reportDoc.fb_noValue },
    audiences: (["family", "first_buyer", "investor_rent", "flipper", "senior"] as const).map((audience) => ({ audience, fit: "neutral", reason: m.reportDoc.fb_audience })),
    checks: [m.reportDoc.fb_check1, m.reportDoc.fb_check2, m.reportDoc.fb_check3],
    negotiation: [],
  };
}
