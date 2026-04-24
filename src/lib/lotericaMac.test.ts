import { describe, expect, it } from "vitest";

import {
  extractMacCandidates,
  extractMacEquipmentInfo,
  formatMacDisplay,
  isViableMacSearchTerm,
  normalizeMacSearchTerm,
} from "@/lib/lotericaMac";

describe("lotericaMac", () => {
  it("normalizes and formats MAC addresses regardless of separator", () => {
    expect(normalizeMacSearchTerm("AA-BB-CC-DD-EE-FF")).toBe("aabbccddeeff");
    expect(normalizeMacSearchTerm("aabb.ccdd.eeff")).toBe("aabbccddeeff");
    expect(formatMacDisplay("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("detects when the MAC term is viable for a global lookup", () => {
    expect(isViableMacSearchTerm("AA:BB:CC")).toBe(true);
    expect(isViableMacSearchTerm("AA")).toBe(false);
  });

  it("extracts MAC candidates from composite field values", () => {
    expect(extractMacCandidates("uplink: AA-BB-CC-DD-EE-FF / reserva AABB.CCDD.EE11")).toEqual([
      "aabbccddeeff",
      "aabbccddee11",
    ]);
  });

  it("extracts router information related to the matched MAC field", () => {
    const info = extractMacEquipmentInfo(
      {
        "MAC ROTEADOR": "AA-BB-CC-DD-EE-FF",
        "MODELO ROTEADOR": "HP MSR900",
        "SERIAL ROTEADOR": "SER-123",
        "HOSTNAME ROTEADOR": "21-000001-0_RT01",
      },
      "MAC ROTEADOR",
      "AA-BB-CC-DD-EE-FF",
    );

    expect(info.matchedMac).toBe("AA:BB:CC:DD:EE:FF");
    expect(info.equipmentType).toBe("Roteador");
    expect(info.equipmentLabel).toBe("21-000001-0_RT01");
    expect(info.model).toBe("HP MSR900");
    expect(info.serial).toBe("SER-123");
  });

  it("extracts switch information when the MAC belongs to a switch field", () => {
    const info = extractMacEquipmentInfo(
      {
        "ENDERECO MAC SWITCH": "AABB.CCDD.EEFF",
        "EQUIPAMENTO SWITCH": "Switch de acesso",
        "MODELO SWITCH": "Huawei S5720",
        "PATRIMONIO SWITCH": "PAT-77",
      },
      "ENDERECO MAC SWITCH",
      "AABB.CCDD.EEFF",
    );

    expect(info.equipmentType).toBe("Switch");
    expect(info.equipmentLabel).toBe("Switch de acesso");
    expect(info.model).toBe("Huawei S5720");
    expect(info.patrimony).toBe("PAT-77");
  });
});
