/**
 * POST /api/report/order { order, session } -> { ai, input, source, savedId } | 202 { pending } | 402
 *
 * The report of a single purchase. The Checkout session id in the success URL is the access key:
 * it must match the purchase. The first call after payment generates the report (once); later calls,
 * from any browser with the link, return the saved one.
 */
import { adminClient } from "@/lib/supabase/server";
import { stripe, fulfillSession } from "@/lib/commerce/stripe";
import { generateReport, validInput } from "@/lib/report/generate";
import { saveReport } from "@/lib/report/save";

export const maxDuration = 120;
const UUID = /^[0-9a-f-]{36}$/;
const STALE_MS = 3 * 60_000; // a generation that started longer ago than this has died: retry

export async function POST(req: Request) {
  let order = "", session = "";
  try { ({ order = "", session = "" } = await req.json()); } catch { /* fall through */ }
  const db = adminClient();
  if (!db || !UUID.test(order) || !/^cs_[A-Za-z0-9_]+$/.test(session)) return Response.json({ error: "not found" }, { status: 404 });

  const load = async () => (await db.from("purchases").select("id, user_id, kind, status, provider_ref, input, report_id, report_started_at").eq("id", order).maybeSingle()).data;
  let p = await load();
  if (!p || p.kind !== "single" || p.provider_ref !== session) return Response.json({ error: "not found" }, { status: 404 });

  if (p.report_id) return sendSaved(p.report_id as string);

  if (p.status !== "paid") {
    // the webhook may not have arrived yet: ask Stripe directly
    const s = await stripe().checkout.sessions.retrieve(session);
    await fulfillSession(s);
    p = await load();
    if (!p || p.status !== "paid") return Response.json({ error: "payment required" }, { status: 402 });
  }
  if (!validInput(p.input)) return Response.json({ error: "no input" }, { status: 500 });

  // claim the generation so a reload or a second tab does not run it twice
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const { data: claimed } = await db.from("purchases").update({ report_started_at: new Date().toISOString() })
    .eq("id", order).is("report_id", null).or(`report_started_at.is.null,report_started_at.lt.${staleBefore}`).select("id");
  if (!claimed?.length) return Response.json({ pending: true }, { status: 202 });

  const g = await generateReport(p.input);
  const savedId = await saveReport(p.input, g.ai, g.source, (p.user_id as string | null) ?? null, "single");
  if (savedId) await db.from("purchases").update({ report_id: savedId }).eq("id", order);
  return Response.json({ input: p.input, ai: g.ai, source: g.source, savedId }, { headers: { "cache-control": "private, no-store" } });

  async function sendSaved(id: string) {
    const { data } = await db!.from("reports").select("input, ai, source").eq("id", id).maybeSingle();
    if (!data) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ...data, savedId: id }, { headers: { "cache-control": "private, no-store" } });
  }
}
