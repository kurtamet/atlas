"use client";
/** Button pickers for the trends page: layers grouped by family, comunas grouped by sector. */
import { useState } from "react";

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="tr-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? "on" : ""} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function LayerChips({ groups, value, onChange, locked, lockedLabel }: {
  groups: Array<{ id: string; label: string; color: string; items: Array<{ id: string; label: string }> }>;
  value: string;
  onChange: (id: string) => void;
  locked: (id: string) => boolean;
  lockedLabel: string;
}) {
  return (
    <div className="tr-layers">
      {groups.map((g) => (
        <div key={g.id} className="tr-layer-row" style={{ ["--fam" as string]: g.color }}>
          <span className="tr-layer-fam">{g.label}</span>
          <div className="tr-chips">
            {g.items.map((it) => (
              <button key={it.id} type="button" className={`tr-chip${it.id === value ? " on" : ""}`} aria-pressed={it.id === value} onClick={() => onChange(it.id)} title={locked(it.id) ? lockedLabel : undefined}>
                {it.label}{locked(it.id) && <span className="tr-lockico" aria-label={lockedLabel}>🔒</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Comuna picker: every comuna is a button, grouped by sector, with a filter box.
 * Single mode: a click picks that comuna. Compare mode: a click adds or removes it (up to `max`).
 */
export function ComunaPicker({ sectors, picked, colors, compare, onPick, labels, max }: {
  sectors: Array<{ id: string; label: string; items: Array<{ code: string; name: string }> }>;
  picked: string[];
  colors: string[];
  compare: boolean;
  onPick: (code: string) => void;
  labels: { filter: string; none: string };
  max: number;
}) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nq = norm(q.trim());
  const shown = sectors.map((s) => ({ ...s, items: s.items.filter((c) => !nq || norm(c.name).includes(nq)) })).filter((s) => s.items.length);
  return (
    <div className="tr-comunas">
      <input className="tr-filter" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.filter} aria-label={labels.filter}
        onKeyDown={(e) => { if (e.key === "Enter" && shown.length === 1 && shown[0].items.length === 1) { onPick(shown[0].items[0].code); setQ(""); } }} />
      <div className="tr-sectors">
        {shown.map((s) => (
          <div key={s.id} className="tr-sector">
            <span className="tr-sector-name">{s.label}</span>
            <div className="tr-chips">
              {s.items.map((c) => {
                const k = picked.indexOf(c.code);
                const full = compare && k < 0 && picked.length >= max;
                return (
                  <button key={c.code} type="button" className={`tr-chip${k >= 0 ? " on" : ""}`} aria-pressed={k >= 0} disabled={full}
                    style={k >= 0 ? { ["--pick" as string]: colors[k] } : undefined} onClick={() => onPick(c.code)}>
                    {compare && k >= 0 && <i className="tr-dot" />}{c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!shown.length && <p className="tr-note">{labels.none}</p>}
      </div>
    </div>
  );
}
