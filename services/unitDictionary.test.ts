import { describe, expect, it } from "vitest";
import { getVoltageTierName, getVoltageTierBaseVoltage, GTNH_VOLTAGE_TIERS } from "./unitDictionary";

describe("GTNH voltage tiers", () => {
  it("aligns tier index 0 with LV (32 EU/t), matching scripts/gtnh-data/utils.ts and gt.voltageTier", () => {
    expect(getVoltageTierName(0)).toBe("LV");
    expect(getVoltageTierBaseVoltage(0)).toBe(32);
    expect(getVoltageTierName(1)).toBe("MV");
    expect(getVoltageTierBaseVoltage(1)).toBe(128);
  });

  it("falls back gracefully for out-of-range tiers", () => {
    expect(getVoltageTierName(999)).toBe("Tier 999");
    expect(getVoltageTierBaseVoltage(999)).toBe(0);
  });

  it("re-exports the same array machines.ts uses, not a copy", () => {
    expect(GTNH_VOLTAGE_TIERS.length).toBeGreaterThan(10);
  });
});
