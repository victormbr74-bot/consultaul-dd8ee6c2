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

describe("processControle Controle D-1", () => {
  it("herda Ordem e Situacao do Controle D-1 pelos cabecalhos exportados", () => {
    const result = processControle({
      gis1: [
        {
          "Cód. da Lotérica": "05-005778-2",
          Lotérica: "LOTERIA SORTE GRANDE",
          "Tipo de Link": "PRINCIPAL",
          UF: "CE",
          Cidade: "FORTALEZA",
          Designação: "CEFFLA5979675",
          Chamado: "INC-231887",
          "Duração (h)": "18512",
          Empresa: "OI",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Código da Lotérica": "05-005778-2",
          Lotérica: "LOTERIA SORTE GRANDE",
          "Tipo de Link": "PRINCIPAL",
          UF: "CE",
          Designação: "FLA5979675",
          Ordem: "ALTCTEC",
          Situação: "MIGRAÇÃO EM ANDAMENTO",
          "STATUS PLANILHA": "MIGRAÇÃO EM ANDAMENTO",
          Responsável: "Wesley Fernandes da Fonseca Rodrigues",
        },
      ],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-19",
      processadoEm: "2026-06-19T12:00:00.000Z",
      prior: [],
    });

    expect(result.controle[0].ordem).toBe("ALTCTEC");
    expect(result.controle[0].situacao).toBe("MIGRAÇÃO EM ANDAMENTO");
    expect(result.stats.report.d1.cruzados).toBe(1);
    expect(result.stats.report.d1.situacaoFallbackReparo).toBe(0);
  });

  it("herda Status Planilha valido do D-1 por codigo e tipo de link sem cair em CEC ANALISANDO", () => {
    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-6",
          Lotérica: "UL STATUS D1",
          "Tipo de Link": "PRINCIPAL",
          UF: "SP",
          Cidade: "SAO PAULO",
          Designação: "CEFSTATUSD1",
          Chamado: "INC-47534",
          "Duração (h)": "48",
          Empresa: "OEMP",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Código da Lotérica": "21-001284-6",
          "Tipo de Link": "SECUNDARIO",
          Designação: "CEFOUTROLINK",
          "STATUS PLANILHA": "NORMALIZADO",
        },
        {
          "Código da Lotérica": "21-001284-6",
          "Tipo de Link": "PRINCIPAL",
          Designação: "CEFSTATUSD1",
          "STATUS PLANILHA": "pendencia infra cliente",
        },
      ],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-29",
      processadoEm: "2026-06-29T12:00:00.000Z",
      prior: [],
    });

    expect(result.controle[0].codigo_loterica).toBe("21-001284-6");
    expect(result.controle[0].tipo_link).toBe("PRINCIPAL");
    expect(result.controle[0].status_planilha).toBe("PENDENCIA INFRA CLIENTE");
  });

  it("usa CEC ANALISANDO somente quando Status Planilha do D-1 esta vazio ou invalido", () => {
    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-6",
          Lotérica: "UL STATUS INVALIDO",
          "Tipo de Link": "PRINCIPAL",
          UF: "SP",
          Cidade: "SAO PAULO",
          Designação: "CEFINVALIDO",
          Chamado: "INC-47535",
          "Duração (h)": "48",
          Empresa: "OEMP",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Código da Lotérica": "21-001284-6",
          "Tipo de Link": "PRINCIPAL",
          Designação: "CEFINVALIDO",
          "STATUS PLANILHA": "comentario tecnico fora da lista",
        },
      ],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-29",
      processadoEm: "2026-06-29T12:00:00.000Z",
      prior: [],
    });

    expect(result.controle[0].status_planilha).toBe("CEC ANALISANDO");
  });
});

describe("processControle Jira e responsaveis", () => {
  it("preenche Fila Jira com Jira.Status usando INC normalizada de campo equivalente", () => {
    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-6",
          Lotérica: "UL JIRA",
          "Tipo de Link": "PRINCIPAL",
          UF: "BA",
          Cidade: "SALVADOR",
          Designação: "CEFJIRA",
          Chamado: "INC 47534",
          "Duração (h)": "48",
          Empresa: "OI",
        },
      ],
      gis2: [],
      controleD1: [],
      jira: [
        {
          "Número INC": "47534",
          Status: "AGUARDANDO OI",
          "Tipo de Falha": "LINK PRINCIPAL INOPERANTE",
        },
      ],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-29",
      processadoEm: "2026-06-29T12:00:00.000Z",
      prior: [],
    });

    expect(result.controle[0].fila_jira).toBe("AGUARDANDO OI");
    expect(result.controle[0].responsavel).toBe("Wesley Fernandes da Fonseca Rodrigues");
    expect(result.stats.report.jira.cruzados).toBe(1);
    expect(result.stats.report.jira.filaJiraVazia).toBe(0);
  });

  it("preserva responsavel de versao anterior somente quando e nome valido completo", () => {
    const priorBase = {
      data_referencia: "2026-06-29",
      versao: 1,
      chave: "21-001284-6|PRINCIPAL|PRINCIPAL+OEMP+INC-47536",
      codigo_loterica: "21-001284-6",
      loterica: "UL OEMP",
      tipo_link: "PRINCIPAL",
      uf: "SP",
      cidade: "SAO PAULO",
      designacao: "CEFOEMP",
      ip_loopback: null,
      data_hora_inicial: null,
      duracao_h: null,
      chamado: "INC-47536",
      previsao_atendimento: null,
      ultimo_comentario: null,
      grafana: null,
      empresa: "OEMP",
      designacao_parceiro: null,
      fila_jira: null,
      inc_snow: null,
      incidente_mam: null,
      ordem: "REPARO",
      novo_circuito: null,
      situacao: "REPARO",
      status_planilha: "CEC ANALISANDO",
      status_jira: null,
      obs: null,
      responsavel: "Caroline Victoria Marques de Oliveira",
      responsavel_backup: null,
      status_zabbix: null,
      status_normalizacao: "ATIVO" as const,
      normalizado_em: null,
      pendente_enriquecimento: false,
      tem_os_reparo: false,
      tipo_falha: null,
    };

    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-6",
          Lotérica: "UL OEMP",
          "Tipo de Link": "PRINCIPAL",
          UF: "SP",
          Cidade: "SAO PAULO",
          Designação: "CEFOEMP",
          Chamado: "INC-47536",
          "Duração (h)": "48",
          Empresa: "OEMP",
        },
      ],
      gis2: [],
      controleD1: [],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-29",
      processadoEm: "2026-06-29T12:00:00.000Z",
      prior: [priorBase],
      sameDayPrior: [priorBase],
      versao: 2,
    });

    expect(result.controle[0].responsavel).toBe("Caroline Victoria Marques de Oliveira");
    expect(result.stats.report.versionamento.responsavelPreservados).toBe(1);
  });
});
