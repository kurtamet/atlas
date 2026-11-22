import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { adminClient, currentAccount } from "@/lib/supabase/server";
import { grantSubscription, cancelSubscription, addCredits, addNote } from "./actions";

export const dynamic = "force-dynamic";
/** request time (a dynamic server page renders once per request) */
const requestTime = () => Date.now();

interface Row {
  id: string; email: string | null; full_name: string | null; company: string | null; segment: string | null; role: string; created_at: string;
  subscriptions: Array<{ status: string; current_period_end: string }>;
  purchases: Array<{ status: string; credits: number; kind: string; amount_clp: number | null }>;
  reports: Array<{ created_at: string; paid_with: string }>;
  crm_notes: Array<{ body: string; created_at: string }>;
}

/** simple CRM: customers, their plan, credits and reports, manual grants and notes (admins only) */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const account = await currentAccount();
  const db = adminClient();
  if (!account || account.role !== "admin" || !db) notFound();
  const t = await getTranslations("admin");
  const { data, error } = await db.from("profiles")
    .select("id, email, full_name, company, segment, role, created_at, subscriptions(status, current_period_end), purchases(status, credits, kind, amount_clp), reports(created_at, paid_with), crm_notes!crm_notes_user_id_fkey(body, created_at)")
    .order("created_at", { ascending: false }).limit(500);
  if (error) console.error("admin: customers query failed", error.message);
  const rows = (data ?? []) as Row[];
  const now = requestTime();
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "es" ? "es-CL" : "en-US", { day: "numeric", month: "short", year: "2-digit" });
  const subEnd = (r: Row) => r.subscriptions.filter((s) => s.status === "active" && Date.parse(s.current_period_end) > now).map((s) => s.current_period_end).sort().pop();
  const credits = (r: Row) => r.purchases.filter((p) => p.status === "paid" && p.kind !== "subscription").reduce((n, p) => n + p.credits, 0) - r.reports.filter((x) => x.paid_with === "credit").length;
  const revenue = rows.reduce((n, r) => n + r.purchases.filter((p) => p.status === "paid").reduce((m, p) => m + (p.amount_clp ?? 0), 0), 0);

  return (
    <section className="at-page ac ad">
      <p className="at-eyebrow">{t("eyebrow")}</p>
      <h1>{t("title")}</h1>
      <div className="ac-tiles">
        <div><b>{rows.length}</b><span>{t("users")}</span></div>
        <div><b>{rows.filter(subEnd).length}</b><span>{t("subscribers")}</span></div>
        <div><b>{rows.reduce((n, r) => n + r.reports.length, 0)}</b><span>{t("reports")}</span></div>
        <div><b>{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(revenue)}</b><span>{t("revenue")}</span></div>
      </div>
      <table className="ac-table ad-table">
        <thead><tr><th>{t("user")}</th><th>{t("segment")}</th><th>{t("since")}</th><th>{t("plan")}</th><th>{t("credits")}</th><th>{t("reports")}</th><th>{t("actions")}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const end = subEnd(r);
            const last = r.reports.map((x) => x.created_at).sort().pop();
            return (
              <tr key={r.id}>
                <td><b>{r.email}</b>{r.role === "admin" && <span className="ad-pill">admin</span>}<br /><span className="ac-muted">{[r.full_name, r.company].filter(Boolean).join(" · ")}</span>
                  {r.crm_notes.sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 3).map((n, i) => <p key={i} className="ad-note">{fmt(n.created_at)} · {n.body}</p>)}
                </td>
                <td>{r.segment ? t(`seg_${r.segment}`) : "—"}</td>
                <td>{fmt(r.created_at)}</td>
                <td>{end ? t("subUntil", { date: fmt(end) }) : t("free")}</td>
                <td>{credits(r)}</td>
                <td>{r.reports.length}{last ? <><br /><span className="ac-muted">{fmt(last)}</span></> : null}</td>
                <td className="ad-actions">
                  <form action={grantSubscription}><input type="hidden" name="user_id" value={r.id} /><select name="plan" defaultValue="unlimited"><option value="basic">Básica</option><option value="partner">Partner</option><option value="unlimited">Ilimitada</option></select><input name="days" type="number" defaultValue={30} min={1} max={400} /><button className="at-secondary">{t("grant")}</button></form>
                  {end && <form action={cancelSubscription}><input type="hidden" name="user_id" value={r.id} /><button className="at-secondary">{t("cancel")}</button></form>}
                  <form action={addCredits}><input type="hidden" name="user_id" value={r.id} /><input name="credits" type="number" defaultValue={10} min={1} max={100} /><button className="at-secondary">{t("addCredits")}</button></form>
                  <form action={addNote}><input type="hidden" name="user_id" value={r.id} /><input name="body" placeholder={t("notePh")} /><button className="at-secondary">{t("addNote")}</button></form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ac-note">{t("howAdmin")}</p>
    </section>
  );
}
