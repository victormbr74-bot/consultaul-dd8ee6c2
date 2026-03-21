import { describe, expect, it } from "vitest";

import {
  applyCustomTemplatePlaceholders,
  normalizeRouterModelValue,
  resolveCustomRouterScriptTemplate,
  type RouterScriptCustomTemplateRow,
  type RouterScriptPlaceholderContext,
  type RouterScriptTemplateSelection,
} from "@/lib/routerScriptCustomTemplate";

const buildTemplate = (overrides: Partial<RouterScriptCustomTemplateRow>): RouterScriptCustomTemplateRow => ({
  id: "template-1",
  name: "Template Base",
  router_role: "backup",
  model: "any",
  technology: "any",
  owner: "any",
  switch_topology: "any",
  script_variant: "completo",
  content: "conteudo",
  notes: null,
  is_active: true,
  created_at: "2026-03-06T13:00:00.000Z",
  updated_at: "2026-03-06T13:00:00.000Z",
  updated_by: null,
  ...overrides,
});

const selection: RouterScriptTemplateSelection = {
  routerRole: "backup",
  model: "hp20-11",
  technology: "4g",
  owner: "oi",
  switchTopology: "sem-switch",
  scriptVariant: "bgp",
};

const placeholderContext: RouterScriptPlaceholderContext = {
  codUl: "21-000001-0",
  hostname: "21-000001-0_RT01",
  sysname: "21-000001-0_RT02",
  nomeLoterica: "Lot Teste",
  cidade: "Sao Paulo",
  uf: "SP",
  contato: "11999999999",
  cctoOi: "VM 123456",
  cctoOemp: "OEMP 98765",
  designacaoNova: "DES-1",
  routerRole: "backup",
  routerModel: "hp20-11",
  technology: "4g",
  owner: "oi",
  switchTopology: "sem-switch",
  operadora4g: "tim",
  primaryLoopback: "10.50.1.10",
  primaryTunnelIp: "15.50.1.10",
  loopbackSecundario: "10.51.1.10",
  lanNetwork: "99.244.10.0",
  lanRouter: "99.244.10.3",
  lanVirtual: "99.244.10.1",
  lanAclHost: "99.244.10.2",
  lanMask: "255.255.255.240",
  lanPrefix: "28",
  switchIp: "10.52.10.10",
  switchNetwork: "10.52.10.8",
  switchVirtual: "10.52.10.9",
  switchMask: "255.255.255.248",
  switchPrefix: "29",
};

describe("resolveCustomRouterScriptTemplate", () => {
  it("prefers an exact partial template over a complete one", () => {
    const templates = [
      buildTemplate({ id: "full", name: "Completo", script_variant: "completo", model: "hp20-11", technology: "4g", owner: "oi" }),
      buildTemplate({ id: "bgp", name: "Parcial BGP", script_variant: "bgp", model: "hp20-11", technology: "4g", owner: "oi", updated_at: "2026-03-06T14:00:00.000Z" }),
    ];

    const match = resolveCustomRouterScriptTemplate(templates, selection);

    expect(match?.template.id).toBe("bgp");
    expect(match?.baseVariant).toBe("bgp");
  });

  it("falls back to a complete template when there is no partial exact match", () => {
    const templates = [
      buildTemplate({ id: "full", name: "Completo", script_variant: "completo", model: "hp20-11", technology: "4g", owner: "oi" }),
    ];

    const match = resolveCustomRouterScriptTemplate(templates, selection);

    expect(match?.template.id).toBe("full");
    expect(match?.baseVariant).toBe("completo");
  });

  it("chooses the most specific active template", () => {
    const templates = [
      buildTemplate({ id: "generic", name: "Generico", script_variant: "bgp" }),
      buildTemplate({ id: "specific", name: "Especifico", script_variant: "bgp", model: "hp20-11", technology: "4g", owner: "oi" }),
      buildTemplate({ id: "inactive", name: "Inativo", script_variant: "bgp", model: "hp20-11", technology: "4g", owner: "oi", is_active: false, updated_at: "2026-03-07T14:00:00.000Z" }),
    ];

    const match = resolveCustomRouterScriptTemplate(templates, selection);

    expect(match?.template.id).toBe("specific");
  });
});

describe("applyCustomTemplatePlaceholders", () => {
  it("replaces known placeholders with loterica data", () => {
    const template = [
      "hostname {{HOSTNAME}}",
      "router-id {{LOOPBACK_SECUNDARIO}}",
      "network {{LAN_NETWORK}}/{{LAN_PREFIX}}",
      "switch {{SWITCH_IP}}",
      "ul {{COD_UL}} {{NOME_LOTERICA}}/{{UF}}",
    ].join("\n");

    const output = applyCustomTemplatePlaceholders(template, placeholderContext);

    expect(output).toContain("hostname 21-000001-0_RT01");
    expect(output).toContain("router-id 10.51.1.10");
    expect(output).toContain("network 99.244.10.0/28");
    expect(output).toContain("switch 10.52.10.10");
    expect(output).toContain("ul 21-000001-0 Lot Teste/SP");
  });

  it("clears unknown placeholders instead of leaving raw tokens", () => {
    const output = applyCustomTemplatePlaceholders("x {{TOKEN_INEXISTENTE}} y", placeholderContext);
    expect(output).toBe("x  y");
  });
});

describe("normalizeRouterModelValue", () => {
  it("maps HP aliases to the canonical HPMSR models", () => {
    expect(normalizeRouterModelValue("HPMSR900")).toBe("hpmsr900");
    expect(normalizeRouterModelValue("HP 900")).toBe("hpmsr900");
    expect(normalizeRouterModelValue("HPMSR 920")).toBe("hpmsr920");
    expect(normalizeRouterModelValue("HP 931")).toBe("hpmsr931");
  });

  it("keeps the existing non-HP models recognized", () => {
    expect(normalizeRouterModelValue("HP 20-11")).toBe("hp20-11");
    expect(normalizeRouterModelValue("HP 1002-4")).toBe("hp1002-4");
    expect(normalizeRouterModelValue("Cisco 1921")).toBe("cisco1900");
    expect(normalizeRouterModelValue("Huawei")).toBe("huawei");
  });
});
