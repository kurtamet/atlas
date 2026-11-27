export interface PostText {
  title: string;
  description: string;
  /** mini-markdown, see src/components/blog/Markdown.tsx */
  body: string;
}

export interface Post {
  slug: string;
  /** ISO date of publication */
  date: string;
  updated?: string;
  tags: string[];
  es: PostText;
  en: PostText;
}
