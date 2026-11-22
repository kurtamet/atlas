/**
 * Trends charts (plain SVG). One measure per chart, one axis, direct labels where they fit,
 * native <title> tooltips on every mark, recessive grid.
 *
 * `marks` = the comunas the user picked: code → colour (compare mode) or null (single mode, use
 * the chart's own colour at full strength). Unmarked comunas are drawn lighter when anything is marked.
 */
"use client";

export type Marks = Map<string, string | null>;

const GRID = "#d9ded9";
const MUTED = "#8a949c";
const LIGHT = 0.4;

export const fmtFor = (locale: string, dec = 0) => new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US", { maximumFractionDigits: dec, minimumFractionDigits: dec });
const signed = (f: Intl.NumberFormat, v: number) => `${v > 0 ? "+" : ""}${f.format(v)}`;

/** pushes label positions apart so end-of-line labels don't overlap */
function spread(ys: number[], gap = 13): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) if (order[k].y - order[k - 1].y < gap) order[k].y = order[k - 1].y + gap;
  const out = [...ys];
  for (const o of order) out[o.i] = o.y;
  return out;
}

/** comunas ranked by one metric, with the median of all comunas as a guide */
export function RankBars({ rows, color, marks, onSelect, unit, decimals, locale, median, medianLabel }: {
  rows: Array<{ code: string; name: string; value: number; locked?: boolean }>;
  color: string;
  marks: Marks;
  onSelect: (code: string) => void;
  unit: string;
  decimals: number;
  locale: string;
  median?: number;
  medianLabel?: string;
}) {
  const fmt = fmtFor(locale, decimals);
  const W = 640, L = 150, R = 70, RH = 19, T = median !== undefined ? 16 : 0, H = rows.length * RH + 6 + T;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const sx = (v: number) => ((W - L - R) * Math.max(0, v)) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {median !== undefined && Number.isFinite(median) && (
        <g>
          <line x1={L + sx(median)} x2={L + sx(median)} y1={12} y2={H} stroke={MUTED} strokeDasharray="3 3" />
          <text x={L + sx(median)} y={9} textAnchor="middle" className="tr-t tr-m">{medianLabel} {fmt.format(median)}</text>
        </g>
      )}
      {rows.map((r, i) => {
        const y = T + i * RH + 3, on = marks.has(r.code);
        // subscriber-only row: a skeleton without name or value (locked rows carry no data)
        if (r.locked) return (
          <g key={r.code} aria-hidden="true">
            <rect x={L - 98} y={y + 4} width={90} height={8} rx={4} fill="#e3e6e1" />
            <rect x={L} y={y + 2} width={(W - L - R) * (0.15 + ((i * 37) % 40) / 100)} height={RH - 7} rx={3} fill="#e3e6e1" />
          </g>
        );
        return (
          <g key={r.code} className="tr-hit" onClick={() => onSelect(r.code)}>
            <title>{`${i + 1}. ${r.name}: ${fmt.format(r.value)} ${unit}`}</title>
            <rect x={0} y={y - 2} width={W} height={RH} fill="transparent" />
            <text x={L - 8} y={y + 11} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <rect x={L} y={y + 2} width={Math.max(2, sx(r.value))} height={RH - 7} rx={3} fill={marks.get(r.code) ?? color} opacity={marks.size && !on ? LIGHT : 1} />
            <text x={L + sx(r.value) + 6} y={y + 11} className={on ? "tr-t tr-b" : "tr-t tr-m"}>{fmt.format(r.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** a few lines on one axis (picked comunas + reference), labelled at their last point */
export function Lines({ years, series, reference, locale, unit, decimals = 0, zero = true, partial }: {
  years: string[];
  series: Array<{ name: string; color: string; values: Array<number | null> }>;
  reference?: { name: string; values: Array<number | null> };
  locale: string;
  unit: string;
  decimals?: number;
  /** axis starts at zero (amounts) or hugs the data (index) */
  zero?: boolean;
  /** label of a year whose data is still partial */
  partial?: string | null;
}) {
  const fmt = fmtFor(locale, decimals);
  const W = 640, H = 250, L = 56, R = 130, T = 14, B = 26;
  const all = [...series, ...(reference ? [{ ...reference, color: MUTED }] : [])];
  const vals = all.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  const hi0 = Math.max(...vals), lo0 = Math.min(...vals);
  const lo = zero ? 0 : lo0 - (hi0 - lo0) * 0.08, hi = hi0 + (hi0 - lo) * 0.08 || 1;
  const sx = (i: number) => L + ((W - L - R) * i) / Math.max(1, years.length - 1);
  const sy = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const path = (xs: Array<number | null>) => xs.map((v, i) => (v === null ? "" : `${i && xs[i - 1] !== null ? "L" : "M"}${sx(i)},${sy(v)}`)).join("");
  const lastIdx = (xs: Array<number | null>) => xs.length - 1 - [...xs].reverse().findIndex((v) => v !== null);
  const ends = all.map((s) => { const i = lastIdx(s.values); return i >= 0 && i < s.values.length ? sy(s.values[i]!) + 4 : -100; });
  const labelY = spread(ends);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke={GRID} />
          <text x={L - 6} y={sy(v) + 4} textAnchor="end" className="tr-t tr-m">{fmtFor(locale, hi - lo < 10 ? 1 : 0).format(v)}</text>
        </g>
      ))}
      {years.map((y, i) => <text key={y} x={sx(i)} y={H - 6} textAnchor="middle" className="tr-t tr-m">{y === partial ? `${y}*` : y}</text>)}
      {reference && <path d={path(reference.values)} fill="none" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" />}
      {series.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2.5} />)}
      {all.map((s, k) => s.values.map((v, i) => v !== null && (
        <circle key={`${k}-${i}`} cx={sx(i)} cy={sy(v)} r={k < series.length ? 4 : 3} fill={s.color} stroke="#fff" strokeWidth={k < series.length ? 2 : 0}>
          <title>{`${s.name} ${years[i]}: ${fmt.format(v)} ${unit}`}</title>
        </circle>
      )))}
      {all.map((s, k) => {
        const i = lastIdx(s.values);
        return i >= 0 && i < s.values.length ? <text key={s.name} x={sx(i) + 8} y={labelY[k]} className={k < series.length ? "tr-t tr-b" : "tr-t tr-m"} fill={k < series.length ? s.color : undefined}>{s.name}</text> : null;
      })}
    </svg>
  );
}

/** change per comuna around zero. tone "risk": up = worse (warm); tone "neutral": up = teal, down = sand */
export function ChangeBars({ rows, marks, tone, unit, locale, onSelect }: {
  rows: Array<{ code: string; name: string; value: number }>;
  marks: Marks;
  tone: "risk" | "neutral";
  unit: string;
  locale: string;
  onSelect?: (code: string) => void;
}) {
  const fmt = fmtFor(locale);
  const W = 640, L = 150, RH = 19, H = rows.length * RH + 6;
  const lo = Math.min(0, ...rows.map((r) => r.value)), hi = Math.max(0, ...rows.map((r) => r.value));
  const span = hi - lo || 1, inner = W - L - 100;
  const C = L + 46 + (inner * -lo) / span;
  const sx = (v: number) => (inner * v) / span;
  const fill = (v: number) => (v === 0 ? MUTED : tone === "risk" ? (v > 0 ? "#a4523f" : "#3d6a8f") : v > 0 ? "#2f7c7a" : "#c49a5a");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      <line x1={C} x2={C} y1={0} y2={H} stroke={GRID} />
      {rows.map((r, i) => {
        const y = i * RH + 3, on = marks.has(r.code), w = sx(r.value);
        return (
          <g key={r.code} className={onSelect ? "tr-hit" : undefined} onClick={onSelect ? () => onSelect(r.code) : undefined}>
            <title>{`${r.name}: ${signed(fmt, r.value)}${unit}`}</title>
            <rect x={0} y={y - 2} width={W} height={RH} fill="transparent" />
            <text x={L - 8} y={y + 11} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <rect x={w >= 0 ? C : C + w} y={y + 2} width={Math.max(2, Math.abs(w))} height={RH - 7} rx={3} fill={marks.get(r.code) ?? fill(r.value)} opacity={marks.size && !on ? LIGHT + 0.1 : 1} />
            <text x={w >= 0 ? C + w + 5 : C + w - 5} y={y + 11} textAnchor={w >= 0 ? "start" : "end"} className={on ? "tr-t tr-b" : "tr-t tr-m"}>{signed(fmt, r.value)}{unit}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** middle half of deal prices (p25–p75) with the median, one row per comuna */
export function RangeBars({ rows, marks, locale, unit, onSelect }: {
  rows: Array<{ code: string; name: string; lo: number; mid: number; hi: number }>;
  marks: Marks;
  locale: string;
  unit: string;
  onSelect: (code: string) => void;
}) {
  const fmt = fmtFor(locale);
  const W = 640, L = 150, R = 60, RH = 19, T = 18, H = rows.length * RH + T + 4;
  const max = Math.max(...rows.map((r) => r.hi)) * 1.02 || 1;
  const sx = (v: number) => L + ((W - L - R) * v) / max;
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={T - 4} y2={H} stroke={GRID} />
          <text x={sx(v)} y={10} textAnchor="middle" className="tr-t tr-m">{fmt.format(v)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = T + i * RH + 9, on = marks.has(r.code), c = marks.get(r.code) ?? "#2f7c7a";
        return (
          <g key={r.code} className="tr-hit" onClick={() => onSelect(r.code)} opacity={marks.size && !on ? 0.55 : 1}>
            <title>{`${r.name}: ${fmt.format(r.lo)}–${fmt.format(r.hi)} ${unit} (mediana ${fmt.format(r.mid)})`}</title>
            <rect x={0} y={y - 9} width={W} height={RH} fill="transparent" />
            <text x={L - 8} y={y + 4} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <rect x={sx(r.lo)} y={y - 4} width={Math.max(2, sx(r.hi) - sx(r.lo))} height={8} rx={4} fill={c} opacity={0.3} />
            <circle cx={sx(r.mid)} cy={y} r={4.5} fill={c} stroke="#fff" strokeWidth={1.5} />
            <text x={sx(r.hi) + 6} y={y + 4} className={on ? "tr-t tr-b" : "tr-t tr-m"}>{fmt.format(r.mid)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** present vs projected value per comuna (dumbbell), one axis */
export function Dumbbells({ rows, marks, unit, locale, nowLabel, futureLabel }: {
  rows: Array<{ code: string; name: string; now: number; future: number }>;
  marks: Marks;
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
        const y = T + i * RH + 9, on = marks.has(r.code);
        return (
          <g key={r.code} opacity={marks.size && !on ? 0.5 : 1}>
            <title>{`${r.name}: ${fmt.format(r.now)} → ${fmt.format(r.future)} ${unit}`}</title>
            <text x={L - 8} y={y + 4} textAnchor="end" className={on ? "tr-t tr-b" : "tr-t"}>{r.name}</text>
            <line x1={sx(r.now)} x2={sx(r.future)} y1={y} y2={y} stroke="#e1c48d" strokeWidth={3} />
            <circle cx={sx(r.now)} cy={y} r={5} fill={MUTED} stroke="#fff" strokeWidth={2} />
            <circle cx={sx(r.future)} cy={y} r={5} fill={marks.get(r.code) ?? "#b5852f"} stroke="#fff" strokeWidth={2} />
            <text x={sx(r.future) + 9} y={y + 4} className={on ? "tr-t tr-b" : "tr-t tr-m"}>{fmt.format(r.future)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 0–100 family scores, one group per family and one bar per picked comuna; 50 = middle of Santiago */
export function ScoreGroups({ groups, series }: {
  groups: Array<{ id: string; label: string; color: string }>;
  series: Array<{ name: string; color: string; values: Record<string, number | undefined> }>;
}) {
  const W = 640, L = 150, R = 40, BH = 13, GAP = 12;
  const GH = series.length * (BH + 3) + GAP, H = groups.length * GH + 22;
  const sx = (v: number) => L + ((W - L - R) * v) / 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={14} y2={H} stroke={GRID} strokeDasharray={v === 50 ? "4 3" : undefined} />
          <text x={sx(v)} y={10} textAnchor="middle" className="tr-t tr-m">{v}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const y0 = 20 + gi * GH;
        return (
          <g key={g.id}>
            <text x={L - 8} y={y0 + (series.length * (BH + 3)) / 2 + 3} textAnchor="end" className="tr-t tr-b" fill={g.color}>{g.label}</text>
            {series.map((s, si) => {
              const v = s.values[g.id];
              const y = y0 + si * (BH + 3);
              return v === undefined ? null : (
                <g key={s.name}>
                  <title>{`${s.name} · ${g.label}: ${v}/100`}</title>
                  <rect x={sx(0)} y={y} width={Math.max(2, sx(v) - sx(0))} height={BH} rx={3} fill={s.color} />
                  <text x={sx(v) + 5} y={y + 10.5} className="tr-t tr-m">{v}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** two layers against each other, one dot per comuna, least-squares line, picked comunas labelled */
export function Scatter({ points, xLabel, yLabel, marks, onSelect, locale, xDec, yDec, line }: {
  points: Array<{ code: string; name: string; x: number; y: number }>;
  xLabel: string;
  yLabel: string;
  marks: Marks;
  onSelect: (code: string) => void;
  locale: string;
  xDec: number;
  yDec: number;
  line?: { a: number; b: number } | null;
}) {
  const fx = fmtFor(locale, xDec), fy = fmtFor(locale, yDec);
  const W = 640, H = 340, L = 60, R = 20, T = 14, B = 40;
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const px = (x1 - x0 || 1) * 0.06, py = (y1 - y0 || 1) * 0.06;
  const sx = (v: number) => L + ((W - L - R) * (v - x0 + px)) / (x1 - x0 + 2 * px);
  const sy = (v: number) => T + (H - T - B) * (1 - (v - y0 + py) / (y1 - y0 + 2 * py));
  const clampY = (v: number) => Math.max(y0 - py, Math.min(y1 + py, v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tr-chart" role="img">
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={GRID} />
      <line x1={L} x2={L} y1={T} y2={H - B} stroke={GRID} />
      <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="tr-t tr-m">{xLabel}</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} className="tr-t tr-m">{yLabel}</text>
      {[x0, x1].map((v) => <text key={`x${v}`} x={sx(v)} y={H - B + 14} textAnchor="middle" className="tr-t tr-m">{fx.format(v)}</text>)}
      {[y0, y1].map((v) => <text key={`y${v}`} x={L - 6} y={sy(v) + 4} textAnchor="end" className="tr-t tr-m">{fy.format(v)}</text>)}
      {line && <line x1={sx(x0)} x2={sx(x1)} y1={sy(clampY(line.a + line.b * x0))} y2={sy(clampY(line.a + line.b * x1))} stroke={MUTED} strokeDasharray="5 4" />}
      {[...points].sort((a, b) => Number(marks.has(a.code)) - Number(marks.has(b.code))).map((p) => {
        const on = marks.has(p.code), c = marks.get(p.code) ?? "#2f7c7a";
        return (
          <g key={p.code} className="tr-hit" onClick={() => onSelect(p.code)}>
            <title>{`${p.name}: ${fx.format(p.x)} · ${fy.format(p.y)}`}</title>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={12} fill="transparent" />
            <circle cx={sx(p.x)} cy={sy(p.y)} r={on ? 7 : 5} fill={on ? c : "#9dbcba"} stroke="#fff" strokeWidth={2} />
            {on && (sx(p.x) > W - 120 ? <text x={sx(p.x) - 10} y={sy(p.y) - 8} textAnchor="end" className="tr-t tr-b">{p.name}</text> : <text x={sx(p.x) + 10} y={sy(p.y) - 8} className="tr-t tr-b">{p.name}</text>)}
          </g>
        );
      })}
    </svg>
  );
}
