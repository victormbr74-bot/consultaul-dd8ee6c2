import { describe, expect, it } from "vitest";

import { buildMassUpdateRowChange, parseMassUpdateRows } from "@/lib/lotericaMassUpdate";

describe("lotericaMassUpdate", () => {
  it("maps aliases, ignores blank rows, and merges duplicate ULs", () => {
    const result = parseMassUpdateRows([
      {
        "CODIGO UL": "210001111",
        CCTO: "219123456789",
        "Loopback Principal": "10.10.10.1",
      },
      {
        "CODIGO UL": "21-000111-1",
        "CCTO OEM": "OEMP-123456",
        "Empresa OEMP": "CLARO",
      },
      {
        "CODIGO UL": "",
        "CCTO OI": "IGNORAR",
      },
      {
        "CODIGO UL": "21-000222-2",
      },
    ]);

    expect(result.missingCodeHeader).toBe(false);
    expect(result.ignoredRows).toEqual([4, 5]);
    expect(result.duplicateCodes).toEqual(["21-000111-1"]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      codUl: "21-000111-1",
      columnPatch: {
        ccto_oi: "219123456789",
        loopback_wan: "10.10.10.1",
        ccto_oemp: "OEMP-123456",
      },
      rawPatch: {
        "EMPRESA OEMP": "CLARO",
      },
    });
    expect(result.entries[0].rowNumbers).toEqual([2, 3]);
  });

  it("builds only the changed fields and merges raw_data safely", () => {
    const entry = parseMassUpdateRows([
      {
        COD_UL: "21-000111-1",
        "CCTO OI": "219123456789",
        "Empresa OEMP": "CLARO",
      },
    ]).entries[0];

    const { changes, beforeChanges } = buildMassUpdateRowChange(
      {
        cod_ul: "21-000111-1",
        ccto_oi: "219123456700",
        raw_data: {
          "EMPRESA OEMP": "OI",
          "CIRCUITO OEMP": "MANTER",
        },
      },
      entry,
    );

    expect(changes).toEqual({
      ccto_oi: "219123456789",
      raw_data: {
        "EMPRESA OEMP": "CLARO",
        "CIRCUITO OEMP": "MANTER",
      },
    });
    expect(beforeChanges).toEqual({
      ccto_oi: "219123456700",
      raw_data: {
        "EMPRESA OEMP": "OI",
        "CIRCUITO OEMP": "MANTER",
      },
    });
  });

  it("returns no payload when the uploaded values are already identical", () => {
    const entry = parseMassUpdateRows([
      {
        COD_UL: "21-000111-1",
        "CCTO OEMP": "OEMP-999",
      },
    ]).entries[0];

    const result = buildMassUpdateRowChange(
      {
        cod_ul: "21-000111-1",
        ccto_oemp: "OEMP-999",
        raw_data: {},
      },
      entry,
    );

    expect(result.changes).toEqual({});
    expect(result.beforeChanges).toEqual({});
  });
});
