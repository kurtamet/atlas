"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FAMILIES, METRICS, familyById, metricById, type Metric } from "@/lib/layers/registry";
import { COMPOSITE, COMPOSITE_ID, COMPOSITE_RAMP, HIGH_IS_BAD, HIGH_IS_GOOD } from "@/lib/layers/composite";
import { formatValue } from "@/lib/layers/style";
import { median, FREE_LAYERS, FREE_EDGE, type ComunaRow } from "@/lib/data/comunas";
import { derive, fit, SECTORS, SCORE_FAMILIES } from "@/lib/trends/derive";
import { metricValue } from "@/lib/report/input";
import { PercentileStrip } from "@/components/report/charts";
import { RankBars, Lines, ChangeBars, RangeBars, Dumbbells, Scatter, ScoreGroups, fmtFor, type Marks } from "./charts";
import { ComunaPicker, LayerChips, Segmented } from "./pickers";
import { Locked } from "./Locked";
import { useAccess, previewQuery } from "@/lib/access";

const REAL = METRICS.filter((m) => !m.demo);
/** compare palette: brand teal first, then three hues that stay apart for common colour-vision deficiencies */
const PICK = ["#2f7c7a", "#c2603a", "#5b5bb0", "#b08a1f"];
const MAX_PICK = 4;
const COMPOSITE_COLOR = COMPOSITE_RAMP[4];
const metricOf = (id: string): Metric => (id === COMPOSITE_ID ? COMPOSITE : metricById(id));
const colorOf = (id: string) => (id === COMPOSITE_ID ? COMPOSITE_COLOR : familyById(metricById(id).family).color);

type PriceMode = "median" | "index" | "deals";
const PRESETS = [
  { id: "value", x: COMPOSITE_ID, y: "EC01" },
  { id: "services", x: "IN01", y: "EC01" },
  { id: "green", x: "EN04", y: "EN03" },
  { id: "transit", x: "SO01", y: "IN04" },
] as const;

/** reads ?m=EC02&c=13120,13114 so a view can be shared as a link */
function fromUrl(valid: Set<string>): { metric?: string; picked?: string[] } {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const m = q.get("m") ?? undefined;
  const c = (q.get("c") ?? "").split(",").filter((x) => valid.has(x)).slice(0, MAX_PICK);
  return { metric: m && (m === COMPOSITE_ID || REAL.some((x) => x.id === m)) ? m : undefined, picked: c.length ? c : undefined };
}

export default function TrendsView() {
  const t = useTranslations();
  const tr = useTranslations("trends");
  const locale = useLocale();
  const [rows, setRows] = useState<ComunaRow[] | null>(null);
  const [metric, setMetric] = useState(COMPOSITE_ID);
  const [picked, setPicked] = useState<string[]>(["13120"]);
  const [compare, setCompare] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>("median");
  const [span, setSpan] = useState<1 | 3 | 5>(5);
  const [preset, setPreset] = useState<string>("value");
  const [xId, setX] = useState("IN01");
  const [yId, setY] = useState("EC02");
  const access = useAccess();
  const [served, setServed] = useState(false);
  // the server decides what we receive: free visitors get no series or extras
  useEffect(() => {
    if (access.loading) return;
    fetch(`/api/trends${previewQuery()}`, { cache: "no-store" }).then((r) => r.json() as Promise<{ subscriber: boolean; rows: ComunaRow[] }>)
      .then((d) => {
        setRows(d.rows);
        setServed(d.subscriber);
        const u = fromUrl(new Set(d.rows.map((r) => r.code)));
        if (u.metric) setMetric(u.metric);
        if (u.picked) { setPicked(u.picked); setCompare(u.picked.length > 1); }
      }).catch(() => setRows([]));
  }, [access.loading, access.subscriber]);
  const subscriber = served;

  // keep the URL in step with the view (shareable link), without adding history entries
  useEffect(() => {
    if (!rows) return;
    const q = new URLSearchParams(window.location.search);
    q.set("m", metric);
    q.set("c", picked.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [rows, metric, picked]);

  const d = useMemo(() => derive(rows ?? []), [rows]);
  // composite score joins the layer values so every chart can use it like a layer
  const table = useMemo(() => (rows ?? []).map((r) => ({ ...r, values: d.score[r.code] !== undefined ? { ...r.values, [COMPOSITE_ID]: d.score[r.code] } : r.values })), [rows, d]);
  const byCode = useMemo(() => new Map(table.map((r) => [r.code, r])), [table]);

  if (!rows) return <section className="at-page"><p className="at-lead">{tr("loading")}</p></section>;

  const pickedRows = picked.map((c) => byCode.get(c)).filter((r): r is (typeof table)[number] => Boolean(r));
  const colors = compare ? PICK : [PICK[0]];
  const marks: Marks = new Map(pickedRows.map((r, i) => [r.code, compare ? PICK[i] : null]));
  const pickColor = (i: number) => (compare ? PICK[i] : PICK[0]);
  const isLocked = (id: string) => !subscriber && !FREE_LAYERS.has(id);
  const onPick = (code: string) => {
    if (!compare) return setPicked([code]);
    setPicked((p) => (p.includes(code) ? (p.length > 1 ? p.filter((x) => x !== code) : p) : p.length < MAX_PICK ? [...p, code] : p));
  };
  const setMode = (cmp: boolean) => { setCompare(cmp); if (!cmp) setPicked((p) => p.slice(0, 1)); };
  const name = (code: string) => byCode.get(code)?.name ?? code;
  const fmt0 = fmtFor(locale);

  // ---- ranking
  const m = metricOf(metric);
  const ranked = table.filter((r) => r.values[metric] !== undefined).map((r) => ({ code: r.code, name: r.name, value: r.values[metric] })).sort((a, b) => b.value - a.value);
  const rankOf = (id: string, code: string) => {
    const xs = table.filter((r) => r.values[id] !== undefined).sort((a, b) => b.values[id] - a.values[id]);
    const i = xs.findIndex((r) => r.code === code);
    return i < 0 ? null : { pos: i + 1, of: xs.length };
  };
  const layerLocked = isLocked(metric);
  const shownRank = subscriber ? ranked : ranked.map((r, i) => (i < FREE_EDGE || i >= ranked.length - FREE_EDGE || marks.has(r.code) ? r : { code: `x${i}`, name: "", value: 0, locked: true }));
  const layerGroups = [
    { id: "composite", label: tr("overall"), color: COMPOSITE_COLOR, items: [{ id: COMPOSITE_ID, label: tr("overallLayer") }] },
    ...FAMILIES.map((f) => ({ id: f.id, label: t(`families.${f.id}`), color: f.color, items: REAL.filter((x) => x.family === f.id).map((x) => ({ id: x.id, label: t(`metrics.${x.id}`) })) })).filter((g) => g.items.length),
  ];
  const sectors = SECTORS.map((s) => ({ id: s.id, label: tr(`sector_${s.id}`), items: s.codes.filter((c) => byCode.has(c)).map((c) => ({ code: c, name: name(c) })).sort((a, b) => a.name.localeCompare(b.name, "es")) }));

  // ---- prices
  const { years, lastFull, partial } = d;
  const priceSeries = (code: string): Array<number | null> => {
    const p = d.price[code];
    if (!p) return years.map(() => null);
    if (priceMode === "deals") return years.map((y) => p.n[y] ?? null);
    if (priceMode === "index") { const base = p.med[years[0]]; return years.map((y) => (base && p.med[y] ? Math.round((1000 * p.med[y]) / base) / 10 : null)); }
    return years.map((y) => p.med[y] ?? null);
  };
  const refSeries = (): Array<number | null> => {
    const codes = Object.keys(d.price);
    if (priceMode === "index") {
      const per = codes.map((c) => priceSeries(c));
      return years.map((_, i) => median(per.map((s) => s[i]).filter((v): v is number => v !== null)));
    }
    const key = priceMode === "deals" ? "n" : "med";
    return years.map((y) => median(codes.map((c) => d.price[c][key][y]).filter((v): v is number => typeof v === "number")));
  };
  const chgRows = table.filter((r) => typeof d.price[r.code]?.chg[span] === "number").map((r) => ({ code: r.code, name: r.name, value: d.price[r.code].chg[span] as number })).sort((a, b) => b.value - a.value);
  const rangeRows = table.filter((r) => r.prices?.p25 && r.prices?.p75).map((r) => ({ code: r.code, name: r.name, lo: r.prices!.p25!, mid: r.prices!.median, hi: r.prices!.p75! })).sort((a, b) => b.mid - a.mid);
  const turnRows = table.filter((r) => typeof d.price[r.code]?.turnover === "number").map((r) => ({ code: r.code, name: r.name, value: d.price[r.code].turnover as number })).sort((a, b) => b.value - a.value);

  // ---- crime and climate
  const crimeChg = table.filter((r) => typeof r.extras.RS01_chg === "number").map((r) => ({ code: r.code, name: r.name, value: r.extras.RS01_chg as number })).sort((a, b) => b.value - a.value);
  const hot = table.filter((r) => r.values.CL01 !== undefined && typeof r.extras.CL01_d === "number").map((r) => ({ code: r.code, name: r.name, now: r.values.CL01, future: r.values.CL01 + (r.extras.CL01_d as number) })).sort((a, b) => b.future - a.future);

  // ---- relationship between layers
  const pr = PRESETS.find((p) => p.id === preset);
  const [sxId, syId] = pr ? [pr.x, pr.y] : [xId, yId];
  const scatter = table.filter((r) => r.values[sxId] !== undefined && r.values[syId] !== undefined).map((r) => ({ code: r.code, name: r.name, x: r.values[sxId], y: r.values[syId] }));
  const line = fit(scatter);
  const strength = line ? (Math.abs(line.r) >= 0.7 ? "strong" : Math.abs(line.r) >= 0.4 ? "moderate" : Math.abs(line.r) >= 0.2 ? "weak" : "none") : "none";
  const resid = line && preset === "value" ? scatter.map((p) => ({ ...p, res: p.y - (line.a + line.b * p.x) })).sort((a, b) => a.res - b.res) : null;
  const axisLabel = (id: string) => (id === COMPOSITE_ID ? tr("overallLayer") : `${t(`metrics.${id}`)} (${metricOf(id).unit})`);
  const axisChips = (value: string, on: (v: string) => void) => (
    <div className="tr-chips tr-chips-sm">
      {[COMPOSITE_ID, ...REAL.map((x) => x.id)].map((id) => (
        <button key={id} type="button" className={`tr-chip${id === value ? " on" : ""}`} style={{ ["--fam" as string]: colorOf(id) }} onClick={() => on(id)}>{id === COMPOSITE_ID ? tr("overallLayer") : t(`metrics.${id}`)}</button>
      ))}
    </div>
  );

  const comunasFc = { features: table.map((r) => ({ properties: r.values as Record<string, unknown> })) };
  const fmtMetric = (id: string, v: number) => (id === COMPOSITE_ID ? `${Math.round(v)}/100` : `${formatValue(metricById(id), v, locale)} ${metricOf(id).unit}`);
  const exportCsv = () => {
    const ids = [COMPOSITE_ID, ...REAL.map((x) => x.id)];
    const lines = [["code", "comuna", ...ids, `deals_${lastFull}`, `chg1_pct`, `chg5_pct`].join(","), ...table.map((r) => [r.code, `"${r.name}"`, ...ids.map((id) => r.values[id] ?? ""), d.price[r.code]?.deals ?? "", d.price[r.code]?.chg[1] ?? "", d.price[r.code]?.chg[5] ?? ""].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "comunas-santiago.csv";
    a.click();
  };
  const lockIco = <span className="tr-lockico" title={tr("subOnly")}>🔒</span>;

  return (
    <div className="tr">
      <header className="tr-head">
        <p className="at-eyebrow">{t("pages.trends.eyebrow")}</p>
        <h1>{t("pages.trends.title")}</h1>
        <p className="at-lead">{tr("lead", { n: rows.length })}</p>
      </header>

      <section className="tr-card tr-wide tr-pick">
        <div className="tr-pick-head">
          <h2>{compare ? tr("pickCompare", { max: MAX_PICK }) : tr("pickOne")}</h2>
          <Segmented value={compare ? 1 : 0} onChange={(v) => setMode(v === 1)} label={tr("mode")} options={[{ id: 0, label: tr("modeOne") }, { id: 1, label: tr("modeCompare") }]} />
        </div>
        <ComunaPicker sectors={sectors} picked={picked} colors={colors} compare={compare} onPick={onPick} max={MAX_PICK} labels={{ filter: tr("filter"), none: tr("filterNone") }} />
        {compare && picked.length < 2 && <p className="tr-note tr-upsell">{tr("compareHint")}</p>}
      </section>

      {/* summary tiles per picked comuna */}
      <section className="tr-wide tr-tiles" style={{ ["--n" as string]: pickedRows.length }}>
        {pickedRows.map((r, i) => {
          const p = d.price[r.code], rk = rankOf(COMPOSITE_ID, r.code);
          const pctTxt = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v}%` : "—");
          return (
            <div key={r.code} className="tr-tile" style={{ ["--pick" as string]: pickColor(i) }}>
              <h3>{r.name} <small>{tr(`sector_${SECTORS.find((s) => s.codes.includes(r.code))?.id ?? "centro"}`)}</small></h3>
              <dl>
                <div><dt>{tr("kScore")}</dt><dd>{d.score[r.code] ?? "—"}<small>/100</small>{rk && <em>{tr("kRank", { pos: rk.pos, of: rk.of })}</em>}</dd></div>
                <div><dt>{tr("kPrice")}</dt><dd>{r.values.EC02 !== undefined ? fmt0.format(r.values.EC02) : "—"}<small> UF</small></dd></div>
                <div><dt>{tr("kM2")}</dt><dd>{subscriber || FREE_LAYERS.has("EC01") ? (r.values.EC01 !== undefined ? fmt0.format(r.values.EC01) : "—") : lockIco}<small> UF/m²</small></dd></div>
                <div><dt>{lastFull ? tr("kChg1", { year: lastFull }) : tr("kChg1_")}</dt><dd>{subscriber ? pctTxt(p?.chg[1]) : lockIco}</dd></div>
                <div><dt>{lastFull ? tr("kChg5", { year: String(Number(lastFull) - 5) }) : tr("kChg5_")}</dt><dd>{subscriber ? pctTxt(p?.chg[5]) : lockIco}</dd></div>
                <div><dt>{lastFull ? tr("kDeals", { year: lastFull }) : tr("kDeals_")}</dt><dd>{subscriber ? (p?.deals ? fmt0.format(p.deals) : "—") : lockIco}{subscriber && p?.turnover ? <em>{tr("kTurnover", { v: p.turnover.toLocaleString(locale) })}</em> : null}</dd></div>
              </dl>
            </div>
          );
        })}
      </section>

      <section className="tr-card tr-wide">
        <h2>{tr("rankTitle", { metric: metric === COMPOSITE_ID ? tr("overallLayer") : t(`metrics.${metric}`) })}</h2>
        <p className="tr-sub">{m.unit} · {tr("rankSub")}</p>
        <LayerChips groups={layerGroups} value={metric} onChange={setMetric} locked={isLocked} lockedLabel={tr("subOnly")} />
        {layerLocked ? <Locked rows={10} /> : <RankBars rows={shownRank} color={colorOf(metric)} marks={marks} onSelect={onPick} unit={m.unit} decimals={m.decimals} locale={locale} median={median(ranked.map((r) => r.value))} medianLabel={tr("median")} />}
        {!subscriber && !layerLocked && <p className="tr-note tr-upsell">{tr("rankUpsell", { n: ranked.length - 2 * FREE_EDGE })}</p>}
        <p className="tr-note">{t(`drawer.method_${metric}`)}</p>
      </section>

      {!compare && pickedRows[0] && (
        <section className="tr-card tr-tall">
          <h2>{tr("profileTitle", { comuna: pickedRows[0].name })}</h2>
          <p className="tr-sub">{tr("profileSub")}</p>
          {FAMILIES.map((f) => {
            const ms = REAL.filter((x) => x.family === f.id).map((x) => metricValue(x, undefined, pickedRows[0].values, null, comunasFc)).filter((v) => v !== null);
            if (!ms.length) return null;
            return (
              <div key={f.id}>
                <p className="tr-fam" style={{ color: f.color }}>{t(`families.${f.id}`)}</p>
                {ms.map((v) => <PercentileStrip key={v!.id} m={v!} label={t(`metrics.${v!.id}`)} valueText={`${formatValue(metricById(v!.id), v!.value, locale)} ${v!.unit}`} />)}
              </div>
            );
          })}
        </section>
      )}

      {compare && pickedRows.length > 1 && (<>
        <section className="tr-card tr-wide">
          <h2>{tr("cmpTitle")}</h2>
          <p className="tr-sub">{tr("cmpSub")}</p>
          <ScoreGroups
            groups={[{ id: COMPOSITE_ID, label: tr("overall"), color: COMPOSITE_COLOR }, ...SCORE_FAMILIES.map((f) => ({ id: f, label: t(`families.${f}`), color: familyById(f).color }))]}
            series={pickedRows.map((r, i) => ({ name: r.name, color: PICK[i], values: { [COMPOSITE_ID]: d.score[r.code], ...d.fam[r.code] } }))} />
        </section>
        <section className="tr-card tr-wide">
          <h2>{tr("tableTitle")}</h2>
          <p className="tr-sub">{tr("tableSub")}</p>
          <div className="tr-table-wrap">
            <table className="tr-table">
              <thead>
                <tr><th />{pickedRows.map((r, i) => <th key={r.code} style={{ color: PICK[i] }}>{r.name}</th>)}</tr>
              </thead>
              <tbody>
                {[{ id: "composite", ids: [COMPOSITE_ID] }, ...FAMILIES.map((f) => ({ id: f.id, ids: REAL.filter((x) => x.family === f.id).map((x) => x.id) }))].filter((g) => g.ids.length).map((g) => (<Fragment key={g.id}>
                  <tr className="tr-table-fam"><td colSpan={pickedRows.length + 1} style={{ color: g.id === "composite" ? COMPOSITE_COLOR : familyById(g.id as never).color }}>{g.id === "composite" ? tr("overall") : t(`families.${g.id}`)}</td></tr>
                  {g.ids.map((id) => {
                    const vals = pickedRows.map((r) => r.values[id]);
                    const nums = vals.filter((v): v is number => typeof v === "number");
                    const best = id === COMPOSITE_ID || HIGH_IS_GOOD.has(id) ? Math.max(...nums) : HIGH_IS_BAD.has(id) ? Math.min(...nums) : null;
                    const lockedRow = isLocked(id);
                    return (
                      <tr key={id}>
                        <th scope="row">{id === COMPOSITE_ID ? tr("overallLayer") : t(`metrics.${id}`)} <small>{metricOf(id).unit}</small></th>
                        {pickedRows.map((r, i) => {
                          const v = vals[i], rk = rankOf(id, r.code);
                          if (lockedRow) return <td key={r.code}>{lockIco}</td>;
                          return (
                            <td key={r.code} className={best !== null && v === best && nums.length > 1 ? "tr-best" : undefined}>
                              {typeof v === "number" ? (id === COMPOSITE_ID ? Math.round(v) : formatValue(metricById(id), v, locale)) : "—"}
                              {rk && <small>#{rk.pos}</small>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>))}
              </tbody>
            </table>
          </div>
          <p className="tr-note">{tr("tableNote", { n: rows.length })}</p>
        </section>
      </>)}

      <section className="tr-card">
        <h2>{tr("priceTitle")}</h2>
        <p className="tr-sub">{tr(`priceSub_${priceMode}`)}</p>
        {!subscriber ? <Locked rows={6} compact /> : (<>
          <Segmented value={priceMode} onChange={setPriceMode} options={(["median", "index", "deals"] as const).map((k) => ({ id: k, label: tr(`priceMode_${k}`) }))} />
          <Lines years={years} partial={partial} locale={locale} zero={priceMode !== "index"}
            unit={priceMode === "deals" ? tr("dealsUnit") : priceMode === "index" ? "" : "UF"} decimals={priceMode === "index" ? 1 : 0}
            series={pickedRows.map((r, i) => ({ name: r.name, color: pickColor(i), values: priceSeries(r.code) }))}
            reference={{ name: tr("allComunas"), values: refSeries() }} />
          {partial && <p className="tr-note">{tr("partialNote", { year: partial })}</p>}
        </>)}
      </section>

      <section className="tr-card">
        <h2>{tr("chgTitle")}</h2>
        <p className="tr-sub">{lastFull ? tr("chgSub", { from: String(Number(lastFull) - span), to: lastFull }) : tr("chgSub_")}</p>
        {!subscriber ? <Locked rows={8} compact /> : (<>
          <Segmented value={span} onChange={setSpan} options={([1, 3, 5] as const).map((k) => ({ id: k, label: tr("years", { n: k }) }))} />
          <ChangeBars rows={chgRows} marks={marks} tone="neutral" unit="%" locale={locale} onSelect={onPick} />
          <p className="tr-note">{tr("chgNote")}</p>
        </>)}
      </section>

      <section className="tr-card">
        <h2>{tr("rangeTitle")}</h2>
        <p className="tr-sub">{tr("rangeSub")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <RangeBars rows={rangeRows} marks={marks} locale={locale} unit="UF" onSelect={onPick} />}
      </section>

      <section className="tr-card">
        <h2>{tr("turnTitle")}</h2>
        <p className="tr-sub">{lastFull ? tr("turnSub", { year: lastFull }) : tr("turnSub_")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <RankBars rows={turnRows} color="#2f7c7a" marks={marks} onSelect={onPick} unit={tr("turnUnit")} decimals={1} locale={locale} median={median(turnRows.map((r) => r.value))} medianLabel={tr("median")} />}
      </section>

      <section className="tr-card tr-wide">
        <h2>{tr("scatterTitle")}</h2>
        <p className="tr-sub">{tr("scatterSub")}</p>
        {!subscriber ? <Locked rows={7} /> : (<>
          <Segmented value={preset} onChange={setPreset} options={[...PRESETS.map((p) => ({ id: p.id as string, label: tr(`preset_${p.id}`) })), { id: "custom", label: tr("preset_custom") }]} />
          {preset === "custom" && (
            <div className="tr-axes">
              <p className="tr-axis-label">{tr("axisX")}</p>{axisChips(xId, setX)}
              <p className="tr-axis-label">{tr("axisY")}</p>{axisChips(yId, setY)}
            </div>
          )}
          <div className="tr-scatter">
            <Scatter points={scatter} xLabel={axisLabel(sxId)} yLabel={axisLabel(syId)} marks={marks} onSelect={onPick} locale={locale} xDec={metricOf(sxId).decimals} yDec={metricOf(syId).decimals} line={line} />
            <aside>
              {line && <p className="tr-r"><strong>r = {line.r.toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</strong> {tr(`r_${strength}`)}{strength !== "none" ? ` · ${tr(line.r > 0 ? "r_pos" : "r_neg")}` : ""}</p>}
              {pr && <p className="tr-note">{tr(`presetNote_${pr.id}`)}</p>}
              {resid && (<>
                <p className="tr-fam" style={{ color: "#3f7a5a" }}>{tr("valueCheap")}</p>
                <ol className="tr-list">{resid.slice(0, 5).map((p) => <li key={p.code}><button type="button" onClick={() => onPick(p.code)}>{p.name}</button> <span>{fmtMetric(sxId, p.x)} · {fmtMetric(syId, p.y)}</span></li>)}</ol>
                <p className="tr-fam" style={{ color: "#a4523f" }}>{tr("valueDear")}</p>
                <ol className="tr-list">{resid.slice(-5).reverse().map((p) => <li key={p.code}><button type="button" onClick={() => onPick(p.code)}>{p.name}</button> <span>{fmtMetric(sxId, p.x)} · {fmtMetric(syId, p.y)}</span></li>)}</ol>
                <p className="tr-note">{tr("valueNote")}</p>
              </>)}
            </aside>
          </div>
        </>)}
      </section>

      <section className="tr-card">
        <h2>{tr("crimeTitle")}</h2>
        <p className="tr-sub">{tr("crimeSub")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <ChangeBars rows={crimeChg} marks={marks} tone="risk" unit="%" locale={locale} onSelect={onPick} />}
      </section>

      <section className="tr-card">
        <h2>{tr("heatTitle")}</h2>
        <p className="tr-sub">{tr("heatSub")}</p>
        {!subscriber ? <Locked rows={8} compact /> : <Dumbbells rows={hot} marks={marks} unit={metricById("CL01").unit} locale={locale} nowLabel={tr("heatNow")} futureLabel={tr("heatFuture")} />}
      </section>

      <p className="tr-note tr-foot">{tr("foot")} {subscriber && <button type="button" className="at-secondary tr-csv" onClick={exportCsv}>{tr("csv")}</button>}</p>
    </div>
  );
}
