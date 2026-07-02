import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { cleanVal, parseCsvText } from "./parse";
import { parseFile } from "./parse";

describe("parseCsvText", () => {
  it("preserva data e hora da coluna I do CSV GIS", () => {
    const csv = [
      "\uFEFFsep=,",
      '"Cód. da Lotérica","Lotérica","Tipo de Link","Cidade","UF","Telefone","Designação","IP Loopback","Data e Hora Incial","Duração (h)"',
      "05-005778-2,LOTERIA SORTE GRANDE,PRINCIPAL,FORTALEZA,CE,(85) 88405136,CEFFLA5979675,10.51.57.72,2024-05-08 04:17:20,18845",
    ].join("\r\n");

    const rows = parseCsvText(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]["Data e Hora Incial"]).toBe("2024-05-08 04:17:20");
  });
});

describe("parseFile GIS XLSX", () => {
  it("preserva o serial com a fracao de hora sem criar Date dependente de fuso", async () => {
    const serial = Date.UTC(2024, 4, 8, 4, 17, 20) / 86400000 + 25569;
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Cód. da Lotérica", "Data e Hora Incial"],
      ["05-005778-2", serial],
    ]);
    sheet.B2.z = "dd/mm/yyyy hh:mm:ss";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "GIS");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = {
      name: "gis.xlsx",
      arrayBuffer: async () => bytes,
    } as File;

    const result = await parseFile(file, "gis1");

    expect(typeof result.rows[0]["Data e Hora Incial"]).toBe("number");
    expect(result.rows[0]["Data e Hora Incial"]).toBeCloseTo(serial, 8);
  });
});

describe("cleanVal", () => {
  it("serializa Date de forma deterministica", () => {
    expect(cleanVal(new Date("2026-07-02T12:34:56.000Z"))).toBe("2026-07-02T12:34:56.000Z");
    expect(cleanVal(new Date(Number.NaN))).toBe("");
  });
});
