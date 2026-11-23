"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** "I accept the Terms…" checkbox shown before any payment; kind picks the wording (single report vs plans/packs) */
export default function Consent({ kind, checked, missing, onChange, className }: {
  kind: "single" | "plans";
  checked: boolean;
  missing?: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("legal");
  const link = (href: string) => function DocLink(chunks: React.ReactNode) { return <Link href={href} target="_blank">{chunks}</Link>; };
  return (
    <label className={["pm-consent", missing && !checked ? "pm-consent-missing" : "", className ?? ""].join(" ").trim()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {t.rich(kind === "single" ? "consentSingle" : "consentPlans", {
          terms: link("/legal/terms"),
          privacy: link("/legal/privacy"),
          refunds: link("/legal/refunds"),
        })}
        {missing && !checked && <> {t("consentRequired")}</>}
      </span>
    </label>
  );
}
