/**
 * Browser side of report generation: opens the report tab at once (so popup blockers allow it),
 * asks /api/report for the AI blocks and hands the result over through localStorage.
 * A signed-in user's report is also saved to the account (savedId) and can be reopened from there.
 */
import type { ReportInput } from "./input.ts";
import type { ReportAI } from "./schema.ts";

export interface StoredReport { input: ReportInput; ai?: ReportAI; source?: "claude" | "rules"; error?: string; savedId?: string | null }
export const storageKey = (id: string) => `atlas-report:${id}`;

export function readReport(id: string): StoredReport | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as StoredReport) : null;
  } catch {
    return null;
  }
}

export function requestReport(input: ReportInput, locale: string): void {
  const id = Math.random().toString(36).slice(2, 10);
  const save = (r: StoredReport) => localStorage.setItem(storageKey(id), JSON.stringify(r));
  save({ input });
  window.open(`/${locale}/report?id=${id}`, "_blank");
  fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { ai: ReportAI; source: "claude" | "rules"; savedId?: string | null }) => save({ input, ai: j.ai, source: j.source, savedId: j.savedId }))
    .catch((e: Error) => save({ input, error: e.message }));
}
