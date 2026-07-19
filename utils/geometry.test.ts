import { describe, expect, it } from "vitest";
import { clampNodeSize, computeMinNodeHeight, snapToGrid } from "./geometry";

describe("clampNodeSize", () => {
  it("grows width/height by the drag delta", () => {
    expect(clampNodeSize(240, 150, 50, 30, 180, 120)).toEqual({ width: 290, height: 180 });
  });

  it("shrinks but never below the given minimums", () => {
    expect(clampNodeSize(240, 150, -1000, -1000, 180, 120)).toEqual({ width: 180, height: 120 });
  });

  it("clamps width and height independently", () => {
    expect(clampNodeSize(240, 150, -1000, 50, 180, 120)).toEqual({ width: 180, height: 200 });
  });
});

describe("computeMinNodeHeight", () => {
  it("grows with the number of IO rows so content never spills past the box", () => {
    const oneRow = computeMinNodeHeight(1);
    const twoRows = computeMinNodeHeight(2);
    const fiveRows = computeMinNodeHeight(5);
    expect(twoRows).toBeGreaterThan(oneRow);
    expect(fiveRows).toBeGreaterThan(twoRows);
  });

  it("treats a recipe with no IO rows the same as one row", () => {
    expect(computeMinNodeHeight(0)).toBe(computeMinNodeHeight(1));
  });

  // Canvas.tsx feeds this Math.max(inputs.length, outputs.length) -- a row
  // is only unpaired (and thus only needs headroom) up to however many the
  // longer side has, regardless of how short the other side is.
  const ioRowCountOf = (inputs: number, outputs: number) => Math.max(inputs, outputs);

  it.each([
    { label: "1 in / 1 out", inputs: 1, outputs: 1 },
    { label: "3 in / 1 out", inputs: 3, outputs: 1 },
    { label: "3 in / 2 out", inputs: 3, outputs: 2 },
    { label: "10 in / 10 out", inputs: 10, outputs: 10 },
    { label: "10 in / 12 out (absurd)", inputs: 10, outputs: 12 },
  ])("computes a positive, row-count-scaled minimum for $label", ({ inputs, outputs }) => {
    const rows = ioRowCountOf(inputs, outputs);
    const minHeight = computeMinNodeHeight(rows);
    expect(minHeight).toBeGreaterThan(0);
    expect(minHeight).toBe(computeMinNodeHeight(rows)); // deterministic
  });

  it("only the longer side matters -- 3/1 and 3/2 need the same headroom", () => {
    expect(computeMinNodeHeight(ioRowCountOf(3, 1))).toBe(computeMinNodeHeight(ioRowCountOf(3, 2)));
  });

  it("10/12 needs strictly more headroom than 10/10", () => {
    expect(computeMinNodeHeight(ioRowCountOf(10, 12))).toBeGreaterThan(computeMinNodeHeight(ioRowCountOf(10, 10)));
  });

  it("scales linearly with row count once past the single-row floor", () => {
    // Each extra row adds one row height + one gap, so the deltas between
    // consecutive counts should be identical -- not just "bigger."
    const step = (n: number) => computeMinNodeHeight(n + 1) - computeMinNodeHeight(n);
    expect(step(1)).toBe(step(3));
    expect(step(3)).toBe(step(9));
  });
});

describe("snapToGrid", () => {
  it("rounds to the nearest grid step", () => {
    expect(snapToGrid(291, 20)).toBe(300);
    expect(snapToGrid(199, 20)).toBe(200);
  });
});
