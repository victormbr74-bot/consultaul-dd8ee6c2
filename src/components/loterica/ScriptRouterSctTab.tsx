import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FileCode2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildCodUlExactCandidates, buildCodUlSearchVariants, normalizeCodUlTerm } from "@/lib/lotericaCodUl";
import { extractRouterScriptVariant, ROUTER_SCRIPT_VARIANT_LABELS, type RouterScriptVariant } from "@/lib/routerScript";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type RouterRole = "principal" | "backup";
type RouterModel = "cisco1900" | "huawei" | "hp20-11" | "hp1002-4" | "hpmsr900" | "hpmsr931" | "hpmsr920";
type LinkTechnology = "fibra" | "4g" | "vsat";
type OwnerType = "oi" | "sencinet";
type SwitchTopology = "com-switch" | "sem-switch";
type Operadora4g = "vivo" | "tim" | "arqia" | "nao-se-aplica";

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
}

interface SwitchContext {
  ip: string;
  network: string;
  virtual: string;
}

interface ScriptContext {
  codUl: string;
  primaryLoopback: string;
  primaryTunnelIp: string;
  loopbackSecundario: string;
  lanNetwork: string;
  lanRouter: string;
  lanVirtual: string;
  lanAclHost: string;
  switchIp: string;
  switchNetwork: string;
  switchVirtual: string;
}

interface TemplateChoice {
  templateId: TemplateId;
  warnings: string[];
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
  { value: "cisco1900", label: "Cisco 1900" },
  { value: "huawei", label: "HUAWEI" },
  { value: "hp20-11", label: "HP20-11" },
  { value: "hp1002-4", label: "HP 1002-4" },
  { value: "hpmsr900", label: "HPMSR900" },
  { value: "hpmsr931", label: "HPMSR931" },
  { value: "hpmsr920", label: "HPMSR920" },
];

const ROUTER_ROLE_OPTIONS: Array<{ value: RouterRole; label: string }> = [
  { value: "principal", label: "Principal" },
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

  const isNetworkInput = ipNumber === networkNumber;
  const router = numberToIpv4(isNetworkInput ? (networkNumber + 3) >>> 0 : ipNumber);
  const virtual = numberToIpv4((networkNumber + 1) >>> 0);
  const aclHost = numberToIpv4((networkNumber + 2) >>> 0);

  if (!router || !virtual || !aclHost) return null;

  return { network, router, virtual, aclHost };
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
  if (!network || !virtual) return null;

  return { ip, network, virtual };
};

const deriveTunnelIpFromPrimaryLoopback = (loopback: string) => {
  const parts = loopback.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return "";
  if (parts[0] !== "10") return "";
  return ["15", parts[1], parts[2], parts[3]].join(".");
};

const detectModel = (row: LotericaLookupRow): RouterModel => {
  const source = toUpperNoAccent(getRawValueByAliases(row, ["MODELO ROTEADOR"]));
  if (source.includes("CISCO") || source.includes("1900") || source.includes("1921")) return "cisco1900";
  if (source.includes("HUAWEI")) return "huawei";
  if (source.includes("20-11") || source.includes("2011")) return "hp20-11";
  if (source.includes("1002")) return "hp1002-4";
  if (source.includes("931")) return "hpmsr931";
  if (source.includes("920")) return "hpmsr920";
  if (source.includes("900")) return "hpmsr900";
  return "hpmsr900";
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

const detectTechnology = (row: LotericaLookupRow): LinkTechnology => {
  const signal = toUpperNoAccent([
    getRawValueByAliases(row, ["TECNOLOGIA"]),
    getRawValueByAliases(row, ["VSAT"]),
    getRawValueByAliases(row, ["SIM CARD 4G"]),
    row.operadora || "",
  ].join(" | "));

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
    if (technology !== "fibra") {
      warnings.push("Roteador principal usa tecnologia Fibra. A opcao foi ajustada para o template principal.");
    }
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
  const [templateLabel, setTemplateLabel] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const initRef = useRef(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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

      setLoterica(normalizedRow);
      setCodUlInput(normalizeText(normalizedRow.cod_ul));

      setOwner(detectOwner(normalizedRow));
      setSwitchTopology(detectSwitchTopology(normalizedRow));
      if (routerRole === "principal") {
        setModel("cisco1900");
        setTechnology("fibra");
        setOperadora4g("nao-se-aplica");
      } else {
        setModel(detectBackupModel(normalizedRow));
        setTechnology(detectTechnology(normalizedRow));
        setOperadora4g(detectOperadora4g(normalizedRow));
      }

      return normalizedRow;
    } catch (lookupError) {
      console.error("Falha ao consultar loterica para Script Router SCT", lookupError);
      setLoterica(null);
      setFullScript("");
      setTemplateLabel("");
      setWarnings([]);
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao consultar loterica."));
      return null;
    } finally {
      setLoadingLookup(false);
    }
  }, [codUlInput, routerRole]);

  useEffect(() => {
    if (routerRole === "principal") {
      setModel("cisco1900");
      setTechnology("fibra");
      setOperadora4g("nao-se-aplica");
      return;
    }

    if (!loterica) {
      if (model === "cisco1900") setModel("hpmsr900");
      if (technology === "fibra") setTechnology("vsat");
      return;
    }

    setModel(detectBackupModel(loterica));
    setTechnology(detectTechnology(loterica));
    setOperadora4g(detectOperadora4g(loterica));
  }, [loterica, model, routerRole, technology]);

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
      setTemplateLabel("");
      setWarnings([]);
      setError("A UL nao possui loopback principal valido para gerar o script do roteador principal.");
      return;
    }

    if (routerRole === "backup" && !loopbackSecundario) {
      setFullScript("");
      setTemplateLabel("");
      setWarnings([]);
      setError("A UL nao possui loopback secundario valido para gerar o script.");
      return;
    }

    const redeLanRaw = getRedeLanValue(activeRow) || getRawValueByAliases(activeRow, ["REDE LAN", "REDE_LAN"]);
    const lanContext = deriveLanContext(redeLanRaw);
    if (!lanContext) {
      setFullScript("");
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
      primaryLoopback,
      primaryTunnelIp,
      loopbackSecundario,
      lanNetwork: lanContext.network,
      lanRouter: lanContext.router,
      lanVirtual: lanContext.virtual,
      lanAclHost: lanContext.aclHost,
      switchIp: switchContext?.ip || "",
      switchNetwork: switchContext?.network || "",
      switchVirtual: switchContext?.virtual || "",
    };

    setGenerating(true);
    try {
      const templateText = await loadTemplate(templateChoice.templateId);
      const generatedScript = applyTemplateReplacements(templateChoice.templateId, templateText, scriptContext);
      setFullScript(generatedScript);
      setTemplateLabel(TEMPLATE_META[templateChoice.templateId].label);
      setWarnings(generationWarnings);
    } catch (generationError) {
      console.error("Falha ao gerar Script Router SCT", generationError);
      setFullScript("");
      setTemplateLabel("");
      setWarnings([]);
      setError(String((generationError as Error)?.message || generationError || "Falha ao gerar script."));
    } finally {
      setGenerating(false);
    }
  }, [codUlInput, handleLookup, loterica, model, operadora4g, owner, routerRole, switchTopology, technology]);

  const script = useMemo(() => extractRouterScriptVariant(fullScript, scriptVariant), [fullScript, scriptVariant]);
  const scriptVariantLabel = ROUTER_SCRIPT_VARIANT_LABELS[scriptVariant];
  const variantError = useMemo(() => {
    if (!fullScript || scriptVariant === "completo" || script) return "";
    return scriptVariant === "bgp"
      ? "O template selecionado nao possui bloco BGP para gerar o script parcial."
      : "O template selecionado nao possui bloco NQA para gerar o script parcial.";
  }, [fullScript, script, scriptVariant]);
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
      TECH_OPTIONS.filter((item) =>
        routerRole === "principal" ? item.value === "fibra" : item.value !== "fibra",
      ),
    [routerRole],
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
              disabled={routerRole === "principal" || technology !== "4g"}
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
      </CardContent>
    </Card>
  );
};

export default ScriptRouterSctTab;
