"use client";
/**
 * Who may see subscriber content. Until accounts exist (Supabase auth), everyone is a free visitor;
 * `?sub=1` (remembered in localStorage, `?sub=0` clears it) previews the subscriber view.
 * The real check must also happen on the server: free visitors should not receive locked data.
 */
import { useSyncExternalStore } from "react";

const KEY = "atlas-preview-subscriber";

function read(): boolean {
  const q = new URLSearchParams(window.location.search).get("sub");
  if (q === "1") localStorage.setItem(KEY, "1");
  if (q === "0") localStorage.removeItem(KEY);
  return localStorage.getItem(KEY) === "1";
}
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function useAccess(): { subscriber: boolean } {
  const subscriber = useSyncExternalStore(subscribe, read, () => false);
  return { subscriber };
}
