import { describe, expect, it } from "vitest";
import {
  normalizeControleDisplayName,
  normalizeControleFilterText,
} from "@/modules/controle-reparo/lib/displayNormalization";

describe("controle display normalization", () => {
  it.each([
    ["ativa", "ATIVA"],
    [" Ativa ", "ATIVA"],
    ["Consultar Responsável", "CONSULTAR RESPONSÁVEL"],
    ["consultar   responsavel", "CONSULTAR RESPONSÁVEL"],
    ["MAM TECH", "MAMTECH"],
    ["mamtech", "MAMTECH"],
    ["Não OEMP", "NÃO OEMP"],
    ["nao oemp", "NÃO OEMP"],
    ["Oi", "OI"],
    ["sencinet", "SENCINET"],
    ["Sitelbra", "SITELBRA"],
    ["vivo", "VIVO"],
    ["Vtal", "VTAL"],
    ["V TAL", "VTAL"],
    ["V-TAL", "VTAL"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeControleDisplayName(input)).toBe(expected);
  });

  it("keeps unrelated values untouched except for extra spaces", () => {
    expect(normalizeControleDisplayName("  Outro   Valor  ")).toBe("Outro Valor");
  });

  it("builds accent-insensitive filter text from canonical names", () => {
    expect(normalizeControleFilterText("Consultar Responsavel")).toBe("consultar responsavel");
    expect(normalizeControleFilterText("NÃO OEMP")).toBe("nao oemp");
  });
});
