/**
 * Blog articles. To add one: create a file like precio-m2-santiago.ts (ES + EN text, mini-markdown with
 * data directives) and list it here; the blog index, sitemap, llms.txt and comuna pages pick it up.
 */
import type { Post } from "./types";
import precio from "./precio-m2-santiago";
import calidad from "./calidad-precio";
import riesgos from "./riesgos";
import entorno from "./entorno";
import checklist from "./checklist";

export type { Post } from "./types";

export const POSTS: Post[] = [precio, calidad, riesgos, entorno, checklist].sort((a, b) => b.date.localeCompare(a.date));

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);
