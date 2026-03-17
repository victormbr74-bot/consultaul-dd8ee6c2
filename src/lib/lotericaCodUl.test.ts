import { describe, expect, it } from "vitest";

import {
  buildCodUlExactCandidates,
  buildCodUlSearchVariants,
  formatCodUlFromDigits,
  normalizeCodUlTerm,
} from "@/lib/lotericaCodUl";

describe("lotericaCodUl", () => {
  it("normalizes codigos UL with separators to the canonical format", () => {
    expect(normalizeCodUlTerm("21_000111_1")).toBe("21-000111-1");
    expect(normalizeCodUlTerm("21-000111-1")).toBe("21-000111-1");
    expect(normalizeCodUlTerm("210001111")).toBe("21-000111-1");
  });

  it("keeps partial numeric searches formatted without confusing them with circuitos", () => {
    expect(formatCodUlFromDigits("21000")).toBe("21-000");
    expect(normalizeCodUlTerm("21000")).toBe("21-000");
    expect(normalizeCodUlTerm("219123456789")).toBe("219123456789");
  });

  it("adds the canonical codigo UL to exact candidates when only digits are informed", () => {
    expect(buildCodUlExactCandidates("210001111")).toEqual(["210001111", "21-000111-1"]);
    expect(buildCodUlExactCandidates("21_000111_1")).toEqual(["21_000111_1", "21-000111-1"]);
  });

  it("creates search variants for both raw and canonical codigo UL", () => {
    expect(buildCodUlSearchVariants("21000")).toEqual(["21000", "21-000"]);
    expect(buildCodUlSearchVariants("21-000111-1")).toEqual(["21-000111-1"]);
  });
});
