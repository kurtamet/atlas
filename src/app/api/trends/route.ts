import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { loadComunaTable, freeView, TRENDS_PAYWALL, type ComunaRow } from "@/lib/data/comunas";
import { currentAccount } from "@/lib/supabase/server";

const dir = path.join(process.cwd(), "public", "data");
let cache: Promise<ComunaRow[]> | null = null;
const table = () => (cache ??= loadComunaTable(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8"))));

/** comuna table for the trends page; with the paywall on, series and derived extras only for subscribers */
export async function GET(req: NextRequest) {
  const preview = process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("preview") === "1";
  const subscriber = !TRENDS_PAYWALL || preview || Boolean((await currentAccount())?.subscriber);
  const rows = await table();
  return NextResponse.json({ subscriber, rows: subscriber ? rows : freeView(rows) }, { headers: { "cache-control": "private, no-store" } });
}
