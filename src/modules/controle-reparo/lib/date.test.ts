import { describe, expect, it } from "vitest";
import { formatDateTimeBR, zonedDateTimeToIso } from "./date";

describe("datas do Controle de Reparo", () => {
  it("preserva o horario de Sao Paulo da planilha em qualquer ambiente", () => {
    const iso = zonedDateTimeToIso({
      year: 2025,
      month: 10,
      day: 27,
      hour: 6,
      minute: 9,
      second: 44,
    });

    expect(iso).toBe("2025-10-27T09:09:44.000Z");
    expect(formatDateTimeBR(iso)).toBe("27/10/2025 06:09:44");
  });
});
