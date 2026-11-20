"use server";
import { revalidatePath } from "next/cache";
import { userClient } from "@/lib/supabase/server";

const SEGMENTS = ["agent", "investor", "flipper", "institution", "buyer", "other"];

/** the user edits their own profile (RLS + column grants keep role untouchable) */
export async function saveProfile(form: FormData) {
  const sb = await userClient();
  const { data: { user } } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !user) return;
  const segment = String(form.get("segment") ?? "");
  await sb.from("profiles").update({
    full_name: String(form.get("full_name") ?? "").slice(0, 120) || null,
    company: String(form.get("company") ?? "").slice(0, 120) || null,
    segment: SEGMENTS.includes(segment) ? segment : null,
  }).eq("id", user.id);
  revalidatePath("/[locale]/account", "page");
}
