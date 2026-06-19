import { describe, expect, it } from "vitest";
import { processControle } from "./processing";

const profileNames = [
  "Rodrigo Nunes da Silva",
  "Ronivon Nunes Figueiredo",
  "Pedro Gabriel Cardoso dos Santos",
  "Wesley Fernandes da Fonseca Rodrigues",
  "Sidney Silva Neiva",
  "Antonio Estanislau",
  "Caroline Victoria Marques de Oliveira",
  "Anabelly Cris Silva",
  "Samara De Paiva Pontes",
];

function runCase(duracao: string) {
  const result = processControle({
    gis1: [
      {
        "Codigo da Loterica": `000${duracao}`,
        Loterica: "UL TESTE",
        "Tipo de Link": "PRINCIPAL",
        UF: "SP",
        Cidade: "SAO PAULO",
        Designacao: `CEFTESTE${duracao}`,
        Chamado: "N/A",
        "Duração (h)": duracao,
        Empresa: "OEMP",
      },
    ],
    gis2: [],
    controleD1: [],
    jira: [],
    grafana: [],
    planta: [],
    profileNames,
    dataReferencia: "2026-06-19",
    processadoEm: "2026-06-19T12:00:00.000Z",
    prior: [],
  });
  return { row: result.controle[0], report: result.stats.report.jira.semIncAte24h };
}

describe("processControle sem INC ate 24h", () => {
  it("preenche apenas os campos permitidos com SEM INC e nao distribui responsavel", () => {
    const { row, report } = runCase("24");

    expect(row.obs).toBe("SEM INC");
    expect(row.responsavel).toBe("SEM INC");
    expect(row.fila_jira).toBe("SEM INC");
    expect(row.status_planilha).toBe("CEC ANALISANDO");
    expect(report).toMatchObject({
      total: 1,
      obsSemInc: 1,
      responsavelSemInc: 1,
      filaJiraSemInc: 1,
      statusPlanilhaCecAnalisando: 1,
    });
    expect(report.exemplos).toHaveLength(1);
  });

  it("mantem a regra existente para sem INC acima de 24h", () => {
    const { row, report } = runCase("25");

    expect(row.obs).toBe("SEM INC");
    expect(row.fila_jira).toBe("SEM INC");
    expect(row.status_planilha).toBe("CEC ANALISANDO");
    expect(row.responsavel).toBe("Caroline Victoria Marques de Oliveira");
    expect(report.total).toBe(0);
  });
});
