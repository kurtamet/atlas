import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";

/** one saved report; row level security limits it to its owner (or an admin) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await userClient();
  if (!sb || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await sb.from("reports").select("input, ai, source").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...data, savedId: id }, { headers: { "cache-control": "private, no-store" } });
}
