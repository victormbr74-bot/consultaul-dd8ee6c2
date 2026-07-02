import { describe, expect, it } from "vitest";
import { getJiraAlarmType, getJiraIncident } from "./dashboardJira";

describe("dashboard Jira", () => {
  it("aceita somente os dois tipos oficiais de alarme", () => {
    expect(getJiraAlarmType({ Resumo: "LINK PRINCIPAL INOPERANTE" })).toBe("LINK PRINCIPAL INOPERANTE");
    expect(getJiraAlarmType({ "Tipo de Falha": "LINK BACKUP INOPERANTE" })).toBe("LINK BACKUP INOPERANTE");
    expect(getJiraAlarmType({ Resumo: "INTERMITENCIA PRINCIPAL" })).toBeNull();
    expect(getJiraAlarmType({ Resumo: "REQ-123", "Tipo de Falha": "UL ISOLADA" })).toBeNull();
  });

  it("normaliza a INC usada nos indicadores", () => {
    expect(getJiraIncident({ "Número INC": "INC-100" })).toBe("INC-100");
    expect(getJiraIncident({ Chamado: "sem incidente" })).toBeNull();
  });
});
