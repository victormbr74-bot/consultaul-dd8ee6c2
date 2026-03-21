import { describe, expect, it } from "vitest";

import {
  buildMailtoUrl,
  buildValidationHtmlTable,
  buildValidationEmailText,
  resolveValidationDesignacao,
  resolveValidationUnidade,
  type ValidationEmailRow,
} from "@/lib/validacaoEmail";

describe("validacaoEmail", () => {
  it("builds the unidade field with nome and codigo", () => {
    expect(
      resolveValidationUnidade({
        cod_ul: "21-000111-1",
        nome_loterica: "SAA AG. ITACOLOMI",
      }),
    ).toBe("SAA AG. ITACOLOMI (21-000111-1)");
  });

  it("prefers the primary designacao for primario", () => {
    expect(
      resolveValidationDesignacao(
        {
          designacao_nova: "BHE6912964",
          ccto_oi: "219123456789",
          raw_data: {
            "DESIGNACAO NOVA": "IGNORAR",
          },
        },
        "primario",
      ),
    ).toBe("BHE6912964");
  });

  it("prefers ccto_oemp as the designacao for secundario", () => {
    expect(
      resolveValidationDesignacao(
        {
          ccto_oemp: "CCTO-SECUNDARIO-01",
          raw_data: {
            "CIRCUITO OEMP": "OEMP-123456",
          },
        },
        "secundario",
      ),
    ).toBe("CCTO-SECUNDARIO-01");
  });

  it("falls back to secondary aliases from raw_data when ccto_oemp is empty", () => {
    expect(
      resolveValidationDesignacao(
        {
          ccto_oemp: "",
          raw_data: {
            "Designação 2": "SEC-ALIAS-02",
          },
        },
        "secundario",
      ),
    ).toBe("SEC-ALIAS-02");
  });

  it("builds the validation email body with all requested columns", () => {
    const rows: ValidationEmailRow[] = [
      {
        unidadeLoterico: "SAA AG. ITACOLOMI (21-000111-1)",
        designacao: "BHE6912964",
        circuito: "Primario",
        acaoRealizada: "Migracao na rede de transporte",
        chamado: "REQ000143434307",
        chamadoOperadora: "WO0000079738107",
        tipoFalha: "Indisponibilidade (Total)",
        status: "",
      },
    ];

    const text = buildValidationEmailText(rows);

    expect(text).toContain("Bom dia, tudo bem?");
    expect(text).toContain("Unidade Loterico | Designacao | Primario/Secundario");
    expect(text).toContain("Migracao na rede de transporte");
    expect(text).toContain("WO0000079738107");
  });

  it("builds the validation email html table", () => {
    const rows: ValidationEmailRow[] = [
      {
        unidadeLoterico: "SAA AG. ITACOLOMI (21-000111-1)",
        designacao: "BHE6912964",
        circuito: "Primario",
        acaoRealizada: "Migracao na rede de transporte",
        chamado: "REQ000143434307",
        chamadoOperadora: "WO0000079738107",
        tipoFalha: "Indisponibilidade (Total)",
        status: "",
      },
    ];

    const html = buildValidationHtmlTable(rows);

    expect(html).toContain("<table");
    expect(html).toContain("Unidade Loterico");
    expect(html).toContain("WO0000079738107");
  });

  it("encodes subject and body for mailto", () => {
    const url = buildMailtoUrl({
      subject: "Validacao de circuito - 21-000111-1",
      body: "Linha 1\nLinha 2",
    });

    expect(url).toContain("mailto:");
    expect(url).toContain("subject=Validacao%20de%20circuito%20-%2021-000111-1");
    expect(url).toContain("body=Linha%201%0ALinha%202");
  });
});
