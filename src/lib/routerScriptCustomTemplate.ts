import {
  COMPLETE_ROUTER_SCRIPT_VARIANT,
  isExtractableRouterScriptVariant,
  normalizeRouterScriptVariantValue,
  type RouterScriptVariant,
} from "@/lib/routerScript";

export type RouterRole = "principal" | "backup";
export type RouterModel = "cisco1900" | "huawei" | "hp20-11" | "hp1002-4" | "hpmsr900" | "hpmsr931" | "hpmsr920";
export type LinkTechnology = "fibra" | "4g" | "vsat";
export type OwnerType = "oi" | "sencinet";
export type SwitchTopology = "com-switch" | "sem-switch";
export type Operadora4g = "vivo" | "tim" | "arqia" | "claro" | "brisanet" | "nao-se-aplica";
export type TemplateScopeValue<T extends string> = T | "any";

export const ROUTER_MODEL_LABELS: Record<RouterModel, string> = {
  cisco1900: "Cisco 1900",
  huawei: "Huawei",
  "hp20-11": "HP20-11 / HP 2011",
  "hp1002-4": "HP1002-4 / HP 1002",
  hpmsr900: "HPMSR900 / MSR 900 / HP 900",
  hpmsr931: "HPMSR931 / MSR 931 / HP 931",
  hpmsr920: "HPMSR920 / MSR 920 / HP 920",
};

const normalizeRouterModelToken = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const parseHpmsrAliasToken = (token: string): RouterModel | null => {
  const exactAliasMatch = token.match(/(?:HPMSR|HPEMSR|HPE|MSR|HP)(900|920|931)/);
  if (exactAliasMatch) {
    if (exactAliasMatch[1] === "931") return "hpmsr931";
    if (exactAliasMatch[1] === "920") return "hpmsr920";
    return "hpmsr900";
  }

  if (token === "HPMSR" || token === "HP" || token === "MSR" || token === "HPEMSR" || token === "HPE") {
    return "hpmsr900";
  }

  return null;
};

export const parseRouterModelValue = (value: unknown): RouterModel | null => {
  const token = normalizeRouterModelToken(value);

  if (!token) return null;
  if (token.includes("CISCO") || token.includes("1900") || token.includes("1921")) return "cisco1900";
  if (token.includes("HUAWEI") || token.includes("AR121")) return "huawei";
  if (token.includes("2011")) return "hp20-11";
  if (token.includes("10024") || token.includes("1002")) return "hp1002-4";

  const hpmsrAlias = parseHpmsrAliasToken(token);
  if (hpmsrAlias) return hpmsrAlias;

  if (token.includes("931")) return "hpmsr931";
  if (token.includes("920")) return "hpmsr920";
  if (token.includes("900")) return "hpmsr900";

  return null;
};

export const normalizeRouterModelValue = (value: unknown): RouterModel => parseRouterModelValue(value) || "hpmsr900";

export interface RouterScriptCustomTemplateRow {
  id: string;
  name: string;
  router_role: RouterRole;
  model: TemplateScopeValue<RouterModel>;
  technology: TemplateScopeValue<LinkTechnology>;
  owner: TemplateScopeValue<OwnerType>;
  operadora_4g: TemplateScopeValue<Operadora4g>;
  switch_topology: TemplateScopeValue<SwitchTopology>;
  script_variant: RouterScriptVariant;
  content: string;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  source?: "db" | "base";
}

export interface RouterScriptTemplateSelection {
  routerRole: RouterRole;
  model: RouterModel;
  technology: LinkTechnology;
  owner: OwnerType;
  operadora4g: Operadora4g;
  switchTopology: SwitchTopology;
  scriptVariant: RouterScriptVariant;
}

export interface RouterScriptPlaceholderContext {
  codUl: string;
  hostname: string;
  sysname: string;
  nomeLoterica: string;
  cidade: string;
  uf: string;
  contato: string;
  cctoOi: string;
  cctoOemp: string;
  designacaoNova: string;
  routerRole: RouterRole;
  routerModel: RouterModel;
  technology: LinkTechnology;
  owner: OwnerType;
  switchTopology: SwitchTopology;
  operadora4g: Operadora4g;
  primaryLoopback: string;
  primaryTunnelIp: string;
  loopbackSecundario: string;
  lanNetwork: string;
  lanRouter: string;
  lanVirtual: string;
  lanAclHost: string;
  lanMask: string;
  lanPrefix: string;
  switchIp: string;
  switchNetwork: string;
  switchVirtual: string;
  switchMask: string;
  switchPrefix: string;
}

export interface RouterScriptTemplateMatch {
  template: RouterScriptCustomTemplateRow;
  baseVariant: RouterScriptVariant;
  warnings: string[];
}

export const ROUTER_SCRIPT_TEMPLATE_ANY = "any" as const;

export const ROUTER_SCRIPT_PLACEHOLDER_HINTS: Array<{ token: string; description: string }> = [
  { token: "{{COD_UL}}", description: "Codigo UL da loterica." },
  { token: "{{HOSTNAME}}", description: "Hostname padrao no formato COD_UL_RT01." },
  { token: "{{SYSNAME}}", description: "Sysname padrao no formato COD_UL_RT02." },
  { token: "{{NOME_LOTERICA}}", description: "Nome da loterica." },
  { token: "{{CIDADE}}", description: "Cidade da loterica." },
  { token: "{{UF}}", description: "UF da loterica." },
  { token: "{{CONTATO}}", description: "Contato cadastrado." },
  { token: "{{CCTO_OI}}", description: "Circuito OI." },
  { token: "{{CCTO_OEMP}}", description: "Circuito OEMP." },
  { token: "{{DESIGNACAO_NOVA}}", description: "Designacao nova." },
  { token: "{{ROUTER_ROLE}}", description: "Papel selecionado: principal ou backup." },
  { token: "{{ROUTER_MODEL}}", description: "Modelo selecionado do roteador." },
  { token: "{{TECHNOLOGY}}", description: "Tecnologia selecionada." },
  { token: "{{OWNER}}", description: "Owner selecionado." },
  { token: "{{SWITCH_TOPOLOGY}}", description: "Topologia de switch selecionada." },
  { token: "{{OPERADORA_4G}}", description: "Operadora 4G selecionada." },
  { token: "{{LOOPBACK_PRINCIPAL}}", description: "Loopback principal da loterica." },
  { token: "{{TUNNEL_PRINCIPAL}}", description: "IP de tunel derivado do loopback principal." },
  { token: "{{LOOPBACK_SECUNDARIO}}", description: "Loopback secundario da loterica." },
  { token: "{{LAN_NETWORK}}", description: "Rede LAN." },
  { token: "{{LAN_ROUTER}}", description: "IP do roteador na LAN." },
  { token: "{{LAN_VIRTUAL}}", description: "IP virtual da LAN." },
  { token: "{{LAN_ACL_HOST}}", description: "Host auxiliar calculado da LAN." },
  { token: "{{LAN_MASK}}", description: "Mascara da LAN." },
  { token: "{{LAN_PREFIX}}", description: "Prefixo CIDR da LAN." },
  { token: "{{SWITCH_IP}}", description: "IP do switch." },
  { token: "{{SWITCH_NETWORK}}", description: "Rede do switch." },
  { token: "{{SWITCH_VIRTUAL}}", description: "IP virtual do switch." },
  { token: "{{SWITCH_MASK}}", description: "Mascara do switch." },
  { token: "{{SWITCH_PREFIX}}", description: "Prefixo CIDR do switch." },
];

const getRouterModelFamily = (model: RouterModel) => {
  if (model === "hpmsr900" || model === "hpmsr920" || model === "hpmsr931") return "hpmsr";
  return model;
};

const isCompatibleRouterModel = (templateModel: RouterModel, selectedModel: RouterModel) =>
  getRouterModelFamily(templateModel) === getRouterModelFamily(selectedModel);

const compareIsoDateDesc = (left: string | null, right: string | null) => {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
};

interface TemplateMatchOptions {
  allowCompatibleModel?: boolean;
  allowTechnologyFallback?: boolean;
  allowOwnerFallback?: boolean;
  allowOperadoraFallback?: boolean;
  allowSwitchTopologyFallback?: boolean;
}

interface TemplateMatchScore {
  score: number;
  warnings: string[];
}

const scoreTemplateSpecificity = (
  template: RouterScriptCustomTemplateRow,
  selection: RouterScriptTemplateSelection,
  options: TemplateMatchOptions = {},
): TemplateMatchScore | null => {
  let score = 0;
  const warnings: string[] = [];

  if (template.router_role !== selection.routerRole) return null;

  if (template.model !== ROUTER_SCRIPT_TEMPLATE_ANY) {
    if (template.model === selection.model) {
      score += 16;
    } else if (options.allowCompatibleModel && isCompatibleRouterModel(template.model, selection.model)) {
      score += 12;
      warnings.push("Modelo exato nao encontrado. Foi usado um template compativel da familia do roteador.");
    } else {
      return null;
    }
  }

  if (template.technology !== ROUTER_SCRIPT_TEMPLATE_ANY) {
    if (template.technology === selection.technology) {
      score += 8;
    } else if (options.allowTechnologyFallback) {
      score += 1;
      warnings.push("Tecnologia exata nao encontrada. Foi usado um template relacionado do mesmo modelo.");
    } else {
      return null;
    }
  }

  if (template.owner !== ROUTER_SCRIPT_TEMPLATE_ANY) {
    if (template.owner === selection.owner) {
      score += 4;
    } else if (options.allowOwnerFallback) {
      score += 1;
      warnings.push("Owner exato nao encontrado. Foi usado um template relacionado do mesmo modelo.");
    } else {
      return null;
    }
  }

  if (template.operadora_4g !== ROUTER_SCRIPT_TEMPLATE_ANY) {
    if (template.operadora_4g === selection.operadora4g) {
      score += 3;
    } else if (options.allowOperadoraFallback) {
      score += 1;
      warnings.push("Operadora 4G exata nao encontrada. Foi usado um template relacionado do mesmo modelo.");
    } else {
      return null;
    }
  }

  if (template.switch_topology !== ROUTER_SCRIPT_TEMPLATE_ANY) {
    if (template.switch_topology === selection.switchTopology) {
      score += 2;
    } else if (options.allowSwitchTopologyFallback) {
      score += 1;
      warnings.push("Topologia de switch exata nao encontrada. Foi usado um template relacionado do mesmo modelo.");
    } else {
      return null;
    }
  }

  return { score, warnings };
};

const pickBestTemplate = (
  templates: RouterScriptCustomTemplateRow[],
  selection: RouterScriptTemplateSelection,
  variant: RouterScriptVariant,
  options: TemplateMatchOptions = {},
) => {
  const normalizedVariant = normalizeRouterScriptVariantValue(variant);
  const ranked = templates
    .filter((template) => template.is_active && normalizeRouterScriptVariantValue(template.script_variant) === normalizedVariant)
    .map((template) => ({
      template,
      match: scoreTemplateSpecificity(template, selection, options),
    }))
    .filter((entry): entry is { template: RouterScriptCustomTemplateRow; match: TemplateMatchScore } => Boolean(entry.match))
    .sort((left, right) => {
      if (right.match.score !== left.match.score) return right.match.score - left.match.score;
      return compareIsoDateDesc(left.template.updated_at, right.template.updated_at);
    });

  return ranked[0] ?? null;
};

export const resolveCustomRouterScriptTemplate = (
  templates: RouterScriptCustomTemplateRow[],
  selection: RouterScriptTemplateSelection,
): RouterScriptTemplateMatch | null => {
  const normalizedSelection: RouterScriptTemplateSelection = {
    ...selection,
    scriptVariant: normalizeRouterScriptVariantValue(selection.scriptVariant),
  };
  const strategies: TemplateMatchOptions[] = [{}];
  if (normalizedSelection.routerRole === "backup") {
    strategies.push(
      { allowCompatibleModel: true },
      { allowCompatibleModel: true, allowTechnologyFallback: true },
      { allowCompatibleModel: true, allowTechnologyFallback: true, allowOwnerFallback: true },
      {
        allowCompatibleModel: true,
        allowTechnologyFallback: true,
        allowOwnerFallback: true,
        allowOperadoraFallback: true,
      },
      {
        allowCompatibleModel: true,
        allowTechnologyFallback: true,
        allowOwnerFallback: true,
        allowOperadoraFallback: true,
        allowSwitchTopologyFallback: true,
      },
    );
  } else {
    strategies.push({ allowCompatibleModel: true });
  }

  for (const options of strategies) {
    const exactVariant = pickBestTemplate(templates, normalizedSelection, normalizedSelection.scriptVariant, options);
    if (exactVariant) {
      return {
        template: exactVariant.template,
        baseVariant: normalizedSelection.scriptVariant,
        warnings: Array.from(new Set(exactVariant.match.warnings)),
      };
    }
  }

  if (normalizedSelection.scriptVariant === COMPLETE_ROUTER_SCRIPT_VARIANT) return null;
  if (!isExtractableRouterScriptVariant(normalizedSelection.scriptVariant)) return null;

  for (const options of strategies) {
    const fullVariant = pickBestTemplate(templates, normalizedSelection, COMPLETE_ROUTER_SCRIPT_VARIANT, options);
    if (fullVariant) {
      return {
        template: fullVariant.template,
        baseVariant: COMPLETE_ROUTER_SCRIPT_VARIANT,
        warnings: Array.from(new Set(fullVariant.match.warnings)),
      };
    }
  }

  return null;
};

const buildPlaceholderMap = (context: RouterScriptPlaceholderContext) => ({
  COD_UL: context.codUl,
  HOSTNAME: context.hostname,
  SYSNAME: context.sysname,
  NOME_LOTERICA: context.nomeLoterica,
  CIDADE: context.cidade,
  UF: context.uf,
  CONTATO: context.contato,
  CCTO_OI: context.cctoOi,
  CCTO_OEMP: context.cctoOemp,
  DESIGNACAO_NOVA: context.designacaoNova,
  ROUTER_ROLE: context.routerRole,
  ROUTER_MODEL: context.routerModel,
  TECHNOLOGY: context.technology,
  OWNER: context.owner,
  SWITCH_TOPOLOGY: context.switchTopology,
  OPERADORA_4G: context.operadora4g,
  LOOPBACK_PRINCIPAL: context.primaryLoopback,
  TUNNEL_PRINCIPAL: context.primaryTunnelIp,
  LOOPBACK_SECUNDARIO: context.loopbackSecundario,
  LAN_NETWORK: context.lanNetwork,
  LAN_ROUTER: context.lanRouter,
  LAN_VIRTUAL: context.lanVirtual,
  LAN_ACL_HOST: context.lanAclHost,
  LAN_MASK: context.lanMask,
  LAN_PREFIX: context.lanPrefix,
  SWITCH_IP: context.switchIp,
  SWITCH_NETWORK: context.switchNetwork,
  SWITCH_VIRTUAL: context.switchVirtual,
  SWITCH_MASK: context.switchMask,
  SWITCH_PREFIX: context.switchPrefix,
});

export const applyCustomTemplatePlaceholders = (template: string, context: RouterScriptPlaceholderContext) => {
  const placeholderMap = buildPlaceholderMap(context);

  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi, (_match, rawToken: string) => {
    const key = String(rawToken || "").toUpperCase();
    return placeholderMap[key as keyof typeof placeholderMap] ?? "";
  });
};
