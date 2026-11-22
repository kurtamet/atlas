/**
 * POST /api/report  { input: ReportInput }  ->  { ai, source, savedId }
 *
 * For a signed-in user whose next report is already paid: the plan's monthly allowance, a pack credit,
 * or admin. Anyone else gets 402 and the client offers the purchase (a single report goes through
 * /api/checkout and /api/report/order instead).
 * Before payments are switched on (no STRIPE_SECRET_KEY) the old open preview stays, so local work keeps going.
 */
import { generateReport, validInput } from "@/lib/report/generate";
import { saveReport } from "@/lib/report/save";
import { currentAccount, reportPayment } from "@/lib/supabase/server";
import { stripeConfigured } from "@/lib/commerce/stripe";

export const maxDuration = 120;

export async function POST(req: Request) {
  let input: unknown;
  try { input = (await req.json()).input; } catch { input = null; }
  if (!validInput(input)) return Response.json({ error: "invalid input" }, { status: 400 });

  const account = await currentAccount();
  const pay = account ? reportPayment(account) : null;
  if (!pay && stripeConfigured()) return Response.json({ error: "payment required", signedIn: Boolean(account) }, { status: 402 });

  const g = await generateReport(input);
  // a rule draft (AI unavailable) does not use up the allowance or a credit
  const paidWith = !account ? null : g.source === "rules" && pay !== "admin" ? "preview" : (pay ?? "preview");
  const savedId = account && paidWith ? await saveReport(input, g.ai, g.source, account.user.id, paidWith) : null;
  return Response.json({ ai: g.ai, source: g.source, model: g.model, savedId });
}
