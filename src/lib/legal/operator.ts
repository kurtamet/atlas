/**
 * Who runs PROMETEO, as printed in the legal pages and the footer.
 * Until the Chilean company exists the service is run by GARNET DEVELOPMENT CO., LTD (the entity behind Stripe).
 * Registration number and address are optional: left empty, they are simply not printed.
 * Bump LEGAL_VERSION whenever the texts change: checkout asks for the current version.
 */
export const LEGAL_VERSION = "0.2-beta";
export const LEGAL_UPDATED = { es: "23 de noviembre de 2026", en: "November 23, 2026" } as const;

export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || "GARNET DEVELOPMENT CO., LTD",
  /** company registration number (RUT once Chilean), e.g. "N° de registro 12345678" / "RUT 76.123.456-7" */
  reg: process.env.NEXT_PUBLIC_LEGAL_REG || "",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "",
  email: "hola@prometeo.land",
  site: "prometeo.land",
};

/** "NAME, reg, con domicilio en address" with the empty parts left out */
export function operatorLine(locale: "es" | "en"): string {
  const parts = [OPERATOR.name];
  if (OPERATOR.reg) parts.push(OPERATOR.reg);
  if (OPERATOR.address) parts.push(`${locale === "en" ? "located at" : "con domicilio en"} ${OPERATOR.address}`);
  return parts.join(", ");
}

export const LEGAL_DOCS = ["terms", "privacy", "refunds"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const isLegalDoc = (s: string): s is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(s);
