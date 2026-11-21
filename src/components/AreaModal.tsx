"use client";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/** full detail of a comuna/zone (every layer, method notes) in the same large sheet as the object */
export default function AreaModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  const t = useTranslations();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="at-report-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="at-report at-area-report" onClick={(e) => e.stopPropagation()}>
        <div className="at-report-head">
          <div>
            <span className="at-eyebrow">{t("drawer.territory")}</span>
            <h1>{title}</h1>
            <p className="at-subline">{subtitle}</p>
          </div>
          <div className="at-report-actions">
            <button type="button" className="at-close" aria-label={t("drawer.close")} onClick={onClose}>×</button>
          </div>
        </div>
        <div className="at-area-body">{children}</div>
      </div>
    </div>
  );
}
