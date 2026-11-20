/**
 * Trends charts (plain SVG). One measure per chart, one axis, direct labels where they fit,
 * native <title> tooltips on every mark, recessive grid.
 */
"use client";

const INK = "currentColor";
const GRID = "#d9ded9";
const MUTED = "#8a949c";

const fmtFor = (locale: string, dec = 0) => new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US", { maximumFractionDigits: dec, minimumFractionDigits: dec });

/** comunas ranked by one metric; the selected comuna is drawn in full colour, the rest lighter */
export function RankBars({ rows, color, selected, onSelect, unit, decimals, locale }: {
  rows: Array<{ code: string; name: string; value: number; locked?: boolean }>;
  color: string;
  selected: string | null;
  onSelect: (code: string) => void;
  unit: string;
  decimals: number;
  locale: string;
}) {
  const fmt = fmtFor(locale, decimals);
  const W = 640, L = 150, R = 70, RH = 19, H = rows.length * RH + 6;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const sx = (v: number) => ((W - L - R) * Math.max(0, v)) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {rows.map((r, i) => {
        const y = i * RH + 3, on = r.code === selected;
        // subscriber-only row: a skeleton without name or value (locked rows carry no data)
        if (r.locked) return (
          <g key={r.code} aria-hidden="true">
            <rect x={L - 98} y={y + 4} width={90} height={8} rx={4} fill="#e3e6e1" />
            <rect x={L} y={y + 2} width={(W - L - R) * (0.15 + ((i * 37) % 40) / 100)} height={RH - 7} rx={3} fill="#e3e6e1" />
          </g>
        );
        return (
          <g key={r.code} className="tr-hit" onClick={() => onSelect(r.code)}>
            <title>{`${r.name}: ${fmt.format(r.value)} ${unit}`}</title>
            <rect x={0} y={y - 2} width={W} height={RH} fill="transparent" />
            <text x={L - 8} y={y + 11} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <rect x={L} y={y + 2} width={Math.max(2, sx(r.value))} height={RH - 7} rx={3} fill={color} opacity={selected && !on ? 0.45 : 1} />
            <text x={L + sx(r.value) + 6} y={y + 11} className={on ? "tr-t tr-b" : "tr-t tr-m"}>{fmt.format(r.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** one line for the selected comuna and one for the median of all comunas, same axis */
export function PriceLines({ years, comuna, all, comunaName, allName, locale }: {
  years: string[];
  comuna: Array<number | null>;
  all: number[];
  comunaName: string;
  allName: string;
  locale: string;
}) {
  const fmt = fmtFor(locale);
  const W = 640, H = 240, L = 54, R = 120, T = 14, B = 26;
  const vals = [...all, ...comuna.filter((v): v is number => v !== null)];
  const lo = 0, hi = Math.max(...vals) * 1.08 || 1;
  const sx = (i: number) => L + ((W - L - R) * i) / Math.max(1, years.length - 1);
  const sy = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = Array.from({ length: 5 }, (_, i) => (hi * i) / 4);
  const path = (xs: Array<number | null>) => xs.map((v, i) => (v === null ? "" : `${i && xs[i - 1] !== null ? "L" : "M"}${sx(i)},${sy(v)}`)).join("");
  const lastC = comuna.length - 1 - [...comuna].reverse().findIndex((v) => v !== null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke={GRID} />
          <text x={L - 6} y={sy(v) + 4} textAnchor="end" className="tr-t tr-m">{fmt.format(v)}</text>
        </g>
      ))}
      {years.map((y, i) => <text key={y} x={sx(i)} y={H - 6} textAnchor="middle" className="tr-t tr-m">{y}</text>)}
      <path d={path(all)} fill="none" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" />
      <path d={path(comuna)} fill="none" stroke="#2f7c7a" strokeWidth={2.5} />
      {comuna.map((v, i) => v !== null && (
        <circle key={i} cx={sx(i)} cy={sy(v)} r={4} fill="#2f7c7a" stroke="#fff" strokeWidth={2}><title>{`${comunaName} ${years[i]}: ${fmt.format(v)} UF`}</title></circle>
      ))}
      {all.map((v, i) => <circle key={i} cx={sx(i)} cy={sy(v)} r={3} fill={MUTED}><title>{`${allName} ${years[i]}: ${fmt.format(v)} UF`}</title></circle>)}
      {lastC >= 0 && <text x={sx(lastC) + 8} y={sy(comuna[lastC]!) + 4} className="tr-t tr-b" fill="#2f7c7a">{comunaName}</text>}
      <text x={sx(all.length - 1) + 8} y={sy(all[all.length - 1]) + 4} className="tr-t tr-m">{allName}</text>
    </svg>
  );
}

/** change per comuna around zero: warm = worse, cool = better, labelled values */
export function ChangeBars({ rows, selected, worseIfUp, unit, locale }: {
  rows: Array<{ code: string; name: string; value: number }>;
  selected: string | null;
  worseIfUp: boolean;
  unit: string;
  locale: string;
}) {
  const fmt = fmtFor(locale);
  const W = 640, L = 150, RH = 19, H = rows.length * RH + 6, C = L + (W - L - 40) / 2;
  const m = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const half = Math.min(C - L - 48, W - C - 48);
  const sx = (v: number) => half * (v / m);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      <line x1={C} x2={C} y1={0} y2={H} stroke={GRID} />
      {rows.map((r, i) => {
        const y = i * RH + 3, bad = worseIfUp ? r.value > 0 : r.value < 0, on = r.code === selected;
        const w = sx(r.value);
        return (
          <g key={r.code}>
            <title>{`${r.name}: ${r.value > 0 ? "+" : ""}${fmt.format(r.value)}${unit}`}</title>
            <text x={L - 8} y={y + 11} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <rect x={w >= 0 ? C : C + w} y={y + 2} width={Math.max(2, Math.abs(w))} height={RH - 7} rx={3} fill={r.value === 0 ? MUTED : bad ? "#a4523f" : "#3d6a8f"} opacity={selected && !on ? 0.5 : 1} />
            <text x={w >= 0 ? C + w + 5 : C + w - 5} y={y + 11} textAnchor={w >= 0 ? "start" : "end"} className="tr-t tr-m">{r.value > 0 ? "+" : ""}{fmt.format(r.value)}{unit}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** present vs projected value per comuna (dumbbell), one axis */
export function Dumbbells({ rows, unit, locale, nowLabel, futureLabel }: {
  rows: Array<{ code: string; name: string; now: number; future: number }>;
  unit: string;
  locale: string;
  nowLabel: string;
  futureLabel: string;
}) {
  const fmt = fmtFor(locale);
  const W = 640, L = 150, R = 60, RH = 19, T = 22, H = rows.length * RH + T + 4;
  const max = Math.max(...rows.map((r) => Math.max(r.now, r.future))) * 1.05 || 1;
  const sx = (v: number) => L + ((W - L - R) * v) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      <circle cx={L} cy={8} r={5} fill={MUTED} /><text x={L + 10} y={12} className="tr-t tr-m">{nowLabel}</text>
      <circle cx={L + 150} cy={8} r={5} fill="#b5852f" /><text x={L + 160} y={12} className="tr-t tr-m">{futureLabel}</text>
      {rows.map((r, i) => {
        const y = T + i * RH + 9;
        return (
          <g key={r.code}>
            <title>{`${r.name}: ${fmt.format(r.now)} → ${fmt.format(r.future)} ${unit}`}</title>
            <text x={L - 8} y={y + 4} textAnchor="end" className="tr-t">{r.name}</text>
            <line x1={sx(r.now)} x2={sx(r.future)} y1={y} y2={y} stroke="#e1c48d" strokeWidth={3} />
            <circle cx={sx(r.now)} cy={y} r={5} fill={MUTED} stroke="#fff" strokeWidth={2} />
            <circle cx={sx(r.future)} cy={y} r={5} fill="#b5852f" stroke="#fff" strokeWidth={2} />
            <text x={sx(r.future) + 9} y={y + 4} className="tr-t tr-m">{fmt.format(r.future)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** two layers against each other, one dot per comuna, labelled on hover and when selected */
export function Scatter({ points, xLabel, yLabel, selected, onSelect, locale, xDec, yDec }: {
  points: Array<{ code: string; name: string; x: number; y: number }>;
  xLabel: string;
  yLabel: string;
  selected: string | null;
  onSelect: (code: string) => void;
  locale: string;
  xDec: number;
  yDec: number;
}) {
  const fx = fmtFor(locale, xDec), fy = fmtFor(locale, yDec);
  const W = 640, H = 340, L = 60, R = 20, T = 14, B = 40;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const pad = (a: number, b: number) => (b - a || 1) * 0.06;
  const sx = (v: number) => L + ((W - L - R) * (v - x0 + pad(x0, x1))) / (x1 - x0 + 2 * pad(x0, x1));
  const sy = (v: number) => T + (H - T - B) * (1 - (v - y0 + pad(y0, y1)) / (y1 - y0 + 2 * pad(y0, y1)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={GRID} />
      <line x1={L} x2={L} y1={T} y2={H - B} stroke={GRID} />
      <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="tr-t tr-m">{xLabel}</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} className="tr-t tr-m">{yLabel}</text>
      {[x0, x1].map((v) => <text key={`x${v}`} x={sx(v)} y={H - B + 14} textAnchor="middle" className="tr-t tr-m">{fx.format(v)}</text>)}
      {[y0, y1].map((v) => <text key={`y${v}`} x={L - 6} y={sy(v) + 4} textAnchor="end" className="tr-t tr-m">{fy.format(v)}</text>)}
      {points.map((p) => {
        const on = p.code === selected;
        return (
          <g key={p.code} className="tr-hit" onClick={() => onSelect(p.code)}>
            <title>{`${p.name}: ${fx.format(p.x)} · ${fy.format(p.y)}`}</title>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={12} fill="transparent" />
            <circle cx={sx(p.x)} cy={sy(p.y)} r={on ? 7 : 5} fill={on ? "#2f7c7a" : "#7fa9a7"} stroke="#fff" strokeWidth={2} />
            {on && <text x={sx(p.x) + 10} y={sy(p.y) - 8} className="tr-t tr-b" fill={INK}>{p.name}</text>}
          </g>
        );
      })}
    </svg>
  );
}
