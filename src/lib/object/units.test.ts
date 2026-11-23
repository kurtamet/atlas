import { describe, expect, it } from "vitest";
import { unitKind, unitLabel, mixOf, mainKind, valuation, type TypePricesFile, type Unit } from "./units";
import { buildReportInput, promptPayload } from "../report/input";
import { ruleDraft } from "../report/fallback";
import { ReportAI } from "../report/schema";
import es from "../../../messages/es.json";

const file: TypePricesFile = {
  period: ["20241001", "20260930"],
  types: {
    Hd: { unit: "m2", rm: { n: 1000, med: 65, p25: 42, p75: 85 }, comunas: { "13120": { n: 500, med: 70, p25: 60, p75: 80 } }, zones: { Z1: { n: 30, med: 75, p25: 65, p75: 90 } } },
    Z: { unit: "unit", rm: { n: 900, med: 366, p25: 300, p75: 440 }, comunas: {}, zones: {} },
  },
};
const u = (dir: string, ds: string, m2 = 0): Unit => ({ rol: dir, cut: 13120, dir, ds, kind: unitKind(ds, dir), m2, yr: 2015, av: 2000 });

describe("units", () => {
  it("classifies SII destino with apartments split from houses", () => {
    expect(unitKind("H", "AV IRARRAZAVAL 3000 DP 501")).toBe("Hd");
    expect(unitKind("H", "LOS ALERCES 123")).toBe("Hc");
    expect(unitKind("Z", "X 1 ES 12")).toBe("Z");
    expect(unitKind("K", "")).toBe("X");
    expect(unitLabel("A VESPUCIO SUR 80 OF 21")).toBe("OF 21");
  });
  it("finds the main kind of a tower with parking", () => {
    const mix = mixOf([u("A 1 DP 1", "H"), u("A 1 DP 2", "H"), u("A 1 ES 1", "Z"), u("A 1 ES 2", "Z"), u("A 1 ES 3", "Z"), u("A 1 LC 1", "C")]);
    expect(mainKind(mix)).toBe("Hd");
    expect(mainKind({ Z: 3 })).toBe("Z");
  });
  it("values a unit from the finest level with data", () => {
    const v = valuation(file, "Hd", { zone: "Z1", cut: 13120 }, 60)!;
    expect(v).toMatchObject({ level: "Z", med: 75, estimate: { low: 3900, mid: 4500, high: 5400 } });
    expect(valuation(file, "Hd", { zone: "Z9", cut: 13120 })!.level).toBe("C");
    expect(valuation(file, "Z", { cut: 13120 })!).toMatchObject({ level: "RM", estimate: { mid: 366 } });
    expect(valuation(file, "O", { cut: 13120 })).toBeNull();
  });
  it("carries the unit into the report and the rule draft", () => {
    const unit = u("AV IRARRAZAVAL 3000 DP 501", "H", 60);
    const input = buildReportInput({
      locale: "es", title: "Edificio", lngLat: [-70.6, -33.45], area: 800, facts: { minutes: { metro: 4 }, hazards: { RS07: false, RS09: false, RS05: false } },
      obs: { pros: [], cons: [] }, comuna: { name: "Ñuñoa", code: 13120 }, zones: null, comunas: null,
      unit, mix: { Hd: 40, Z: 30 }, valuation: valuation(file, "Hd", { zone: "Z1" }, 60),
    });
    expect(promptPayload(input).unit).toMatchObject({ kind: "Hd", m2: 60 });
    const d = ruleDraft(input, es);
    expect(() => ReportAI.parse(d)).not.toThrow();
    expect(d.value.position).toBe("above");
    expect(d.value.comment).toContain("3.900");
  });
});
