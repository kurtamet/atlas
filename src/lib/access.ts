"use client";
/**
 * Who is looking: anonymous visitor, signed-in user or subscriber. The answer comes from /api/me
 * (Supabase session, checked on the server). Locked data is also filtered on the server (/api/trends),
 * so this hook only decides what to draw.
 * Outside production, `?sub=1` (remembered, `?sub=0` clears it) previews the subscriber view.
 */
import { useSyncExternalStore } from "react";

export interface Me {
  configured: boolean;
  email: string | null;
  role: "user" | "admin" | null;
  subscriber: boolean;
  subscriptionEnd: string | null;
  credits: number;
}

const ANON: Me = { configured: false, email: null, role: null, subscriber: false, subscriptionEnd: null, credits: 0 };
const KEY = "atlas-preview-subscriber";
let me: Me | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function preview(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const q = new URLSearchParams(window.location.search).get("sub");
  if (q === "1") localStorage.setItem(KEY, "1");
  if (q === "0") localStorage.removeItem(KEY);
  return localStorage.getItem(KEY) === "1";
}

export function refreshMe(): Promise<void> {
  pending = fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : ANON))
    .catch(() => ANON)
    .then((m) => { me = m; listeners.forEach((l) => l()); });
  return pending;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  if (!me && !pending) void refreshMe();
  return () => { listeners.delete(cb); };
};

export function useMe(): { me: Me | null; loading: boolean } {
  const m = useSyncExternalStore(subscribe, () => me, () => null);
  return { me: m, loading: m === null };
}

export function useAccess(): { subscriber: boolean; signedIn: boolean; loading: boolean } {
  const { me: m, loading } = useMe();
  const pv = useSyncExternalStore(() => () => {}, preview, () => false);
  return { subscriber: Boolean(m?.subscriber) || pv, signedIn: Boolean(m?.email), loading };
}

/** query string for /api/trends that carries the dev preview flag */
export const previewQuery = () => (typeof window !== "undefined" && preview() ? "?preview=1" : "");
