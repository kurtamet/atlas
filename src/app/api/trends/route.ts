import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { loadComunaTable, freeView, TRENDS_PAYWALL, type ComunaRow } from "@/lib/data/comunas";
import { currentAccount } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, makeCookie, previewState } from "@/lib/commerce/preview";

const dir = path.join(process.cwd(), "public", "data");
let cache: Promise<ComunaRow[]> | null = null;
const table = () => (cache ??= loadComunaTable(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8"))));

/**
 * Comuna table for the trends page. Plans (and admins) get everything; a visitor without a plan gets
 * everything during the timed preview, then the free view. `?status=1` answers without the table.
 */
export async function GET(req: NextRequest) {
  const devPreview = process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("preview") === "1";
  const plan = !TRENDS_PAYWALL || devPreview || Boolean((await currentAccount())?.subscriber);
  const pv = plan ? null : previewState(req.cookies.get(PREVIEW_COOKIE)?.value);
  const full = plan || Boolean(pv?.open);
  const body = { subscriber: full, plan, previewEndsAt: pv?.open ? new Date(pv.endsAt).toISOString() : null, previewUsed: Boolean(pv && !pv.open) };
  const res = NextResponse.json(req.nextUrl.searchParams.get("status") === "1" ? body : { ...body, rows: full ? await table() : freeView(await table()) }, { headers: { "cache-control": "private, no-store" } });
  if (pv?.isNew) res.cookies.set(makeCookie(pv.start));
  return res;
}
