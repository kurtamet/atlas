import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PACKS, PLANS, perReport, unlimitedBreakEven, isProduct, RETAIL_CLP } from "./plans";
import { previewState, makeCookie, readStart, PREVIEW_MINUTES } from "./preview";

describe("price list", () => {
  it("matches the agreed CLP prices", () => {
    expect(RETAIL_CLP).toBe(10_000);
    expect(PACKS.map((p) => [p.credits, p.clp])).toEqual([[5, 35_000], [15, 70_000], [30, 120_000]]);
    expect(PLANS.map((p) => [p.id, p.reports, p.clp])).toEqual([["basic", 5, 25_000], ["partner", 10, 50_000], ["unlimited", null, 150_000]]);
  });
  it("computes savings against retail", () => {
    expect(perReport(35_000, 5)).toEqual({ each: 7_000, savePct: 30, saveClp: 15_000 });
    expect(perReport(120_000, 30)).toEqual({ each: 4_000, savePct: 60, saveClp: 180_000 });
    expect(perReport(25_000, 5).savePct).toBe(50);
    expect(unlimitedBreakEven()).toBe(16);
  });
  it("knows its products", () => {
    expect(isProduct("pack15")).toBe(true);
    expect(isProduct("unlimited")).toBe(true);
    expect(isProduct("free")).toBe(false);
  });
});

describe("trends preview cookie", () => {
  it("opens for 5 minutes from the first visit, then closes", () => {
    const t0 = 1_800_000_000_000;
    const first = previewState(undefined, t0);
    expect(first).toMatchObject({ open: true, isNew: true, endsAt: t0 + PREVIEW_MINUTES * 60_000 });
    const cookie = makeCookie(first.start).value;
    expect(previewState(cookie, t0 + 4 * 60_000)).toMatchObject({ open: true, isNew: false });
    expect(previewState(cookie, t0 + 5 * 60_000 + 1)).toMatchObject({ open: false, isNew: false });
  });
  it("ignores a tampered cookie", () => {
    const v = makeCookie(1_800_000_000_000).value;
    expect(readStart(v)).toBe(1_800_000_000_000);
    expect(readStart(v.replace(/^\d+/, "1900000000000"))).toBeNull();
    expect(readStart("garbage")).toBeNull();
  });
});
