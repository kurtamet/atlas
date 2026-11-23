"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { browserClient } from "@/lib/supabase/browser";

/** passwordless sign-in: Supabase e-mails a one-time link that lands on /api/auth/callback */
export default function SignIn({ failed = false, email: initial = "" }: { failed?: boolean; email?: string }) {
  const t = useTranslations("acct");
  const [email, setEmail] = useState(initial);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limit">("idle");
  const sb = browserClient();
  if (!sb) return <p className="at-lead">{t("notConfigured")}</p>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const next = window.location.pathname;
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}` } });
    // 429: the mail service hit its hourly limit (not the user's fault)
    setState(!error ? "sent" : error.status === 429 ? "limit" : "error");
    if (error) console.warn("sign-in e-mail failed", error.status, error.message);
  };
  return (
    <form className="ac-signin" onSubmit={submit}>
      <h2>{t("signInTitle")}</h2>
      <p>{t("signInText")}</p>
      {failed && <p className="ac-error">{t("linkFailed")}</p>}
      {state === "sent" ? <p className="ac-ok">{t("sent", { email })}</p> : (
        <>
          <label className="ac-field"><span>{t("email")}</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" /></label>
          <button type="submit" className="at-primary" disabled={state === "sending"}>{state === "sending" ? t("sending") : t("sendLink")}</button>
          {state === "error" && <p className="ac-error">{t("sendError")}</p>}
          {state === "limit" && <p className="ac-error">{t("sendLimit")}</p>}
        </>
      )}
    </form>
  );
}
