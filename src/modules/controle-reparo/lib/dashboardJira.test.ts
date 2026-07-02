import { describe, expect, it } from "vitest";
import { getJiraAlarmType, jiraRowsWithoutControleIncident } from "./dashboardJira";

describe("dashboard Jira", () => {
  it("aceita somente os dois tipos oficiais de alarme", () => {
    expect(getJiraAlarmType({ Resumo: "LINK PRINCIPAL INOPERANTE" })).toBe("LINK PRINCIPAL INOPERANTE");
    expect(getJiraAlarmType({ "Tipo de Falha": "LINK BACKUP INOPERANTE" })).toBe("LINK BACKUP INOPERANTE");
    expect(getJiraAlarmType({ Resumo: "INTERMITENCIA PRINCIPAL" })).toBeNull();
    expect(getJiraAlarmType({ Resumo: "REQ-123", "Tipo de Falha": "UL ISOLADA" })).toBeNull();
  });

  it("calcula INC sem alarme pela INC normalizada", () => {
    const rows = [
      { "Número INC": "INC-100" },
      { Chamado: "INC-101" },
      { Chamado: "sem incidente" },
    ];

    expect(jiraRowsWithoutControleIncident(rows, new Set(["INC-100"]))).toEqual([
      { Chamado: "INC-101" },
    ]);
  });
});
