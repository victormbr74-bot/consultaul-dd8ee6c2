import { describe, expect, it } from "vitest";
import { parseCsvText } from "./parse";

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
