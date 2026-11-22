import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { currentAccount, userClient } from "@/lib/supabase/server";
import SignIn from "@/components/account/SignIn";
import { stripe, stripeConfigured } from "@/lib/commerce/stripe";
import { planById } from "@/lib/commerce/plans";
import { saveProfile } from "./actions";

export const dynamic = "force-dynamic";
const SEGMENTS = ["agent", "investor", "flipper", "institution", "buyer", "other"] as const;

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ auth?: string; checkout?: string }> }) {
  const { locale } = await params;
  const { auth, checkout } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("pages.account");
  const a = await getTranslations("acct");
  // back from Stripe Checkout (pack or plan): apply it now instead of waiting for the webhook
  const bought = checkout && /^cs_[A-Za-z0-9_]+$/.test(checkout) && stripeConfigured() ? await applyCheckout(checkout) : null;
  const account = await currentAccount();
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(locale === "es" ? "es-CL" : "en-US", { day: "numeric", month: "short", year: "numeric" });

  if (!account) {
    return (
      <section className="at-page ac">
        <p className="at-eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        {bought ? <p className="ac-ok">{a("boughtGuest", { email: bought.email ?? "" })}</p> : <p className="at-lead">{t("lead")}</p>}
        <SignIn failed={auth === "failed"} email={bought?.email ?? undefined} />
      </section>
    );
  }

  const sb = (await userClient())!;
  const [{ data: profile }, { data: reports }] = await Promise.all([
    sb.from("profiles").select("full_name, company, segment").eq("id", account.user.id).maybeSingle(),
    sb.from("reports").select("id, title, comuna, created_at, source").eq("user_id", account.user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <section className="at-page ac">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{a("hello", { email: account.user.email ?? "" })}</h1>
      {bought && <p className="ac-ok">{a("bought")}</p>}
      <div className="ac-tiles">
        <div>
          <b>{account.role === "admin" ? a("planAdmin") : account.plan ? a(`plan_${account.plan}`) : a("planFree")}</b>
          <span>{account.subscriptionEnd ? a(account.cancelAtPeriodEnd ? "planEnds" : "planRenews", { date: fmtDate(account.subscriptionEnd) }) : account.subscriber ? "" : a("planFreeText")}</span>
        </div>
        <div>
          <b>{account.planReportsLeft === null ? "∞" : account.planReportsLeft + account.credits}</b>
          <span>{account.plan && account.planReportsLeft !== null ? a("leftSplit", { plan: account.planReportsLeft, of: planById(account.plan)?.reports ?? 0, credits: account.credits }) : a("credits")}</span>
        </div>
        <div><b>{reports?.length ?? 0}</b><span>{a("reportsCount")}</span></div>
      </div>
      <div className="ac-actions">
        {account.role !== "admin" && !account.plan && <Link href="/pricing" className="at-primary">{a("choosePlan")}</Link>}
        {account.plan && account.planReportsLeft === 0 && account.credits === 0 && <Link href="/pricing#packs" className="at-primary">{a("buyPack")}</Link>}
        {account.plan && account.plan !== "unlimited" && <Link href="/pricing" className="at-secondary">{a("upgrade")}</Link>}
        {stripeConfigured() && account.role !== "admin" && (account.plan || account.credits > 0) && (
          <form action="/api/billing/portal" method="post"><button type="submit" className="at-secondary">{a("billing")}</button></form>
        )}
      </div>

      <h2 className="ac-h">{a("reports")}</h2>
      {reports?.length ? (
        <table className="ac-table">
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td><a href={`/${locale}/report?saved=${r.id}`} target="_blank" rel="noreferrer">{r.title}</a></td>
                <td>{r.comuna}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td className="ac-muted">{r.source === "claude" ? "AI" : a("draft")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="ac-muted">{a("noReports")} <Link href="/">{a("toMap")}</Link></p>}

      <h2 className="ac-h">{a("profile")}</h2>
      <form action={saveProfile} className="ac-form">
        <label className="ac-field"><span>{a("name")}</span><input name="full_name" defaultValue={profile?.full_name ?? ""} /></label>
        <label className="ac-field"><span>{a("company")}</span><input name="company" defaultValue={profile?.company ?? ""} /></label>
        <label className="ac-field"><span>{a("segment")}</span>
          <select name="segment" defaultValue={profile?.segment ?? ""}>
            <option value="">—</option>
            {SEGMENTS.map((s) => <option key={s} value={s}>{a(`seg_${s}`)}</option>)}
          </select>
        </label>
        <button type="submit" className="at-secondary">{a("save")}</button>
      </form>

      <div className="ac-foot">
        {account.role === "admin" && <Link href="/admin" className="at-secondary">{a("admin")}</Link>}
        <form action="/api/auth/signout" method="post"><button type="submit" className="at-secondary">{a("signOut")}</button></form>
      </div>
    </section>
  );
}

/** fulfils the Checkout session the user just came back from; returns its e-mail, or null */
async function applyCheckout(id: string): Promise<{ email: string | null } | null> {
  try {
    const { fulfillSession } = await import("@/lib/commerce/stripe");
    const session = await stripe().checkout.sessions.retrieve(id);
    const f = await fulfillSession(session);
    return f ? { email: f.email } : null;
  } catch (e) {
    console.error("account: checkout apply failed", e);
    return null;
  }
}
