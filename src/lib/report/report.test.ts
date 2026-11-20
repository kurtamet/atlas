import { describe, expect, it } from "vitest";
import { buildReportInput, promptPayload } from "./input";
import { ruleDraft } from "./fallback";
import { ReportAI } from "./schema";
import es from "../../../messages/es.json";

const facts = { minutes: { metro: 4, food: 2, health: 6, park: 1, transport: 1 }, metroName: "Chile España", hazards: { RS07: true, RS09: false, RS05: false }, faultKm: 7 };
const comunas = { features: Array.from({ length: 10 }, (_, i) => ({ properties: { RS01: 700 + i * 300, EC02: 2000 + i * 500 } })) };
const input = buildReportInput({
  locale: "es", title: "Edificio", lngLat: [-70.598345, -33.455544], area: 2557, height: 66, facts,
  obs: { pros: [{ key: "metroNear", params: { name: "Chile España", min: 4 }, evidence: "gtfs-metro", level: "O" }], cons: [{ key: "flood", evidence: "minvu-rs07", level: "O" }] },
  zone: { id: "Z1", IN01: 100 }, comuna: { name: "Ñuñoa", code: 13120, RS01: 1712, RS01_chg: 1, EC02: 3625 }, zones: null, comunas,
});

describe("report input", () => {
  it("keeps real metrics with level and percentile, and scores the themes", () => {
    const rs01 = input.metrics.find((m) => m.id === "RS01")!;
    expect(rs01).toMatchObject({ level: "C", pct: 40, favour: 60 });
    expect(input.metrics.find((m) => m.id === "EC02")!.favour).toBeNull();
    expect(input.scores.safety).toBeLessThan(100);
    expect(input.flags.cons[0].key).toBe("flood");
    expect(input.object.lngLat[0]).toBeCloseTo(-70.59835, 4);
    expect(promptPayload(input)).not.toHaveProperty("createdAt");
  });
  it("rule draft matches the schema Claude must follow", () => {
    const d = ruleDraft(input, es);
    expect(() => ReportAI.parse(d)).not.toThrow();
    expect(d.risks[0]).toMatchObject({ severity: "high", evidence: "hazard.RS07" });
    expect(d.audiences).toHaveLength(5);
  });
});
