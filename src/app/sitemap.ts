import type { MetadataRoute } from "next";
import { localeUrl } from "@/lib/seo/site";
import { loadDataset } from "@/lib/seo/comunas";
import { POSTS } from "@/content/blog";
import { LEGAL_DOCS } from "@/lib/legal/operator";

type Entry = MetadataRoute.Sitemap[number];

/** one entry per page in Spanish (default), with its English alternate */
const entry = (path: string, priority: number, changeFrequency: Entry["changeFrequency"], lastModified?: string): Entry => ({
  url: localeUrl("es", path),
  lastModified: lastModified ?? new Date().toISOString().slice(0, 10),
  changeFrequency,
  priority,
  alternates: { languages: { es: localeUrl("es", path), en: localeUrl("en", path) } },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ds = await loadDataset();
  return [
    entry("/", 1, "weekly"),
    entry("/comunas", 0.9, "monthly"),
    ...ds.profiles.map((p) => entry(`/comunas/${p.slug}`, 0.8, "monthly")),
    entry("/blog", 0.8, "weekly"),
    ...POSTS.map((p) => entry(`/blog/${p.slug}`, 0.7, "monthly", p.updated ?? p.date)),
    entry("/trends", 0.7, "weekly"),
    entry("/pricing", 0.6, "monthly"),
    entry("/about", 0.6, "monthly"),
    entry("/methods", 0.6, "monthly"),
    entry("/partners", 0.5, "monthly"),
    ...LEGAL_DOCS.map((d) => entry(`/legal/${d}`, 0.2, "yearly")),
  ];
}
