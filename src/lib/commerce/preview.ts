import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Timed trends preview: a visitor without a plan sees full trends for PREVIEW_MINUTES from the first
 * opening of the section, then the free view. The start time sits in an httpOnly signed cookie, so
 * clearing localStorage or editing the cookie does not reset it (a new browser or private window does).
 */
export const PREVIEW_MINUTES = 5;
export const PREVIEW_COOKIE = "pm_trends_preview";
const MAX_AGE_S = 30 * 24 * 3600; // one preview per browser per 30 days

const secret = () => process.env.TRENDS_PREVIEW_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? "dev-preview-secret";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function readStart(cookie: string | undefined): number | null {
  if (!cookie) return null;
  const [v, sig] = cookie.split(".");
  if (!v || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(v));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const t = Number(v);
  return Number.isFinite(t) ? t : null;
}

export const makeCookie = (start: number) => ({ name: PREVIEW_COOKIE, value: `${start}.${sign(String(start))}`, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S });

/** start (or continue) the preview; returns when it ends and whether a cookie has to be set */
export function previewState(cookie: string | undefined, now = Date.now()): { start: number; endsAt: number; open: boolean; isNew: boolean } {
  const known = readStart(cookie);
  const start = known && known <= now ? known : now;
  const endsAt = start + PREVIEW_MINUTES * 60_000;
  return { start, endsAt, open: now < endsAt, isNew: known === null };
}
