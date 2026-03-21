import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, Copy, Download, FileCode2, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildCodUlExactCandidates, buildCodUlSearchVariants, normalizeCodUlTerm } from "@/lib/lotericaCodUl";
import { extractRouterScriptVariant, ROUTER_SCRIPT_VARIANT_LABELS, type RouterScriptVariant } from "@/lib/routerScript";
import {
  ROUTER_SCRIPT_PLACEHOLDER_HINTS,
  ROUTER_SCRIPT_TEMPLATE_ANY,
  ROUTER_MODEL_LABELS,
  applyCustomTemplatePlaceholders,
  normalizeRouterModelValue,
  resolveCustomRouterScriptTemplate,
  type LinkTechnology,
  type Operadora4g,
  type OwnerType,
  type RouterRole,
  type RouterModel,
  type RouterScriptCustomTemplateRow,
  type RouterScriptPlaceholderContext,
  type SwitchTopology,
  type TemplateScopeValue,
} from "@/lib/routerScriptCustomTemplate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getRedeLanValue,
  getPrimaryLoopbackValue,
  getSecondaryLoopbackValue,
  normalizeText,
  type LotericaLookupRow,
} from "@/components/loterica/lotericaLookup";

type TemplateId =
  | "cisco1900-principal-sencinet"
  | "cisco1900-principal-oi"
  | "huawei-4g"
  | "hp20-11-oi-4g"
  | "hpmsr920-4g"
  | "hpmsr900-vsat-s-sw"
  | "hp1002-4-vsat";

interface ScriptRouterSctTabProps {
  initialCodUl?: string;
}

interface LanContext {
  network: string;
  router: string;
  virtual: string;
  aclHost: string;
  mask: string;
  prefix: number;
}

interface SwitchContext {
  ip: string;
  network: string;
  virtual: string;
  mask: string;
  prefix: number;
}

interface ScriptContext {
  codUl: string;
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

interface TemplateChoice {
  templateId: TemplateId;
  warnings: string[];
}

interface CustomTemplateFormState {
  id: string | null;
  name: string;
  routerRole: RouterRole;
  model: TemplateScopeValue<RouterModel>;
  technology: TemplateScopeValue<LinkTechnology>;
  owner: TemplateScopeValue<OwnerType>;
  switchTopology: TemplateScopeValue<SwitchTopology>;
  scriptVariant: RouterScriptVariant;
  content: string;
  notes: string;
  isActive: boolean;
}

const LOOKUP_SELECT =
  "cod_ul,nome_loterica,ccto_oi,ccto_oemp,designacao_nova,operadora,ip_nat,ip_wan,loopback_wan,loopback_lan,endereco,contato,cidade,uf,status,updated_at,raw_data";

const TEMPLATE_META: Record<TemplateId, { label: string; filePath: string }> = {
  "cisco1900-principal-sencinet": {
    label: "Cisco 1900 Principal Sencinet",
    filePath: "/router-sct-templates/cisco1900-principal-sencinet.txt",
  },
  "cisco1900-principal-oi": {
    label: "Cisco 1900 Principal OI",
    filePath: "/router-sct-templates/cisco1900-principal-oi.txt",
  },
  "huawei-4g": {
    label: "Huawei 4G",
    filePath: "/router-sct-templates/huawei-4g.txt",
  },
  "hp20-11-oi-4g": {
    label: "HP20-11 4G OI",
    filePath: "/router-sct-templates/hp20-11-oi-4g.txt",
  },
  "hpmsr920-4g": {
    label: "HPMSR920 4G",
    filePath: "/router-sct-templates/hpmsr920-4g.txt",
  },
  "hpmsr900-vsat-s-sw": {
    label: "HPMSR900 VSAT S-SW",
    filePath: "/router-sct-templates/hpmsr900-vsat-s-sw.txt",
  },
  "hp1002-4-vsat": {
    label: "HP 1002-4 VSAT",
    filePath: "/router-sct-templates/hp1002-4-vsat.txt",
  },
};

const templateCache = new Map<TemplateId, string>();

const MODEL_OPTIONS: Array<{ value: RouterModel; label: string }> = [
  { value: "cisco1900", label: ROUTER_MODEL_LABELS.cisco1900 },
  { value: "huawei", label: ROUTER_MODEL_LABELS.huawei },
  { value: "hp20-11", label: ROUTER_MODEL_LABELS["hp20-11"] },
  { value: "hp1002-4", label: ROUTER_MODEL_LABELS["hp1002-4"] },
  { value: "hpmsr900", label: ROUTER_MODEL_LABELS.hpmsr900 },
  { value: "hpmsr931", label: ROUTER_MODEL_LABELS.hpmsr931 },
  { value: "hpmsr920", label: ROUTER_MODEL_LABELS.hpmsr920 },
];

const ROUTER_ROLE_OPTIONS: Array<{ value: RouterRole; label: string }> = [
  { value: "principal", label: "Principal / PRI" },
  { value: "backup", label: "Backup" },
];

const OWNER_OPTIONS: Array<{ value: OwnerType; label: string }> = [
  { value: "sencinet", label: "Sencinet" },
  { value: "oi", label: "OI" },
];

const TECH_OPTIONS: Array<{ value: LinkTechnology; label: string }> = [
  { value: "fibra", label: "Fibra" },
  { value: "4g", label: "4G" },
  { value: "vsat", label: "VSAT" },
];

const SWITCH_OPTIONS: Array<{ value: SwitchTopology; label: string }> = [
  { value: "com-switch", label: "Com Switch" },
  { value: "sem-switch", label: "Sem Switch" },
];

const OPERADORA_4G_OPTIONS: Array<{ value: Operadora4g; label: string }> = [
  { value: "vivo", label: "Vivo" },
  { value: "tim", label: "TIM" },
  { value: "arqia", label: "Arqia" },
  { value: "nao-se-aplica", label: "Nao se aplica" },
];
const SCRIPT_VARIANT_OPTIONS: Array<{ value: RouterScriptVariant; label: string }> = [
  { value: "completo", label: "Completo" },
  { value: "bgp", label: "Parcial BGP" },
  { value: "nqa", label: "Parcial NQA" },
];
const TEMPLATE_FORM_MODEL_OPTIONS: Array<{ value: TemplateScopeValue<RouterModel>; label: string }> = [
  { value: ROUTER_SCRIPT_TEMPLATE_ANY, label: "Qualquer" },
  ...MODEL_OPTIONS,
];
const TEMPLATE_FORM_TECH_OPTIONS: Array<{ value: TemplateScopeValue<LinkTechnology>; label: string }> = [
  { value: ROUTER_SCRIPT_TEMPLATE_ANY, label: "Qualquer" },
  ...TECH_OPTIONS,
];
const TEMPLATE_FORM_OWNER_OPTIONS: Array<{ value: TemplateScopeValue<OwnerType>; label: string }> = [
  { value: ROUTER_SCRIPT_TEMPLATE_ANY, label: "Qualquer" },
  ...OWNER_OPTIONS,
];
const TEMPLATE_FORM_SWITCH_OPTIONS: Array<{ value: TemplateScopeValue<SwitchTopology>; label: string }> = [
  { value: ROUTER_SCRIPT_TEMPLATE_ANY, label: "Qualquer" },
  ...SWITCH_OPTIONS,
];
const TEMPLATE_FORM_STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
] as const;
const CUSTOM_TEMPLATE_ACCEPT = ".txt,.cfg,.conf,.log,text/plain";

const createEmptyCustomTemplateForm = (
  currentRole: RouterRole,
  currentModel: RouterModel,
  currentTechnology: LinkTechnology,
  currentOwner: OwnerType,
  currentSwitchTopology: SwitchTopology,
  currentVariant: RouterScriptVariant,
): CustomTemplateFormState => ({
  id: null,
  name: "",
  routerRole: currentRole,
  model: currentModel,
  technology: currentTechnology,
  owner: currentOwner,
  switchTopology: currentSwitchTopology,
  scriptVariant: currentVariant,
  content: "",
  notes: "",
  isActive: true,
});

const toUpperNoAccent = (value: unknown) => {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceToken = (text: string, token: string, replacement: string) => {
  if (!token || !replacement || token === replacement) return text;
  return text.replace(new RegExp(escapeRegExp(token), "g"), replacement);
};

const readTextFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler o arquivo do modelo."));
    reader.readAsText(file);
  });

const formatDateTimePtBr = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
};

const extractIpv4 = (value: unknown) => {
  const match = normalizeText(value).match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (!match) return "";
  const parts = match[1].split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return "";
  return parts.join(".");
};

const ipv4ToNumber = (ip: string) => {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const numberToIpv4 = (value: number) => {
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return "";
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
};

const maskToPrefix = (mask: string) => {
  const maskNumber = ipv4ToNumber(mask);
  if (maskNumber === null) return null;

  let seenZero = false;
  let prefix = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    const isOne = ((maskNumber >>> bit) & 1) === 1;
    if (isOne) {
      if (seenZero) return null;
      prefix += 1;
    } else {
      seenZero = true;
    }
  }
  return prefix;
};

const parsePrefixFromValue = (value: string, fallback: number) => {
  const slashMatch = value.match(/\/(\d{1,2})\b/);
  if (slashMatch) {
    const parsed = Number.parseInt(slashMatch[1], 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 32) return parsed;
  }

  const ipMatches = [...value.matchAll(/(\d{1,3}(?:\.\d{1,3}){3})/g)].map((item) => item[1]);
  if (ipMatches.length >= 2) {
    const maskPrefix = maskToPrefix(ipMatches[1]);
    if (maskPrefix !== null) return maskPrefix;
  }

  return fallback;
};

const prefixToMaskNumber = (prefix: number) => {
  const clamped = Math.max(0, Math.min(32, prefix));
  if (clamped === 0) return 0;
  return (0xffffffff << (32 - clamped)) >>> 0;
};

const getRawValueByAliases = (row: LotericaLookupRow, aliases: string[]) => {
  const raw = row.raw_data && typeof row.raw_data === "object" ? (row.raw_data as Record<string, unknown>) : {};
  if (!Object.keys(raw).length) return "";

  const exactMap = new Map<string, string>();
  const looseMap = new Map<string, string>();

  for (const [key, value] of Object.entries(raw)) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) continue;

    const exact = key.trim().toUpperCase();
    const loose = toUpperNoAccent(key).replace(/[^A-Z0-9]/g, "");
    if (exact && !exactMap.has(exact)) exactMap.set(exact, normalizedValue);
    if (loose && !looseMap.has(loose)) looseMap.set(loose, normalizedValue);
  }

  for (const alias of aliases) {
    const exactAlias = alias.trim().toUpperCase();
    const looseAlias = toUpperNoAccent(alias).replace(/[^A-Z0-9]/g, "");

    const exactHit = exactMap.get(exactAlias);
    if (exactHit) return exactHit;

    const looseHit = looseMap.get(looseAlias);
    if (looseHit) return looseHit;
  }

  return "";
};

const deriveLanContext = (redeLanValue: string): LanContext | null => {
  const ip = extractIpv4(redeLanValue);
  if (!ip) return null;

  const ipNumber = ipv4ToNumber(ip);
  if (ipNumber === null) return null;

  const prefix = parsePrefixFromValue(redeLanValue, 28);
  const networkNumber = (ipNumber & prefixToMaskNumber(prefix)) >>> 0;
  const network = numberToIpv4(networkNumber);
  if (!network) return null;
  const mask = numberToIpv4(prefixToMaskNumber(prefix));
  if (!mask) return null;

  const isNetworkInput = ipNumber === networkNumber;
  const router = numberToIpv4(isNetworkInput ? (networkNumber + 3) >>> 0 : ipNumber);
  const virtual = numberToIpv4((networkNumber + 1) >>> 0);
  const aclHost = numberToIpv4((networkNumber + 2) >>> 0);

  if (!router || !virtual || !aclHost) return null;

  return { network, router, virtual, aclHost, mask, prefix };
};

const deriveSwitchContext = (switchValue: string): SwitchContext | null => {
  const ip = extractIpv4(switchValue);
  if (!ip) return null;

  const ipNumber = ipv4ToNumber(ip);
  if (ipNumber === null) return null;

  const prefix = parsePrefixFromValue(switchValue, 29);
  const networkNumber = (ipNumber & prefixToMaskNumber(prefix)) >>> 0;
  const network = numberToIpv4(networkNumber);
  const virtual = numberToIpv4((networkNumber + 1) >>> 0);
  const mask = numberToIpv4(prefixToMaskNumber(prefix));
  if (!network || !virtual || !mask) return null;

  return { ip, network, virtual, mask, prefix };
};

const deriveTunnelIpFromPrimaryLoopback = (loopback: string) => {
  const parts = loopback.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return "";
  if (parts[0] !== "10") return "";
  return ["15", parts[1], parts[2], parts[3]].join(".");
};

const detectModel = (row: LotericaLookupRow): RouterModel => {
  return normalizeRouterModelValue(getRawValueByAliases(row, ["MODELO ROTEADOR"]));
};

const detectBackupModel = (row: LotericaLookupRow): Exclude<RouterModel, "cisco1900"> => {
  const detected = detectModel(row);
  return detected === "cisco1900" ? "hpmsr900" : detected;
};

const detectOwner = (row: LotericaLookupRow): OwnerType => {
  const source = toUpperNoAccent(getRawValueByAliases(row, ["OWNER"]));
  if (source.includes("OI")) return "oi";
  if (source.includes("SENCINET")) return "sencinet";
  return "sencinet";
};

const BACKUP_SIGNAL_KEYWORDS = ["VSAT", "4G", "SIM CARD", "VIVO", "TIM", "ARQIA", "CLARO", "BRISANET"] as const;

const buildRouterSignal = (row: LotericaLookupRow) => {
  const rawValues =
    row.raw_data && typeof row.raw_data === "object"
      ? Object.values(row.raw_data as Record<string, unknown>).map((value) => normalizeText(value))
      : [];

  return toUpperNoAccent([
    getRawValueByAliases(row, ["TECNOLOGIA"]),
    getRawValueByAliases(row, ["VSAT"]),
    getRawValueByAliases(row, ["SIM CARD 4G"]),
    getRawValueByAliases(row, ["OPERADORA 4G", "OPERADORA"]),
    row.operadora || "",
    ...rawValues,
  ].join(" | "));
};

const hasPriMarker = (row: LotericaLookupRow) => /\bPRI\b/.test(buildRouterSignal(row));

const detectRouterRole = (row: LotericaLookupRow): RouterRole => {
  const signal = buildRouterSignal(row);

  if (hasPriMarker(row)) return "principal";
  if (BACKUP_SIGNAL_KEYWORDS.some((keyword) => signal.includes(keyword))) return "backup";
  return "principal";
};

const detectTechnology = (row: LotericaLookupRow, routerRole: RouterRole = detectRouterRole(row)): LinkTechnology => {
  const signal = buildRouterSignal(row);

  if (signal.includes("VSAT")) return "vsat";
  if (
    signal.includes("4G") ||
    signal.includes("TIM") ||
    signal.includes("VIVO") ||
    signal.includes("ARQIA") ||
    signal.includes("CLARO")
  ) {
    return "4g";
  }

  if (routerRole === "principal") return "fibra";

  const model = detectModel(row);
  if (model === "huawei" || model === "hp20-11" || model === "hpmsr920") return "4g";
  return "vsat";
};

const detectOperadora4g = (row: LotericaLookupRow): Operadora4g => {
  const signal = toUpperNoAccent([
    getRawValueByAliases(row, ["OPERADORA 4G"]),
    row.operadora || "",
    getRawValueByAliases(row, ["SIM CARD 4G"]),
  ].join(" | "));

  if (signal.includes("TIM")) return "tim";
  if (signal.includes("VIVO")) return "vivo";
  if (signal.includes("ARQIA")) return "arqia";
  return "nao-se-aplica";
};

const detectSwitchTopology = (row: LotericaLookupRow): SwitchTopology => {
  const switchValue = getRawValueByAliases(row, ["IP SWITCH", "LOOPBACK SWITCH"]);
  return extractIpv4(switchValue) ? "com-switch" : "sem-switch";
};

const chooseTemplate = (
  routerRole: RouterRole,
  model: RouterModel,
  technology: LinkTechnology,
  owner: OwnerType,
  switchTopology: SwitchTopology,
): TemplateChoice => {
  const warnings: string[] = [];
  let templateId: TemplateId;

  if (routerRole === "principal") {
    templateId = owner === "oi" ? "cisco1900-principal-oi" : "cisco1900-principal-sencinet";
    return { templateId, warnings };
  }

  if (model === "huawei") {
    templateId = "huawei-4g";
    if (technology !== "4g") {
      warnings.push("Nao existe template Huawei VSAT nos anexos. Foi usado Huawei 4G.");
    }
  } else if (model === "hp20-11") {
    templateId = "hp20-11-oi-4g";
    if (technology !== "4g") {
      warnings.push("Nao existe template HP20-11 VSAT nos anexos. Foi usado HP20-11 4G.");
    }
    if (owner !== "oi") {
      warnings.push("O template HP20-11 disponivel nos anexos e o de loterica OWNER=OI.");
    }
  } else if (model === "hpmsr920") {
    templateId = "hpmsr920-4g";
    if (technology !== "4g") {
      warnings.push("Nao existe template HPMSR920 VSAT nos anexos. Foi usado HPMSR920 4G.");
    }
  } else if (model === "hpmsr900") {
    templateId = "hpmsr900-vsat-s-sw";
    if (technology !== "vsat") {
      warnings.push("Nao existe template HPMSR900 4G nos anexos. Foi usado HPMSR900 VSAT.");
    }
  } else if (model === "hp1002-4") {
    templateId = "hp1002-4-vsat";
    if (technology !== "vsat") {
      warnings.push("Nao existe template HP 1002-4 4G nos anexos. Foi usado HP 1002-4 VSAT.");
    }
  } else if (technology === "4g") {
    templateId = "hpmsr920-4g";
    warnings.push("Nao existe template dedicado para HPMSR931 4G nos anexos. Foi usado HPMSR920 4G.");
  } else {
    templateId = "hpmsr900-vsat-s-sw";
    warnings.push("Nao existe template dedicado para HPMSR931 VSAT nos anexos. Foi usado HPMSR900 VSAT.");
  }

  if (
    switchTopology === "com-switch" &&
    (templateId === "hp20-11-oi-4g" || templateId === "hpmsr900-vsat-s-sw" || templateId === "hp1002-4-vsat")
  ) {
    warnings.push("Os anexos para este modelo estao na variante S-SW. Revisar comandos de switch antes de aplicar.");
  }

  if (switchTopology === "sem-switch" && (templateId === "huawei-4g" || templateId === "hpmsr920-4g")) {
    warnings.push("Template base contem blocos de switch. Revisar e remover comandos de switch se necessario.");
  }

  if (owner === "oi" && templateId !== "hp20-11-oi-4g") {
    warnings.push("Nao ha template separado por OWNER=OI nos anexos. Foi usado o template base do modelo.");
  }

  return { templateId, warnings };
};

const loadTemplate = async (templateId: TemplateId) => {
  const cached = templateCache.get(templateId);
  if (cached) return cached;

  const response = await fetch(TEMPLATE_META[templateId].filePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar o template ${TEMPLATE_META[templateId].label}.`);
  }

  const text = await response.text();
  templateCache.set(templateId, text);
  return text;
};

const buildCodUlLookupFilter = (value: string) => {
  return buildCodUlSearchVariants(value)
    .map((candidate) => `cod_ul.ilike.%${candidate}%`)
    .join(",");
};

const normalizeCustomTemplateRow = (value: Record<string, unknown>): RouterScriptCustomTemplateRow => ({
  id: normalizeText(value.id),
  name: normalizeText(value.name),
  router_role: normalizeText(value.router_role) as RouterRole,
  model:
    normalizeText(value.model) === ROUTER_SCRIPT_TEMPLATE_ANY
      ? ROUTER_SCRIPT_TEMPLATE_ANY
      : normalizeRouterModelValue(value.model),
  technology: normalizeText(value.technology) as TemplateScopeValue<LinkTechnology>,
  owner: normalizeText(value.owner) as TemplateScopeValue<OwnerType>,
  switch_topology: normalizeText(value.switch_topology) as TemplateScopeValue<SwitchTopology>,
  script_variant: normalizeText(value.script_variant) as RouterScriptVariant,
  content: String(value.content ?? ""),
  notes: normalizeText(value.notes) || null,
  is_active: Boolean(value.is_active ?? true),
  created_at: normalizeText(value.created_at) || null,
  updated_at: normalizeText(value.updated_at) || null,
  updated_by: normalizeText(value.updated_by) || null,
});

const applyCustomRouterTemplate = (template: string, context: ScriptContext) => {
  const placeholderContext: RouterScriptPlaceholderContext = {
    codUl: context.codUl,
    hostname: `${context.codUl}_RT01`,
    sysname: `${context.codUl}_RT02`,
    nomeLoterica: context.nomeLoterica,
    cidade: context.cidade,
    uf: context.uf,
    contato: context.contato,
    cctoOi: context.cctoOi,
    cctoOemp: context.cctoOemp,
    designacaoNova: context.designacaoNova,
    routerRole: context.routerRole,
    routerModel: context.routerModel,
    technology: context.technology,
    owner: context.owner,
    switchTopology: context.switchTopology,
    operadora4g: context.operadora4g,
    primaryLoopback: context.primaryLoopback,
    primaryTunnelIp: context.primaryTunnelIp,
    loopbackSecundario: context.loopbackSecundario,
    lanNetwork: context.lanNetwork,
    lanRouter: context.lanRouter,
    lanVirtual: context.lanVirtual,
    lanAclHost: context.lanAclHost,
    lanMask: context.lanMask,
    lanPrefix: context.lanPrefix,
    switchIp: context.switchIp,
    switchNetwork: context.switchNetwork,
    switchVirtual: context.switchVirtual,
    switchMask: context.switchMask,
    switchPrefix: context.switchPrefix,
  };

  return applyCustomTemplatePlaceholders(template, placeholderContext);
};

const applyTemplateReplacements = (templateId: TemplateId, template: string, context: ScriptContext) => {
  let output = template.replace(/\(mudar\)\s*/gi, "");

  const sysname = `${context.codUl}_RT02`;
  const hostname = `${context.codUl}_RT01`;
  const sysnameMatch = output.match(/^\s*sysname\s+([^\r\n]+)/m);
  if (sysnameMatch?.[1]) {
    output = replaceToken(output, normalizeText(sysnameMatch[1]), sysname);
    output = output.replace(/^(\s*sysname\s+)[^\r\n]+/m, `$1${sysname}`);
  }

  const hostnameMatch = output.match(/^\s*hostname\s+([^\r\n]+)/m);
  if (hostnameMatch?.[1]) {
    output = replaceToken(output, normalizeText(hostnameMatch[1]), hostname);
    output = output.replace(/^(\s*hostname\s+)[^\r\n]+/m, `$1${hostname}`);
  }

  if (templateId === "cisco1900-principal-sencinet" || templateId === "cisco1900-principal-oi") {
    output = replaceToken(
      output,
      templateId === "cisco1900-principal-sencinet" ? "10.50.181.203" : "10.50.181.24",
      context.primaryLoopback,
    );
    output = replaceToken(
      output,
      templateId === "cisco1900-principal-sencinet" ? "15.50.181.203" : "15.50.181.24",
      context.primaryTunnelIp,
    );
    output = replaceToken(
      output,
      templateId === "cisco1900-principal-sencinet" ? "99.244.92.241" : "99.245.60.129",
      context.lanRouter,
    );
    output = replaceToken(
      output,
      templateId === "cisco1900-principal-sencinet" ? "99.244.92.240" : "99.245.60.128",
      context.lanNetwork,
    );

    if (context.switchIp) {
      output = replaceToken(
        output,
        templateId === "cisco1900-principal-sencinet" ? "10.51.22.85" : "10.51.22.129",
        context.switchIp,
      );
    }
    if (context.switchNetwork) {
      output = replaceToken(
        output,
        templateId === "cisco1900-principal-sencinet" ? "10.51.22.84" : "10.51.22.128",
        context.switchNetwork,
      );
    }
  }

  if (templateId === "huawei-4g") {
    output = replaceToken(output, "10.50.129.59", context.loopbackSecundario);
    output = replaceToken(output, "99.246.245.67", context.lanRouter);
    output = replaceToken(output, "99.246.245.64", context.lanNetwork);

    if (context.switchIp) output = replaceToken(output, "10.51.76.76", context.switchIp);
    if (context.switchNetwork) output = replaceToken(output, "10.51.76.72", context.switchNetwork);
    if (context.switchVirtual) output = replaceToken(output, "10.51.76.73", context.switchVirtual);
  }

  if (templateId === "hp20-11-oi-4g") {
    output = replaceToken(output, "10.51.56.85", context.loopbackSecundario);
    output = replaceToken(output, "10.51.50.98", context.loopbackSecundario);
    output = replaceToken(output, "99.246.25.17", context.lanVirtual);
  }

  if (templateId === "hpmsr900-vsat-s-sw" || templateId === "hp1002-4-vsat") {
    output = replaceToken(output, "10.50.255.254", context.loopbackSecundario);
    output = replaceToken(output, "99.244.33.161", context.lanRouter);
    output = replaceToken(output, "99.244.33.160", context.lanNetwork);
  }

  if (templateId === "hpmsr920-4g") {
    output = replaceToken(output, "10.50.132.23", context.loopbackSecundario);
    output = replaceToken(output, "99.247.1.147", context.lanRouter);
    output = replaceToken(output, "99.247.1.146", context.lanAclHost);
    output = replaceToken(output, "99.247.1.145", context.lanVirtual);

    if (context.switchIp) {
      output = replaceToken(output, "10.52.132.19", context.switchIp);
    }
  }

  return output;
};

const ScriptRouterSctTab = ({ initialCodUl = "" }: ScriptRouterSctTabProps) => {
  const { isAdmin, user } = useAuth();
  const [codUlInput, setCodUlInput] = useState("");
  const [routerRole, setRouterRole] = useState<RouterRole>("backup");
  const [model, setModel] = useState<RouterModel>("hpmsr900");
  const [owner, setOwner] = useState<OwnerType>("sencinet");
  const [technology, setTechnology] = useState<LinkTechnology>("vsat");
  const [switchTopology, setSwitchTopology] = useState<SwitchTopology>("sem-switch");
  const [operadora4g, setOperadora4g] = useState<Operadora4g>("nao-se-aplica");
  const [scriptVariant, setScriptVariant] = useState<RouterScriptVariant>("completo");

  const [loterica, setLoterica] = useState<LotericaLookupRow | null>(null);
  const [fullScript, setFullScript] = useState("");
  const [generatedBaseVariant, setGeneratedBaseVariant] = useState<RouterScriptVariant>("completo");
  const [templateLabel, setTemplateLabel] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<RouterScriptCustomTemplateRow[]>([]);
  const [customTemplatesLoading, setCustomTemplatesLoading] = useState(false);
  const [customTemplatesError, setCustomTemplatesError] = useState("");
  const [customTemplateSaving, setCustomTemplateSaving] = useState(false);
  const [customTemplateNotice, setCustomTemplateNotice] = useState("");
  const [customTemplateForm, setCustomTemplateForm] = useState<CustomTemplateFormState>(() =>
    createEmptyCustomTemplateForm("backup", "hpmsr900", "vsat", "sencinet", "sem-switch", "completo"),
  );

  const initRef = useRef(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const resetCustomTemplateForm = useCallback(() => {
    setCustomTemplateForm(createEmptyCustomTemplateForm(routerRole, model, technology, owner, switchTopology, scriptVariant));
    setCustomTemplateNotice("");
  }, [model, owner, routerRole, scriptVariant, switchTopology, technology]);

  const fetchCustomTemplates = useCallback(async () => {
    if (!isAdmin) {
      setCustomTemplates([]);
      setCustomTemplatesError("");
      return;
    }

    setCustomTemplatesLoading(true);
    setCustomTemplatesError("");

    try {
      const { data, error: queryError } = await (supabase as any)
        .from("router_script_templates")
        .select("*")
        .order("updated_at", { ascending: false });

      if (queryError) {
        const message = String(queryError.message || "");
        if (message.includes("router_script_templates") && message.includes("Could not find the table")) {
          setCustomTemplates([]);
          setCustomTemplatesError(
            "Banco desatualizado: falta a tabela router_script_templates.\n" +
              "Aplique a migracao Supabase '20260306140000_router_script_templates.sql'.",
          );
          return;
        }

        throw new Error(message || "Falha ao carregar modelos customizados.");
      }

      const rows = Array.isArray(data) ? data.map((row) => normalizeCustomTemplateRow(row as Record<string, unknown>)) : [];
      setCustomTemplates(rows);
    } catch (loadError) {
      console.error("Falha ao carregar modelos customizados do Script Router", loadError);
      setCustomTemplates([]);
      setCustomTemplatesError(String((loadError as Error)?.message || loadError || "Falha ao carregar modelos customizados."));
    } finally {
      setCustomTemplatesLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchCustomTemplates();
  }, [fetchCustomTemplates]);

  const handleTemplateFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await readTextFile(file);
      setCustomTemplateForm((current) => ({
        ...current,
        name: current.name || file.name.replace(/\.[^.]+$/u, ""),
        content: text,
      }));
      setCustomTemplateNotice(`Arquivo '${file.name}' carregado no editor.`);
    } catch (fileError) {
      console.error("Falha ao ler modelo customizado", fileError);
      setCustomTemplatesError(String((fileError as Error)?.message || fileError || "Falha ao ler o arquivo."));
    } finally {
      event.target.value = "";
    }
  }, []);

  const handleEditCustomTemplate = useCallback((template: RouterScriptCustomTemplateRow) => {
    setCustomTemplateForm({
      id: template.id,
      name: template.name,
      routerRole: template.router_role,
      model: template.model,
      technology: template.technology,
      owner: template.owner,
      switchTopology: template.switch_topology,
      scriptVariant: template.script_variant,
      content: template.content,
      notes: template.notes || "",
      isActive: template.is_active,
    });
    setCustomTemplateNotice(`Editando o modelo '${template.name}'.`);
  }, []);

  const handleDeleteCustomTemplate = useCallback(async (template: RouterScriptCustomTemplateRow) => {
    if (!isAdmin) return;
    if (!window.confirm(`Excluir o modelo '${template.name}'?`)) return;

    setCustomTemplateSaving(true);
    setCustomTemplateNotice("");
    setCustomTemplatesError("");

    try {
      const { error: deleteError } = await (supabase as any)
        .from("router_script_templates")
        .delete()
        .eq("id", template.id);

      if (deleteError) {
        throw new Error(deleteError.message || "Falha ao excluir o modelo.");
      }

      if (customTemplateForm.id === template.id) {
        resetCustomTemplateForm();
      }

      setCustomTemplateNotice(`Modelo '${template.name}' excluido.`);
      await fetchCustomTemplates();
    } catch (deleteError) {
      console.error("Falha ao excluir modelo customizado", deleteError);
      setCustomTemplatesError(String((deleteError as Error)?.message || deleteError || "Falha ao excluir o modelo."));
    } finally {
      setCustomTemplateSaving(false);
    }
  }, [customTemplateForm.id, fetchCustomTemplates, isAdmin, resetCustomTemplateForm]);

  const handleSaveCustomTemplate = useCallback(async () => {
    if (!isAdmin) return;

    const name = normalizeText(customTemplateForm.name);
    const content = customTemplateForm.content.trim();
    if (!name) {
      setCustomTemplatesError("Informe um nome para o modelo.");
      return;
    }
    if (!content) {
      setCustomTemplatesError("Cole o conteudo do modelo ou carregue um arquivo TXT.");
      return;
    }

    setCustomTemplateSaving(true);
    setCustomTemplateNotice("");
    setCustomTemplatesError("");

    try {
      let successMessage = "";
      const payload = {
        name,
        router_role: customTemplateForm.routerRole,
        model: customTemplateForm.model,
        technology: customTemplateForm.technology,
        owner: customTemplateForm.owner,
        switch_topology: customTemplateForm.switchTopology,
        script_variant: customTemplateForm.scriptVariant,
        content,
        notes: normalizeText(customTemplateForm.notes) || null,
        is_active: customTemplateForm.isActive,
        updated_by: user?.id || null,
      };

      if (customTemplateForm.id) {
        const { error: updateError } = await (supabase as any)
          .from("router_script_templates")
          .update(payload)
          .eq("id", customTemplateForm.id);

        if (updateError) {
          throw new Error(updateError.message || "Falha ao atualizar o modelo.");
        }

        successMessage = `Modelo '${name}' atualizado.`;
      } else {
        const { error: insertError } = await (supabase as any)
          .from("router_script_templates")
          .insert({
            ...payload,
            created_by: user?.id || null,
          });

        if (insertError) {
          throw new Error(insertError.message || "Falha ao cadastrar o modelo.");
        }

        successMessage = `Modelo '${name}' cadastrado.`;
      }

      resetCustomTemplateForm();
      await fetchCustomTemplates();
      setCustomTemplateNotice(successMessage);
    } catch (saveError) {
      console.error("Falha ao salvar modelo customizado", saveError);
      setCustomTemplatesError(String((saveError as Error)?.message || saveError || "Falha ao salvar o modelo."));
    } finally {
      setCustomTemplateSaving(false);
    }
  }, [customTemplateForm, fetchCustomTemplates, isAdmin, resetCustomTemplateForm, user?.id]);

  const handleLookup = useCallback(async (forcedCode?: string) => {
    const lookupCode = normalizeCodUlTerm(forcedCode ?? codUlInput);
    if (!lookupCode) {
      setError("Informe o codigo UL para carregar os dados.");
      return null;
    }

    setLoadingLookup(true);
    setError("");

    try {
      const exactCandidates = buildCodUlExactCandidates(lookupCode);
      let selected: any = null;

      if (exactCandidates.length > 0) {
        const { data: exactRows, error: exactError } = await (supabase as any)
          .from("lotericas")
          .select(LOOKUP_SELECT)
          .in("cod_ul", exactCandidates)
          .order("cod_ul")
          .limit(1);

        if (exactError) {
          throw new Error(exactError.message || "Falha ao consultar a loterica.");
        }

        selected = exactRows?.[0] || null;
      }

      if (!selected) {
        const lookupFilter = buildCodUlLookupFilter(lookupCode);
        const { data: fallbackData, error: fallbackError } = await (supabase as any)
          .from("lotericas")
          .select(LOOKUP_SELECT)
          .or(lookupFilter)
          .order("cod_ul")
          .limit(1);

        if (fallbackError) {
          throw new Error(fallbackError.message || "Falha ao consultar a loterica.");
        }
        selected = fallbackData?.[0] || null;
      }

      if (!selected) {
        setLoterica(null);
        setFullScript("");
        setGeneratedBaseVariant("completo");
        setTemplateLabel("");
        setWarnings([]);
        setError(`Codigo UL '${lookupCode}' nao encontrado.`);
        return null;
      }

      const normalizedRow = {
        ...selected,
        raw_data:
          selected.raw_data && typeof selected.raw_data === "object"
            ? (selected.raw_data as Record<string, unknown>)
            : {},
      } as LotericaLookupRow;

      const detectedRole = detectRouterRole(normalizedRow);
      const detectedTechnology = detectTechnology(normalizedRow, detectedRole);

      setLoterica(normalizedRow);
      setCodUlInput(normalizeText(normalizedRow.cod_ul));
      setRouterRole(detectedRole);
      setOwner(detectOwner(normalizedRow));
      setSwitchTopology(detectSwitchTopology(normalizedRow));
      if (detectedRole === "principal") {
        setModel("cisco1900");
        setTechnology(detectedTechnology);
      } else {
        setModel(detectBackupModel(normalizedRow));
        setTechnology(detectedTechnology);
      }
      setOperadora4g(detectedTechnology === "4g" ? detectOperadora4g(normalizedRow) : "nao-se-aplica");

      return normalizedRow;
    } catch (lookupError) {
      console.error("Falha ao consultar loterica para Script Router SCT", lookupError);
      setLoterica(null);
      setFullScript("");
      setGeneratedBaseVariant("completo");
      setTemplateLabel("");
      setWarnings([]);
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao consultar loterica."));
      return null;
    } finally {
      setLoadingLookup(false);
    }
  }, [codUlInput]);

  useEffect(() => {
    if (routerRole === "principal") {
      setModel("cisco1900");
      if (!loterica) return;

      const detectedTechnology = detectTechnology(loterica, "principal");
      setTechnology(detectedTechnology);
      setOperadora4g(detectedTechnology === "4g" ? detectOperadora4g(loterica) : "nao-se-aplica");
      return;
    }

    if (!loterica) {
      setModel((current) => (current === "cisco1900" ? "hpmsr900" : current));
      setTechnology((current) => (current === "fibra" ? "vsat" : current));
      return;
    }

    const detectedTechnology = detectTechnology(loterica, "backup");
    setModel(detectBackupModel(loterica));
    setTechnology(detectedTechnology);
    setOperadora4g(detectedTechnology === "4g" ? detectOperadora4g(loterica) : "nao-se-aplica");
  }, [loterica, routerRole]);

  useEffect(() => {
    const initial = normalizeText(initialCodUl);
    if (!initial || initRef.current) return;
    initRef.current = true;
    setCodUlInput(initial);
    void handleLookup(initial);
  }, [initialCodUl, handleLookup]);

  const handleGenerate = useCallback(async () => {
    setError("");
    setCopied(false);

    const activeRow =
      loterica && normalizeText(loterica.cod_ul) === normalizeText(codUlInput)
        ? loterica
        : await handleLookup();

    if (!activeRow) return;

    const primaryLoopback = extractIpv4(getPrimaryLoopbackValue(activeRow));
    const loopbackSecundario = extractIpv4(getSecondaryLoopbackValue(activeRow));
    if (routerRole === "principal" && !primaryLoopback) {
      setFullScript("");
      setGeneratedBaseVariant("completo");
      setTemplateLabel("");
      setWarnings([]);
      setError("A UL nao possui loopback principal valido para gerar o script do roteador principal.");
      return;
    }

    if (routerRole === "backup" && !loopbackSecundario) {
      setFullScript("");
      setGeneratedBaseVariant("completo");
      setTemplateLabel("");
      setWarnings([]);
      setError("A UL nao possui loopback secundario valido para gerar o script.");
      return;
    }

    const redeLanRaw = getRedeLanValue(activeRow) || getRawValueByAliases(activeRow, ["REDE LAN", "REDE_LAN"]);
    const lanContext = deriveLanContext(redeLanRaw);
    if (!lanContext) {
      setFullScript("");
      setGeneratedBaseVariant("completo");
      setTemplateLabel("");
      setWarnings([]);
      setError("A UL nao possui REDE LAN valida para gerar o script completo.");
      return;
    }

    const switchRaw = getRawValueByAliases(activeRow, ["IP SWITCH", "LOOPBACK SWITCH"]);
    const switchContext = deriveSwitchContext(switchRaw);

    const templateChoice = chooseTemplate(routerRole, model, technology, owner, switchTopology);
    const generationWarnings = [...templateChoice.warnings];

    if (switchTopology === "com-switch" && !switchContext?.ip) {
      generationWarnings.push("Topologia com switch selecionada, mas a UL nao possui IP SWITCH valido.");
    }

    if (routerRole === "backup" && technology !== "4g" && operadora4g !== "nao-se-aplica") {
      generationWarnings.push("Operadora 4G foi ignorada porque a tecnologia selecionada e VSAT.");
    }

    if (routerRole === "backup" && technology === "4g" && operadora4g === "nao-se-aplica") {
      generationWarnings.push("Tecnologia 4G selecionada sem operadora definida (Vivo, TIM ou Arqia).");
    }

    const primaryTunnelIp = deriveTunnelIpFromPrimaryLoopback(primaryLoopback);
    const scriptContext: ScriptContext = {
      codUl: normalizeText(activeRow.cod_ul),
      nomeLoterica: normalizeText(activeRow.nome_loterica),
      cidade: normalizeText(activeRow.cidade),
      uf: normalizeText(activeRow.uf),
      contato: normalizeText(activeRow.contato),
      cctoOi: normalizeText(activeRow.ccto_oi),
      cctoOemp: normalizeText(activeRow.ccto_oemp),
      designacaoNova: normalizeText(activeRow.designacao_nova),
      routerRole,
      routerModel: model,
      technology,
      owner,
      switchTopology,
      operadora4g,
      primaryLoopback,
      primaryTunnelIp,
      loopbackSecundario,
      lanNetwork: lanContext.network,
      lanRouter: lanContext.router,
      lanVirtual: lanContext.virtual,
      lanAclHost: lanContext.aclHost,
      lanMask: lanContext.mask,
      lanPrefix: String(lanContext.prefix),
      switchIp: switchContext?.ip || "",
      switchNetwork: switchContext?.network || "",
      switchVirtual: switchContext?.virtual || "",
      switchMask: switchContext?.mask || "",
      switchPrefix: switchContext ? String(switchContext.prefix) : "",
    };

    setGenerating(true);
    try {
      const customTemplateMatch = resolveCustomRouterScriptTemplate(customTemplates, {
        routerRole,
        model,
        technology,
        owner,
        switchTopology,
        scriptVariant,
      });

      if (customTemplateMatch) {
        const generatedScript = applyCustomRouterTemplate(customTemplateMatch.template.content, scriptContext);
        setFullScript(generatedScript);
        setGeneratedBaseVariant(customTemplateMatch.baseVariant);
        setTemplateLabel(`ADM - ${customTemplateMatch.template.name}`);
        setWarnings(generationWarnings);
        return;
      }

      const templateText = await loadTemplate(templateChoice.templateId);
      const generatedScript = applyTemplateReplacements(templateChoice.templateId, templateText, scriptContext);
      setFullScript(generatedScript);
      setGeneratedBaseVariant("completo");
      setTemplateLabel(TEMPLATE_META[templateChoice.templateId].label);
      setWarnings(generationWarnings);
    } catch (generationError) {
      console.error("Falha ao gerar Script Router SCT", generationError);
      setFullScript("");
      setGeneratedBaseVariant("completo");
      setTemplateLabel("");
      setWarnings([]);
      setError(String((generationError as Error)?.message || generationError || "Falha ao gerar script."));
    } finally {
      setGenerating(false);
    }
  }, [codUlInput, customTemplates, handleLookup, loterica, model, operadora4g, owner, routerRole, scriptVariant, switchTopology, technology]);

  const script = useMemo(() => {
    if (!fullScript) return "";
    if (generatedBaseVariant === "completo") {
      return scriptVariant === "completo" ? fullScript : extractRouterScriptVariant(fullScript, scriptVariant);
    }
    return generatedBaseVariant === scriptVariant ? fullScript : "";
  }, [fullScript, generatedBaseVariant, scriptVariant]);
  const scriptVariantLabel = ROUTER_SCRIPT_VARIANT_LABELS[scriptVariant];
  const variantError = useMemo(() => {
    if (!fullScript) return "";
    if (generatedBaseVariant !== "completo" && generatedBaseVariant !== scriptVariant) {
      return `O modelo gerado e do tipo ${ROUTER_SCRIPT_VARIANT_LABELS[generatedBaseVariant].toLowerCase()}. Gere novamente para ${scriptVariantLabel.toLowerCase()}.`;
    }
    if (scriptVariant === "completo" || script) return "";
    return scriptVariant === "bgp"
      ? "O template selecionado nao possui bloco BGP para gerar o script parcial."
      : "O template selecionado nao possui bloco NQA para gerar o script parcial.";
  }, [fullScript, generatedBaseVariant, script, scriptVariant, scriptVariantLabel]);
  const displayedError = error || variantError;

  const handleCopy = useCallback(async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error("Falha ao copiar script", copyError);
      setError("Nao foi possivel copiar o script.");
    }
  }, [script]);

  const handleDownload = useCallback(() => {
    if (!script) return;

    const fileNameModel = model.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    const fileCode = normalizeText(loterica?.cod_ul || codUlInput || "SCRIPT");
    const fileNameSuffix = scriptVariant === "completo" ? "COMPLETO" : scriptVariant.toUpperCase();
    const fileName = `${fileCode}-SCT-${fileNameModel}-${fileNameSuffix}.txt`;

    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [codUlInput, loterica?.cod_ul, model, script, scriptVariant]);

  const lotericaSummary = loterica
    ? {
        codUl: normalizeText(loterica.cod_ul),
        nome: normalizeText(loterica.nome_loterica) || "-",
        loopbackPrincipal: extractIpv4(getPrimaryLoopbackValue(loterica)) || "-",
        loopbackSecundario: extractIpv4(getSecondaryLoopbackValue(loterica)) || "-",
        redeLan: getRedeLanValue(loterica) || "-",
        switchIp: getRawValueByAliases(loterica, ["IP SWITCH", "LOOPBACK SWITCH"]) || "-",
      }
    : null;

  const availableModelOptions = useMemo(
    () =>
      MODEL_OPTIONS.filter((item) =>
        routerRole === "principal" ? item.value === "cisco1900" : item.value !== "cisco1900",
      ),
    [routerRole],
  );

  const availableTechOptions = useMemo(
    () =>
      TECH_OPTIONS.filter((item) => (routerRole === "principal" ? true : item.value !== "fibra")),
    [routerRole],
  );
  const matchingCustomTemplate = useMemo(
    () =>
      resolveCustomRouterScriptTemplate(customTemplates, {
        routerRole,
        model,
        technology,
        owner,
        switchTopology,
        scriptVariant,
      }),
    [customTemplates, model, owner, routerRole, scriptVariant, switchTopology, technology],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCode2 className="w-5 h-5" /> Script Router SCT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label>Codigo UL</Label>
            <Input
              placeholder="Ex.: 21-000666-8"
              value={codUlInput}
              onChange={(event) => setCodUlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleGenerate();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => void handleLookup()}
            disabled={loadingLookup || generating}
          >
            <Search className="w-4 h-4 mr-1.5" />
            {loadingLookup ? "Buscando..." : "Buscar UL"}
          </Button>
          <Button
            type="button"
            className="self-end"
            onClick={() => void handleGenerate()}
            disabled={loadingLookup || generating}
          >
            {generating ? "Gerando..." : scriptVariant === "completo" ? "Gerar Script Completo" : "Gerar Script Parcial"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="space-y-1.5">
            <Label>Roteador</Label>
            <Select value={routerRole} onValueChange={(value) => setRouterRole(value as RouterRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUTER_ROLE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Select value={model} onValueChange={(value) => setModel(value as RouterModel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModelOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={owner} onValueChange={(value) => setOwner(value as OwnerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNER_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tecnologia</Label>
            <Select value={technology} onValueChange={(value) => setTechnology(value as LinkTechnology)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTechOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Operadora 4G</Label>
            <Select
              value={operadora4g}
              onValueChange={(value) => setOperadora4g(value as Operadora4g)}
              disabled={technology !== "4g"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERADORA_4G_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Switch</Label>
            <Select value={switchTopology} onValueChange={(value) => setSwitchTopology(value as SwitchTopology)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SWITCH_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de script</Label>
            <Select value={scriptVariant} onValueChange={(value) => setScriptVariant(value as RouterScriptVariant)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCRIPT_VARIANT_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {lotericaSummary && (
          <div className="rounded-lg border bg-muted/20 p-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Codigo UL</p>
              <p className="font-mono text-xs mt-1">{lotericaSummary.codUl}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loterica</p>
              <p className="text-sm mt-1">{lotericaSummary.nome}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loopback Principal</p>
              <p className="font-mono text-xs mt-1">{lotericaSummary.loopbackPrincipal}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loopback Secundario</p>
              <p className="font-mono text-xs mt-1">{lotericaSummary.loopbackSecundario}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rede LAN</p>
              <p className="font-mono text-xs mt-1">{lotericaSummary.redeLan}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">IP Switch</p>
              <p className="font-mono text-xs mt-1">{lotericaSummary.switchIp}</p>
            </div>
          </div>
        )}

        {displayedError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayedError}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            {warnings.map((message, index) => (
              <p key={`${message}-${index}`}>- {message}</p>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {scriptVariant === "completo" ? "Script completo do roteador" : `Script ${scriptVariantLabel.toLowerCase()}`}
              </Label>
              {templateLabel && <Badge variant="secondary">{templateLabel}</Badge>}
              <Badge variant="outline">{scriptVariantLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                disabled={!script}
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!script}>
                <Download className="w-4 h-4 mr-1" />
                Baixar TXT
              </Button>
            </div>
          </div>

          <Textarea
            readOnly
            value={script}
            placeholder="O script selecionado sera exibido aqui apos a geracao."
            className={cn("min-h-[520px] font-mono text-xs whitespace-pre")}
          />
        </div>

        {isAdmin && (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">ADM</Badge>
                  <h3 className="font-semibold leading-none">Modelos Customizados</h3>
                </div>
                <CardDescription>
                  Cadastre modelos completos ou parciais e use placeholders para adaptar automaticamente aos dados da loterica.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetCustomTemplateForm}>
                  <Plus className="w-4 h-4 mr-1" />
                  Novo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchCustomTemplates()}
                  disabled={customTemplatesLoading || customTemplateSaving}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Atualizar
                </Button>
              </div>
            </div>

            {matchingCustomTemplate && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                Modelo ADM encontrado para a selecao atual: <span className="font-medium">{matchingCustomTemplate.template.name}</span>
                {" • "}
                {ROUTER_SCRIPT_VARIANT_LABELS[matchingCustomTemplate.baseVariant]}
              </div>
            )}

            {customTemplatesError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-line">
                {customTemplatesError}
              </div>
            )}

            {customTemplateNotice && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {customTemplateNotice}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Modelos salvos</p>
                  <p className="text-xs text-muted-foreground">
                    {customTemplatesLoading ? "Carregando..." : `${customTemplates.length} modelo(s) carregado(s)`}
                  </p>
                </div>

                <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                  {!customTemplatesLoading && customTemplates.length === 0 && (
                    <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      Nenhum modelo customizado cadastrado.
                    </div>
                  )}

                  {customTemplates.map((template) => (
                    <div key={template.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{template.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Atualizado em {formatDateTimePtBr(template.updated_at || template.created_at)}
                          </p>
                        </div>
                        <Badge variant={template.is_active ? "secondary" : "outline"}>
                          {template.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{template.router_role}</Badge>
                        <Badge variant="outline">{template.script_variant}</Badge>
                        <Badge variant="outline">
                          {template.model === ROUTER_SCRIPT_TEMPLATE_ANY ? "Qualquer" : ROUTER_MODEL_LABELS[template.model]}
                        </Badge>
                        <Badge variant="outline">{template.technology}</Badge>
                        <Badge variant="outline">{template.owner}</Badge>
                        <Badge variant="outline">{template.switch_topology}</Badge>
                      </div>

                      {template.notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{template.notes}</p>}

                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEditCustomTemplate(template)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDeleteCustomTemplate(template)}
                          disabled={customTemplateSaving}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <input
                  ref={templateFileInputRef}
                  type="file"
                  accept={CUSTOM_TEMPLATE_ACCEPT}
                  className="hidden"
                  onChange={handleTemplateFileChange}
                />

                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">
                      {customTemplateForm.id ? "Editar modelo" : "Novo modelo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Modelos parciais aceitam o mesmo mecanismo de placeholders dos completos.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => templateFileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Carregar TXT
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Nome do modelo</Label>
                    <Input
                      value={customTemplateForm.name}
                      onChange={(event) =>
                        setCustomTemplateForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex.: HP20-11 OI BGP"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Roteador</Label>
                    <Select
                      value={customTemplateForm.routerRole}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({ ...current, routerRole: value as RouterRole }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUTER_ROLE_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={customTemplateForm.scriptVariant}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({ ...current, scriptVariant: value as RouterScriptVariant }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCRIPT_VARIANT_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Modelo</Label>
                    <Select
                      value={customTemplateForm.model}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({
                          ...current,
                          model: value as TemplateScopeValue<RouterModel>,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_FORM_MODEL_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tecnologia</Label>
                    <Select
                      value={customTemplateForm.technology}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({
                          ...current,
                          technology: value as TemplateScopeValue<LinkTechnology>,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_FORM_TECH_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Owner</Label>
                    <Select
                      value={customTemplateForm.owner}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({
                          ...current,
                          owner: value as TemplateScopeValue<OwnerType>,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_FORM_OWNER_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Switch</Label>
                    <Select
                      value={customTemplateForm.switchTopology}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({
                          ...current,
                          switchTopology: value as TemplateScopeValue<SwitchTopology>,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_FORM_SWITCH_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={customTemplateForm.isActive ? "ativo" : "inativo"}
                      onValueChange={(value) =>
                        setCustomTemplateForm((current) => ({ ...current, isActive: value === "ativo" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_FORM_STATUS_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Conteudo do modelo</Label>
                  <Textarea
                    value={customTemplateForm.content}
                    onChange={(event) =>
                      setCustomTemplateForm((current) => ({ ...current, content: event.target.value }))
                    }
                    placeholder="Cole aqui o script completo ou parcial."
                    className="min-h-[280px] font-mono text-xs whitespace-pre"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Observacoes</Label>
                  <Textarea
                    value={customTemplateForm.notes}
                    onChange={(event) =>
                      setCustomTemplateForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Opcional. Use para anotar owner, circuito base ou orientacoes."
                    className="min-h-[96px] text-sm"
                  />
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-sm font-medium">Placeholders disponiveis</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {ROUTER_SCRIPT_PLACEHOLDER_HINTS.map((item) => (
                      <div key={item.token} className="text-xs">
                        <p className="font-mono text-foreground">{item.token}</p>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleSaveCustomTemplate()}
                    disabled={customTemplateSaving}
                  >
                    {customTemplateSaving ? "Salvando..." : customTemplateForm.id ? "Atualizar modelo" : "Cadastrar modelo"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetCustomTemplateForm} disabled={customTemplateSaving}>
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScriptRouterSctTab;
