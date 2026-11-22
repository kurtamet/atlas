"use client";
import { useEffect } from "react";

/** small centred dialog used by the purchase flow (closes on Esc and on the backdrop) */
export default function Modal({ onClose, label, children, wide = false }: { onClose: () => void; label: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="pm-overlay" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className={wide ? "pm-modal pm-modal-wide" : "pm-modal"} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="at-close pm-x" aria-label="×" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}
