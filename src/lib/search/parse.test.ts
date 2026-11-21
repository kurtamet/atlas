import { describe, expect, it } from "vitest";
import { parseQuery, rankByCriteria } from "./parse.ts";

const COMUNAS = ["Ñuñoa", "Providencia", "Estación Central"];

describe("parseQuery", () => {
  it("detects listing links", () => {
    expect(parseQuery("https://example.cl/depto/123", COMUNAS).kind).toBe("link");
  });
  it("matches comunas ignoring accents and case", () => {
    expect(parseQuery("nunoa", COMUNAS)).toEqual({ kind: "comuna", name: "Ñuñoa" });
    expect(parseQuery("ESTACION CENTRAL", COMUNAS)).toEqual({ kind: "comuna", name: "Estación Central" });
  });
  it("treats text with numbers as an address", () => {
    expect(parseQuery("Irarrázaval 2000, Ñuñoa", COMUNAS).kind).toBe("address");
  });
  it("extracts criteria in Spanish, longest phrase first", () => {
    const r = parseQuery("tranquilo y cerca del metro, con parques", COMUNAS);
    expect(r.kind).toBe("criteria");
    if (r.kind !== "criteria") return;
    expect(r.criteria.map((c) => c.metric)).toEqual(["EN03", "IN04", "EN04"]);
    expect(r.criteria.find((c) => c.metric === "IN04")?.phrase).toBe("cerca del metro");
  });
  it("extracts criteria in English", () => {
    const r = parseQuery("quiet and green, cheap", COMUNAS);
    expect(r.kind === "criteria" && r.criteria.map((c) => c.metric)).toEqual(["EN03", "EN04", "EC01"]);
  });
  it("falls back to address for unknown words", () => {
    expect(parseQuery("Avenida Grecia", COMUNAS).kind).toBe("address");
  });
});

describe("rankByCriteria", () => {
  it("prefers low noise and ranks missing data after known data", () => {
    const areas = [
      { name: "a", values: { EN03: 65 } },
      { name: "b", values: { EN03: 45 } },
      { name: "c", values: {} },
    ];
    const r = rankByCriteria(areas, [{ metric: "EN03", prefer: "low", phrase: "quiet" }], { EN03: [40, 70] });
    expect(r.map((x) => x.name)).toEqual(["b", "a", "c"]);
    expect(r[2].coverage).toBe(0);
  });
});

describe("rol", () => {
  const names = ["Las Condes", "Ñuñoa", "Santiago"];
  it("reads rol with and without the word", () => {
    expect(parseQuery("rol 1234-56", names)).toEqual({ kind: "rol", mz: 1234, pr: 56 });
    expect(parseQuery("1234-56", names)).toEqual({ kind: "rol", mz: 1234, pr: 56 });
    expect(parseQuery("Rol N° 512 - 7 Ñuñoa", names)).toEqual({ kind: "rol", mz: 512, pr: 7, comuna: "Ñuñoa" });
    expect(parseQuery("1234-56, Las Condes", names)).toEqual({ kind: "rol", mz: 1234, pr: 56, comuna: "Las Condes" });
  });
  it("keeps addresses with dashes as addresses", () => {
    expect(parseQuery("Pasaje 12-3 Villa Los Aromos", names).kind).toBe("address");
    expect(parseQuery("Av. Providencia 1208", names).kind).toBe("address");
  });
});
