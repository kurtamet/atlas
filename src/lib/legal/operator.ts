/**
 * Who runs PROMETEO, as printed in the legal pages.
 * Placeholders in [brackets] are shown highlighted on the site until the Chilean company exists:
 * fill them here (or through the env vars) and every legal page picks them up.
 */
export const LEGAL_VERSION = "0.1-beta";
export const LEGAL_UPDATED = { es: "23 de noviembre de 2026", en: "November 23, 2026" } as const;

export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || "[RAZÓN SOCIAL / NOMBRE DEL TITULAR]",
  rut: process.env.NEXT_PUBLIC_LEGAL_RUT || "[RUT]",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[DOMICILIO], Santiago, Chile",
  email: "hola@prometeo.land",
  site: "prometeo.land",
};

export const LEGAL_DOCS = ["terms", "privacy", "refunds"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const isLegalDoc = (s: string): s is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(s);
