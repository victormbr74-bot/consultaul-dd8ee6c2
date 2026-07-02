import { describe, expect, it } from "vitest";
import { processControle } from "./processing";
import { formatDataHora } from "./tempo";

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

describe("processControle data e hora inicial do GIS", () => {
  it("mantem a hora informada na coluna I", () => {
    const result = processControle({
      gis1: [
        {
          "Cód. da Lotérica": "05-005778-2",
          Lotérica: "LOTERIA SORTE GRANDE",
          "Tipo de Link": "PRINCIPAL",
          UF: "CE",
          Cidade: "FORTALEZA",
          Designação: "CEFFLA5979675",
          "IP Loopback": "10.51.57.72",
          "Data e Hora Incial": "2024-05-08 04:17:20",
          "Duração (h)": "18845",
          "Previsão de Atendimento": "2026-05-29 18:00:00",
          "Último Comentário": "Comentário da coluna Q",
          Empresa: "OI",
        },
      ],
      gis2: [],
      controleD1: [],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-07-02",
      processadoEm: "2026-07-02T12:00:00.000Z",
      prior: [],
    });

    expect(result.controle[0].data_hora_inicial).toBe("2024-05-08T07:17:20.000Z");
    expect(result.controle[0].previsao_atendimento).toBe("2024-05-08T07:17:20.000Z");
    expect(result.controle[0].ultimo_comentario).toBe("Comentário da coluna Q");
    expect(formatDataHora(result.controle[0].data_hora_inicial)).toBe("08/05/2024 04:17:20");
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

  it("preserva Status Planilha valido da versao anterior antes do D-1", () => {
    const sameDayPrior = {
      data_referencia: "2026-06-29",
      versao: 1,
      chave: "21-001284-6|PRINCIPAL|105133193+SBO5011854+INC475347+279875239",
      codigo_loterica: "21-001284-6",
      loterica: "LOTERIC A MEGA PREMIUM",
      tipo_link: "PRINCIPAL",
      uf: "SP",
      cidade: "SAO BERNARDO DO CAMPO",
      designacao: "SBO5011854",
      ip_loopback: "10.51.33.193",
      data_hora_inicial: "2026-01-12T10:34:00.000Z",
      duracao_h: 4030,
      chamado: "INC-475347",
      previsao_atendimento: null,
      ultimo_comentario: "6/24/26 10:14",
      grafana: null,
      empresa: "OI",
      designacao_parceiro: "115484351030699",
      fila_jira: "OEMP",
      inc_snow: "PENDENCIA INFRA CLIENTE",
      incidente_mam: "MIGRACAO",
      ordem: "REPARO",
      novo_circuito: "SBO 5011854",
      situacao: "REPARO",
      status_planilha: "FIBRA",
      status_jira: "PENDENCIA INFRA CLIENTE",
      obs: "Em contato com o responsavel VIVO Jailson.",
      responsavel: "Caroline Victoria Marques de Oliveira",
      responsavel_backup: "0",
      status_zabbix: "0",
      status_normalizacao: "ATIVO" as const,
      normalizado_em: null,
      pendente_enriquecimento: false,
      tem_os_reparo: false,
      tipo_falha: null,
    };

    sameDayPrior.chave = processControle({
      gis1: [
        {
          "Cod. da Loterica": "21-001284-6",
          Loterica: "LOTERIC A MEGA PREMIUM",
          "Tipo de Link": "PRINCIPAL",
          Cidade: "SAO BERNARDO DO CAMPO",
          UF: "SP",
          Designacao: "SBO5011854",
          "IP Loopback": "10.51.33.193",
          "Duracao (h)": "4030",
          Empresa: "OI",
          Chamado: "INC-475347",
          "ID do Alarmes": "279875239",
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
      prior: [],
    }).controle[0].chave;

    const result = processControle({
      gis1: [
        {
          "Cod. da Loterica": "21-001284-6",
          Loterica: "LOTERIC A MEGA PREMIUM",
          "Tipo de Link": "PRINCIPAL",
          Cidade: "SAO BERNARDO DO CAMPO",
          UF: "SP",
          Designacao: "SBO5011854",
          "IP Loopback": "10.51.33.193",
          "Duracao (h)": "4030",
          Empresa: "OI",
          Chamado: "INC-475347",
          "ID do Alarmes": "279875239",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Cod. da Loterica": "21-001284-6",
          "Tipo de Link": "PRINCIPAL",
          Designacao: "SBO5011854",
          "IP Loopback": "10.51.33.193",
          Chamado: "INC-475347",
          "ID do Alarmes": "279875239",
          "STATUS PLANILHA": "PENDENCIA INFRA CLIENTE",
        },
      ],
      jira: [],
      grafana: [],
      planta: [],
      profileNames,
      dataReferencia: "2026-06-29",
      processadoEm: "2026-06-29T12:00:00.000Z",
      prior: [sameDayPrior],
      sameDayPrior: [sameDayPrior],
      versao: 2,
    });

    expect(result.controle[0].status_planilha).toBe("FIBRA");
    expect(result.stats.report.versionamento.statusPlanilhaPreservados).toBe(1);
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

  it("canoniza Status Planilha valido com mojibake vindo do D-1", () => {
    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-6",
          Lotérica: "UL SATELITE",
          "Tipo de Link": "SECUNDARIO",
          UF: "BA",
          Cidade: "SALVADOR",
          Designação: "CEFSATELITE",
          Chamado: "INC-47537",
          "Duração (h)": "48",
          Empresa: "SENCINET",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Código da Lotérica": "21-001284-6",
          "Tipo de Link": "SECUNDARIO",
          Designação: "CEFSATELITE",
          "STATUS PLANILHA": "LINK SATÃ‰LITE - TRATATIVA SENCINET",
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

    expect(result.controle[0].status_planilha).toBe("LINK SATÉLITE - TRATATIVA SENCINET");
  });

  it("canoniza Status Planilha satelite necessario com mojibake vindo do D-1", () => {
    const result = processControle({
      gis1: [
        {
          "Código da Lotérica": "21-001284-7",
          Lotérica: "UL SATELITE NECESSARIO",
          "Tipo de Link": "SECUNDARIO",
          UF: "BA",
          Cidade: "SALVADOR",
          Designação: "CEFSATELITENEC",
          Chamado: "INC-47539",
          "Duração (h)": "48",
          Empresa: "SENCINET",
        },
      ],
      gis2: [],
      controleD1: [
        {
          "Código da Lotérica": "21-001284-7",
          "Tipo de Link": "SECUNDARIO",
          Designação: "CEFSATELITENEC",
          "STATUS PLANILHA": "LINK SATÃ‰LITE - NECESSÃRIO VISITA TÃ‰CNICA",
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

    expect(result.controle[0].status_planilha).toBe("LINK SATÉLITE - NECESSÁRIO VISITA TÉCNICA");
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

  it("nao preserva Status Planilha invalido de versao anterior", () => {
    const priorBase = {
      data_referencia: "2026-06-29",
      versao: 1,
      chave: "21-001284-6|PRINCIPAL|PRINCIPAL+OEMP+INC-47538",
      codigo_loterica: "21-001284-6",
      loterica: "UL STATUS INVALIDO VERSAO",
      tipo_link: "PRINCIPAL",
      uf: "SP",
      cidade: "SAO PAULO",
      designacao: "CEFSTATUSVERSAO",
      ip_loopback: null,
      data_hora_inicial: null,
      duracao_h: null,
      chamado: "INC-47538",
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
      status_planilha: "AGUARDANDO ABERTURA DE OS",
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
          Lotérica: "UL STATUS INVALIDO VERSAO",
          "Tipo de Link": "PRINCIPAL",
          UF: "SP",
          Cidade: "SAO PAULO",
          Designação: "CEFSTATUSVERSAO",
          Chamado: "INC-47538",
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

    expect(result.controle[0].status_planilha).toBe("CEC ANALISANDO");
  });
});
