import { describe, expect, it } from "vitest";

import { buildTextCompareResult } from "@/lib/textCompare";

describe("buildTextCompareResult", () => {
  it("marks identical texts as equal", () => {
    const result = buildTextCompareResult("linha 1\nlinha 2", "linha 1\nlinha 2");

    expect(result.summary.hasDifferences).toBe(false);
    expect(result.summary.identicalLines).toBe(2);
    expect(result.summary.similarity).toBe(100);
    expect(result.rows.every((row) => row.left.status === "same" && row.right.status === "same")).toBe(true);
  });

  it("pairs modified lines and highlights inline changes", () => {
    const result = buildTextCompareResult("alpha beta", "alpha gama");

    expect(result.summary.changedLines).toBe(1);
    expect(result.rows[0].left.status).toBe("changed");
    expect(result.rows[0].right.status).toBe("changed");
    expect(result.rows[0].left.segments.some((segment) => segment.changed && segment.value.includes("beta"))).toBe(true);
    expect(result.rows[0].right.segments.some((segment) => segment.changed && segment.value.includes("gama"))).toBe(true);
  });

  it("detects added and removed lines", () => {
    const result = buildTextCompareResult("a\nb", "a\nb\nc");

    expect(result.summary.addedLines).toBe(1);
    expect(result.summary.removedLines).toBe(0);
    expect(result.rows[2].left.status).toBe("empty");
    expect(result.rows[2].right.status).toBe("added");
    expect(result.rows[2].right.text).toBe("c");
  });

  it("can ignore case and whitespace when comparing", () => {
    const result = buildTextCompareResult(" Alpha   Beta ", "alpha beta", {
      ignoreCase: true,
      ignoreWhitespace: true,
    });

    expect(result.summary.hasDifferences).toBe(false);
    expect(result.summary.identicalLines).toBe(1);
  });
});
