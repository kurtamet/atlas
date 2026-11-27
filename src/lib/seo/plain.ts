import type { Dataset } from "./comunas.ts";
import type { Locale } from "./site.ts";
import { dataTable, inlineValue, type Cell } from "./tables.ts";

/** plain text of an article for llms-full.txt (directives resolved, tables as markdown) */
export function plainText(source: string, ds: Dataset, l: Locale): string {
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((b) => {
      const table = b.trim().match(/^\{\{table:([\w-]+)\}\}$/);
      if (table) {
        const t = dataTable(table[1], ds, l);
        if (!t) return "";
        const c = (x: Cell) => (typeof x === "string" ? x : x.text);
        return [`${t.caption}`, "", `| ${t.head.join(" | ")} |`, `|${t.head.map(() => "---").join("|")}|`, ...t.rows.map((r) => `| ${r.map(c).join(" | ")} |`), t.note ? `\n${t.note}` : ""].join("\n");
      }
      if (b.trim() === "{{cta}}") return "";
      return b.replace(/\{\{([^}]+)\}\}/g, (m, tok: string) => inlineValue(tok.trim(), ds, l) ?? m);
    })
    .filter(Boolean)
    .join("\n\n");
}
