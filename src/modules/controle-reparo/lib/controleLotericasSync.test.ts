import { describe, expect, it } from "vitest";
import { buildControleLotericasSyncUpdates } from "@/modules/controle-reparo/lib/controleLotericasSync";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";

const controleBase: ControleRow = {
  id: "controle-1",
  data_referencia: "2026-06-26",
  versao: 3,
  chave: "k",
  codigo_loterica: "01-005481-2",
  loterica: "UL TESTE",
  tipo_link: "SECUNDÁRIO",
  uf: null,
  cidade: null,
  designacao: null,
  ip_loopback: null,
  data_hora_inicial: null,
  duracao_h: null,
  chamado: null,
  previsao_atendimento: null,
  ultimo_comentario: null,
  grafana: null,
  empresa: "OI",
  designacao_parceiro: "ANTIGO",
  fila_jira: null,
  inc_snow: null,
  incidente_mam: null,
  ordem: null,
  novo_circuito: null,
  situacao: null,
  status_planilha: null,
  status_jira: null,
  obs: null,
  responsavel: null,
  responsavel_backup: "TIM",
  status_zabbix: null,
  status_normalizacao: "ATIVO",
  normalizado_em: null,
  pendente_enriquecimento: false,
  tem_os_reparo: false,
  tipo_falha: null,
};

describe("buildControleLotericasSyncUpdates", () => {
  it("builds updates for Empresa, Desig. Parceiro and Responsável Backup from lotericas", () => {
    const updates = buildControleLotericasSyncUpdates(
      [controleBase],
      [
        {
          cod_ul: "01-005481-2",
          "Empresa CEF": "VTAL",
          "Circuito OEMP": "RJO 1234567",
          "Designacao Nova": "NEW-123",
          "OPERADORA 4G": "VIVO",
        },
      ],
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toEqual({
      empresa: "VTAL",
      designacao_parceiro: "RJO 1234567",
      novo_circuito: "NEW-123",
      responsavel_backup: "VIVO",
    });
  });

  it("does not update Responsável Backup for principal links", () => {
    const updates = buildControleLotericasSyncUpdates(
      [{ ...controleBase, tipo_link: "PRINCIPAL" }],
      [
        {
          cod_ul: "01-005481-2",
          "Empresa CEF": "VTAL",
          "Circuito OEMP": "RJO 1234567",
          "Designacao Nova": "NEW-123",
          "OPERADORA 4G": "VIVO",
        },
      ],
    );

    expect(updates[0].patch).toEqual({
      empresa: "VTAL",
      designacao_parceiro: "RJO 1234567",
      novo_circuito: "NEW-123",
    });
  });

  it("returns no update when values are already equal", () => {
    const updates = buildControleLotericasSyncUpdates(
      [
        {
          ...controleBase,
          empresa: "VTAL",
          designacao_parceiro: "RJO 1234567",
          novo_circuito: "NEW-123",
          responsavel_backup: "VIVO",
        },
      ],
      [
        {
          cod_ul: "01-005481-2",
          "Empresa CEF": "VTAL",
          "Circuito OEMP": "RJO 1234567",
          "Designacao Nova": "NEW-123",
          "OPERADORA 4G": "VIVO",
        },
      ],
    );

    expect(updates).toEqual([]);
  });
});
