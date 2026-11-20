/**
 * Report infographics: plain SVG from the deterministic input, no chart library.
 * Direct labels on every mark; colour only reinforces what the label says.
 */
import type { MetricValue } from "@/lib/report/input";

export const FAVOUR = { good: "#3f7a5a", mid: "#b5852f", bad: "#a4523f", none: "#8a949c" };
export const favourColor = (f: number | null) => (f === null ? FAVOUR.none : f >= 60 ? FAVOUR.good : f >= 40 ? FAVOUR.mid : FAVOUR.bad);

/** theme scores 0–100 as horizontal bars with the value at the end */
export function ScoreBars({ rows }: { rows: Array<{ label: string; value: number | null }> }) {
  const W = 420, H = 30 * rows.length, L = 150, R = 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rd-chart" role="img">
      {rows.map((r, i) => {
        const y = i * 30 + 8, w = r.value === null ? 0 : ((W - L - R) * r.value) / 100;
        return (
          <g key={r.label}>
            <text x={0} y={y + 11} className="rd-t">{r.label}</text>
            <rect x={L} y={y} width={W - L - R} height={14} rx={3} fill="#eef0ec" />
            <rect x={L} y={y} width={w} height={14} rx={3} fill={favourColor(r.value)} />
            <text x={L + w + 6} y={y + 11} className="rd-t rd-b">{r.value ?? "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** one strip per metric: where this place sits among Santiago zones/comunas (0 = lowest value) */
export function PercentileStrip({ m, label, valueText }: { m: MetricValue; label: string; valueText: string }) {
  const W = 420, L = 0, T = 22;
  const x = m.pct === null ? null : L + ((W - 2) * m.pct) / 100 + 1;
  return (
    <svg viewBox={`0 0 ${W} 44`} className="rd-chart rd-strip" role="img" aria-label={`${label}: ${valueText}`}>
      <text x={0} y={13} className="rd-t">{label}</text>
      <text x={W} y={13} textAnchor="end" className="rd-t rd-b">{valueText}</text>
      <rect x={0} y={T} width={W} height={8} rx={4} fill="#eef0ec" />
      {[25, 50, 75].map((q) => <line key={q} x1={(W * q) / 100} x2={(W * q) / 100} y1={T} y2={T + 8} stroke="#fff" strokeWidth={2} />)}
      {x !== null && <circle cx={x} cy={T + 4} r={6.5} fill={favourColor(m.favour)} stroke="#fff" strokeWidth={2} />}
    </svg>
  );
}

/** walking minutes with 5/10/15/20 min guides; the bar stops at 25 */
export function WalkBars({ rows }: { rows: Array<{ label: string; min: number }> }) {
  const W = 420, L = 150, R = 50, H = 26 * rows.length + 18, max = 25;
  const sx = (m: number) => L + ((W - L - R) * Math.min(m, max)) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rd-chart" role="img">
      {[5, 10, 15, 20].map((g) => (
        <g key={g}>
          <line x1={sx(g)} x2={sx(g)} y1={0} y2={H - 16} stroke="#e3e6e1" />
          <text x={sx(g)} y={H - 3} textAnchor="middle" className="rd-t rd-s">{g}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = i * 26 + 4;
        const c = r.min <= 10 ? FAVOUR.good : r.min <= 20 ? FAVOUR.mid : FAVOUR.bad;
        return (
          <g key={r.label}>
            <text x={0} y={y + 12} className="rd-t">{r.label}</text>
            <rect x={L} y={y + 2} width={sx(r.min) - L} height={12} rx={3} fill={c} />
            <text x={sx(r.min) + 6} y={y + 12} className="rd-t rd-b">{r.min > 60 ? ">60" : `~${r.min}`} min</text>
          </g>
        );
      })}
    </svg>
  );
}

/** median transaction price by year (UF), labelled columns */
export function PriceColumns({ years, locale }: { years: Array<[string, number]>; locale: string }) {
  const W = 420, H = 150, B = 20, T = 18;
  const max = Math.max(1, ...years.map(([, v]) => v));
  const bw = Math.min(52, (W - 10) / Math.max(1, years.length) - 10);
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-CL" : "en-US", { maximumFractionDigits: 0 });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rd-chart" role="img">
      <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="#c9cec8" />
      {years.map(([y, v], i) => {
        const h = ((H - B - T) * v) / max, x = 5 + i * (bw + 10);
        return (
          <g key={y}>
            <rect x={x} y={H - B - h} width={bw} height={h} rx={3} fill={i === years.length - 1 ? "#2f7c7a" : "#a9c9c7"} />
            <text x={x + bw / 2} y={H - B - h - 5} textAnchor="middle" className="rd-t rd-s rd-b">{fmt.format(v)}</text>
            <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="rd-t rd-s">{y}</text>
          </g>
        );
      })}
    </svg>
  );
}
