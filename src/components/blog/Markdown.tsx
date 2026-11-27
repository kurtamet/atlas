/**
 * Small server-side renderer for blog articles: headings, paragraphs, lists, callouts, **bold**,
 * [links](/path) and the data directives of src/lib/seo/tables.ts ({{table:key}}, {{cta}}, inline {{Hd:slug}}).
 */
import { Fragment, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Dataset } from "@/lib/seo/comunas";
import type { Locale } from "@/lib/seo/site";
import { dataTable, inlineValue, type Cell } from "@/lib/seo/tables";

interface Ctx { ds: Dataset; l: Locale }

function inline(text: string, ctx: Ctx): ReactNode[] {
  const withValues = text.replace(/\{\{([^}]+)\}\}/g, (m, tok: string) => inlineValue(tok.trim(), ctx.ds, ctx.l) ?? m);
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(withValues))) {
    if (m.index > last) out.push(withValues.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else {
      const href = m[3];
      out.push(href.startsWith("/") ? <Link key={k++} href={href}>{m[2]}</Link> : <a key={k++} href={href} rel="noopener" target="_blank">{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < withValues.length) out.push(withValues.slice(last));
  return out;
}

const cell = (c: Cell) => (typeof c === "string" ? c : <Link href={c.href}>{c.text}</Link>);

export default function Markdown({ source, ds, l }: { source: string; ds: Dataset; l: Locale }) {
  const ctx = { ds, l };
  const blocks = source.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((raw, i) => {
        const b = raw.trim();
        const table = b.match(/^\{\{table:([\w-]+)\}\}$/);
        if (table) {
          const t = dataTable(table[1], ds, l);
          if (!t) return null;
          return (
            <figure className="sx-scroll" key={i}>
              <table className="sx-table sx-rank">
                <caption>{t.caption}</caption>
                <thead><tr>{t.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {t.rows.map((r, j) => (
                    <tr key={j}>{r.map((c, x) => <td key={x}>{cell(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {t.note && <figcaption className="sx-muted">{t.note}</figcaption>}
            </figure>
          );
        }
        if (b === "{{cta}}")
          return (
            <aside className="sx-callout sx-cta-box" key={i}>
              <p>{l === "es" ? "Busca cualquier dirección o rol del Gran Santiago y mira su precio de referencia, riesgos y entorno en el mapa. El informe completo de una propiedad se genera en minutos." : "Search any address or rol in Greater Santiago and see its reference price, hazards and surroundings on the map. A full property report is ready in minutes."}</p>
              <Link href="/" className="at-primary">{l === "es" ? "Abrir el mapa" : "Open the map"}</Link>
            </aside>
          );
        if (b.startsWith("### ")) return <h3 key={i}>{inline(b.slice(4), ctx)}</h3>;
        if (b.startsWith("## ")) {
          const text = b.slice(3);
          const id = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          return <h2 key={i} id={id}>{inline(text, ctx)}</h2>;
        }
        const lines = b.split("\n");
        if (lines.every((x) => /^- /.test(x))) return <ul key={i}>{lines.map((x, j) => <li key={j}>{inline(x.slice(2), ctx)}</li>)}</ul>;
        if (lines.every((x) => /^\d+\. /.test(x))) return <ol key={i}>{lines.map((x, j) => <li key={j}>{inline(x.replace(/^\d+\. /, ""), ctx)}</li>)}</ol>;
        if (b.startsWith("> ")) return <aside className="sx-callout" key={i}><p>{inline(lines.map((x) => x.replace(/^> ?/, "")).join(" "), ctx)}</p></aside>;
        return <p key={i}>{lines.map((x, j) => <Fragment key={j}>{j > 0 && " "}{inline(x, ctx)}</Fragment>)}</p>;
      })}
    </>
  );
}
