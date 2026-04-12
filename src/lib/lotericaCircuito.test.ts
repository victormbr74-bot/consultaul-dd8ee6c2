import { describe, expect, it } from "vitest";
import { buildCircuitExactCandidates, buildCircuitSearchVariants } from "./lotericaCircuito";

describe("lotericaCircuito", () => {
  it("keeps the raw circuito term and adds a compact variant without internal spaces", () => {
    expect(buildCircuitSearchVariants("2 1 9 1 2 3 4 5 6 7 8 9")).toEqual([
      "2 1 9 1 2 3 4 5 6 7 8 9",
      "219123456789",
    ]);
  });

  it("creates exact lookup candidates with compact and uppercase circuito variants", () => {
    expect(buildCircuitExactCandidates("o e m p - 1 2 3")).toEqual([
      "o e m p - 1 2 3",
      "O E M P - 1 2 3",
      "oemp-123",
      "OEMP-123",
    ]);
  });
});
