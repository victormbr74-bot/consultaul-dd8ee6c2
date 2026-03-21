import type { RouterScriptVariant } from "@/lib/routerScript";

export type RouterRole = "principal" | "backup";
export type RouterModel = "cisco1900" | "huawei" | "hp20-11" | "hp1002-4" | "hpmsr900" | "hpmsr931" | "hpmsr920";
export type LinkTechnology = "fibra" | "4g" | "vsat";
export type OwnerType = "oi" | "sencinet";
export type SwitchTopology = "com-switch" | "sem-switch";
export type Operadora4g = "vivo" | "tim" | "arqia" | "nao-se-aplica";
export type TemplateScopeValue<T extends string> = T | "any";

export interface RouterScriptCustomTemplateRow {
  id: string;
  name: string;
  router_role: RouterRole;
  model: TemplateScopeValue<RouterModel>;
  technology: TemplateScopeValue<LinkTechnology>;
  owner: TemplateScopeValue<OwnerType>;
  switch_topology: TemplateScopeValue<SwitchTopology>;
  script_variant: RouterScriptVariant;
  content: string;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface RouterScriptTemplateSelection {
  routerRole: RouterRole;
  model: RouterModel;
  technology: LinkTechnology;
  owner: OwnerType;
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

const matchScope = <T extends string>(templateValue: TemplateScopeValue<T>, selectedValue: T) =>
  templateValue === ROUTER_SCRIPT_TEMPLATE_ANY || templateValue === selectedValue;

const compareIsoDateDesc = (left: string | null, right: string | null) => {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
};

const scoreTemplateSpecificity = (template: RouterScriptCustomTemplateRow, selection: RouterScriptTemplateSelection) => {
  let score = 0;

  if (template.router_role !== selection.routerRole) return -1;
  if (!matchScope(template.model, selection.model)) return -1;
  if (!matchScope(template.technology, selection.technology)) return -1;
  if (!matchScope(template.owner, selection.owner)) return -1;
  if (!matchScope(template.switch_topology, selection.switchTopology)) return -1;

  if (template.model !== ROUTER_SCRIPT_TEMPLATE_ANY) score += 16;
  if (template.technology !== ROUTER_SCRIPT_TEMPLATE_ANY) score += 8;
  if (template.owner !== ROUTER_SCRIPT_TEMPLATE_ANY) score += 4;
  if (template.switch_topology !== ROUTER_SCRIPT_TEMPLATE_ANY) score += 2;

  return score;
};

const pickBestTemplate = (
  templates: RouterScriptCustomTemplateRow[],
  selection: RouterScriptTemplateSelection,
  variant: RouterScriptVariant,
) => {
  const ranked = templates
    .filter((template) => template.is_active && template.script_variant === variant)
    .map((template) => ({
      template,
      score: scoreTemplateSpecificity(template, selection),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return compareIsoDateDesc(left.template.updated_at, right.template.updated_at);
    });

  return ranked[0]?.template ?? null;
};

export const resolveCustomRouterScriptTemplate = (
  templates: RouterScriptCustomTemplateRow[],
  selection: RouterScriptTemplateSelection,
): RouterScriptTemplateMatch | null => {
  const exactVariant = pickBestTemplate(templates, selection, selection.scriptVariant);
  if (exactVariant) {
    return { template: exactVariant, baseVariant: selection.scriptVariant };
  }

  if (selection.scriptVariant === "completo") return null;

  const fullVariant = pickBestTemplate(templates, selection, "completo");
  if (!fullVariant) return null;

  return { template: fullVariant, baseVariant: "completo" };
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
