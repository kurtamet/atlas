"use server";
import { revalidatePath } from "next/cache";
import { adminClient, currentAccount } from "@/lib/supabase/server";

/** every admin action re-checks the role on the server */
async function admin() {
  const a = await currentAccount();
  const db = adminClient();
  if (!a || a.role !== "admin" || !db) throw new Error("forbidden");
  return { a, db };
}
const done = () => revalidatePath("/[locale]/admin", "page");
const uid = (f: FormData) => {
  const v = String(f.get("user_id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(v)) throw new Error("bad user");
  return v;
};

export async function grantSubscription(f: FormData) {
  const { db } = await admin();
  const days = Math.min(400, Math.max(1, Number(f.get("days")) || 30));
  const plan = ["basic", "partner", "unlimited"].includes(String(f.get("plan"))) ? String(f.get("plan")) : "unlimited";
  await db.from("subscriptions").insert({ user_id: uid(f), plan, status: "active", current_period_end: new Date(Date.now() + days * 864e5).toISOString(), provider: "manual" });
  done();
}

export async function cancelSubscription(f: FormData) {
  const { db } = await admin();
  await db.from("subscriptions").update({ status: "canceled" }).eq("user_id", uid(f)).eq("status", "active");
  done();
}

export async function addCredits(f: FormData) {
  const { db } = await admin();
  const credits = Math.min(100, Math.max(1, Number(f.get("credits")) || 1));
  await db.from("purchases").insert({ user_id: uid(f), kind: "pack", product: "manual", credits, status: "paid", provider: "manual" });
  done();
}

export async function addNote(f: FormData) {
  const { a, db } = await admin();
  const body = String(f.get("body") ?? "").trim().slice(0, 2000);
  if (body) await db.from("crm_notes").insert({ user_id: uid(f), author_id: a.user.id, body });
  done();
}
