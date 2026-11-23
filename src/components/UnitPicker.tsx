"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "./commerce/Modal";
import { KINDS, ACCESSORY, mixOf, unitLabel, type Unit, type UnitKind } from "@/lib/object/units";

/** pick the unit (apartment, office, shop, parking…) of a building that the report is about */
export default function UnitPicker(p: { units: Unit[]; value: Unit | null; onPick: (u: Unit | null) => void; onClose: () => void }) {
  const t = useTranslations("object.unit");
  return <Modal onClose={p.onClose} label={t("pickTitle")} wide><UnitList {...p} /></Modal>;
}

/** the picker itself, also shown inside the purchase dialog */
export function UnitList({ units, value, onPick, onClose }: { units: Unit[]; value: Unit | null; onPick: (u: Unit | null) => void; onClose: () => void }) {
  const t = useTranslations("object.unit");
  const mix = useMemo(() => mixOf(units), [units]);
  const kinds = KINDS.filter((k) => mix[k]);
  const firstMain = kinds.find((k) => !ACCESSORY.has(k)) ?? kinds[0];
  const [kind, setKind] = useState<UnitKind | "all">(value?.kind ?? firstMain ?? "all");
  const [q, setQ] = useState("");
  const shown = units.filter((u) => (kind === "all" || u.kind === kind) && (!q || u.dir.toUpperCase().includes(q.trim().toUpperCase())));
  const pick = (u: Unit | null) => { onPick(u); onClose(); };

  return (
      <div className="pm-units">
        <h2>{t("pickTitle")}</h2>
        <p className="pm-lead">{t("pickLead")}</p>
        <div className="pm-unit-tabs" role="tablist">
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
              {t(`kinds_${k}`, { n: mix[k] ?? 0 })}
            </button>
          ))}
        </div>
        <input className="pm-unit-search" type="search" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={`pm-unit-row pm-unit-all${value === null ? " on" : ""}`} onClick={() => pick(null)}>
          <b>{t("wholeBuilding")}</b><small>{t("wholeBuildingNote")}</small>
        </button>
        <div className="pm-unit-list">
          {shown.slice(0, 400).map((u) => (
            <button key={u.rol} type="button" className={`pm-unit-row${value?.rol === u.rol ? " on" : ""}`} onClick={() => pick(u)}>
              <b>{unitLabel(u.dir)}</b>
              <small>
                {[t(`kind_${u.kind}`), u.m2 ? `${u.m2} m²` : null, u.yr ? String(u.yr) : null, `rol ${u.rol}`].filter(Boolean).join(" · ")}
              </small>
            </button>
          ))}
          {shown.length > 400 && <p className="pm-fine">{t("refine", { n: shown.length - 400 })}</p>}
          {!shown.length && <p className="pm-fine">{t("none")}</p>}
        </div>
      </div>
  );
}
