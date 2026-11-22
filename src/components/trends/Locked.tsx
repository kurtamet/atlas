"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** placeholder for subscriber-only content: skeleton bars (no real data in the page) and the CTA */
export function Locked({ rows = 8, compact = false }: { rows?: number; compact?: boolean }) {
  const tr = useTranslations("trends");
  return (
    <div className={compact ? "tr-locked tr-locked-compact" : "tr-locked"}>
      <div className="tr-skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => <i key={i} style={{ width: `${88 - ((i * 37) % 55)}%` }} />)}
      </div>
      <div className="tr-lock">
        <strong>{tr("lockTitle")}</strong>
        {!compact && <p>{tr("lockText")}</p>}
        <Link href="/pricing" className="at-primary tr-lock-cta">{tr("lockCta")}</Link>
      </div>
    </div>
  );
}
