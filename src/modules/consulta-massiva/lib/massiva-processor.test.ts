import { describe, expect, it } from "vitest";
import type { DbLoterica } from "./db-types";
import type { GisRow } from "./gis-types";
import { processGis } from "./massiva-processor";
import { operadorasFromLotericas } from "./operadoras";

function loterica(codUl: string, designacao: string, operadoraBackup: string): DbLoterica {
  return {
    cod_ul: codUl,
    nome_loterica: codUl,
    ccto_oi: designacao,
    ccto_oemp: null,
    operadora: operadoraBackup,
    loopback_wan: null,
    loopback_lan: null,
    cidade: "RIO DE JANEIRO",
    uf: "RJ",
    designacao_nova: designacao,
    raw_data: {},
  };
}

describe("processGis - classificação de massiva principal", () => {
  it("mantém PRINCIPAL como VTAL com backups diferentes e base parcial", () => {
    const baseCompleta = [
      loterica("19-000001-1", "CEFRJO0000001", "OI"),
      loterica("19-000002-2", "CEFRJO0000002", "SENCINET"),
      loterica("19-000003-3", "CEFRJO0000003", "OI"),
      loterica("19-000004-4", "CEFRJO0000004", "SENCINET"),
      loterica("19-000005-5", "CEFRJO0000005", "OI"),
    ];
    const baseParcial = baseCompleta.slice(0, 3);
    const rows: GisRow[] = baseCompleta.map((item, index) => ({
      "Cód. da Lotérica": item.cod_ul,
      "Tipo de Link": "PRINCIPAL",
      "Designação": item.designacao_nova,
      "IP Loopback": `10.51.0.${index + 1}`,
      "Data e Hora Incial": `2026-07-01 10:0${index}:00`,
      UF: "RJ",
      __origem: "1_LINK",
    }));

    const result = processGis(rows, operadorasFromLotericas(baseParcial), baseParcial);

    expect(result.massivas).toHaveLength(1);
    expect(result.massivas[0]).toMatchObject({
      tipo_massiva: "PRINCIPAL_VTAL",
      operadora: "VTAL",
      uf: "RJ",
      qtd_circuitos: 5,
    });
  });

  it("mantém a massiva BA como VTAL quando o GIS informa Empresa OI", () => {
    const base = Array.from({ length: 5 }, (_, index) => ({
      ...loterica(`03-00000${index + 1}-${index}`, `CEFBAA000000${index + 1}`, "OI"),
      uf: "BA",
      cidade: "SALVADOR",
      raw_data: index < 2 ? { "EMPRESA OEMP": "BRISANET" } : {},
    }));
    const operadoras = base.map((item, index) => ({
      id: `op-${index}`,
      codigo_loterica: item.cod_ul,
      designacao: item.designacao_nova ?? "",
      ip_loopback: "",
      ip_loopback_secundario: "",
      operadora: "BRISANET",
      operadora_4g: item.operadora ?? "",
      tipo_empresa: "OEMP" as const,
      ativo: true,
    }));
    const rows: GisRow[] = base.map((item, index) => ({
      "Cód. da Lotérica": item.cod_ul,
      "Tipo de Link": "PRINCIPAL",
      "Designação": item.designacao_nova,
      "IP Loopback": `10.53.0.${index + 1}`,
      "Data e Hora Incial": "2026-06-30 09:51:47",
      Empresa: "OI",
      UF: "BA",
      __origem: "1_LINK",
    }));

    const result = processGis(rows, operadoras, base);

    expect(result.massivas).toHaveLength(1);
    expect(result.massivas[0]).toMatchObject({
      tipo_massiva: "PRINCIPAL_VTAL",
      operadora: "VTAL",
      uf: "BA",
      qtd_circuitos: 5,
    });
  });

  it("continua classificando como OEMP quando EMPRESA OEMP é explícita", () => {
    const base = Array.from({ length: 5 }, (_, index) => ({
      ...loterica(`21-00000${index + 1}-${index}`, `CEFSAO000000${index + 1}`, "OI"),
      uf: "SP",
      cidade: "SAO PAULO",
      raw_data: { "EMPRESA OEMP": "BRISANET" },
    }));
    const rows: GisRow[] = base.map((item, index) => ({
      "Cód. da Lotérica": item.cod_ul,
      "Tipo de Link": "PRINCIPAL",
      "Designação": item.designacao_nova,
      "IP Loopback": `10.52.0.${index + 1}`,
      "Data e Hora Incial": `2026-07-01 11:0${index}:00`,
      UF: "SP",
      __origem: "1_LINK",
    }));

    const result = processGis(rows, operadorasFromLotericas(base), base);

    expect(result.massivas).toHaveLength(1);
    expect(result.massivas[0]).toMatchObject({
      tipo_massiva: "PRINCIPAL_OEMP",
      operadora: "BRISANET",
      uf: "SP",
      qtd_circuitos: 5,
    });
  });
});
