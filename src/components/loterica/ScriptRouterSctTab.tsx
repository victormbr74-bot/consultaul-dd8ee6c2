import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dedupeTerms,
  fetchLookupRows,
  getRedeLanValue,
  getSecondaryLoopbackValue,
  normalizeText,
  parseTerms,
  resolveMatches,
  type LotericaLookupRow,
} from "@/components/loterica/lotericaLookup";

type RouterModel = "huawei" | "hp1002-4" | "hpmsr900" | "hpmsr931" | "hpmsr920";
type OwnerType = "oi" | "sencinet";
type LinkType = "4g" | "vsat";
type FourGOperator = "vivo" | "tim" | "arqia";
type SwitchMode = "com_switch" | "sem_switch";

interface ScriptRouterSctTabProps {
  initialCodUl?: string;
}

interface LanInfo {
  source: string;
  networkIp: string;
  mask: string;
  wildcard: string;
  interfaceIp: string;
  prefix: number | null;
}

interface ScriptResult {
  row: LotericaLookupRow;
  codUl: string;
  loopbackSec: string;
  redeLan: string;
  lanInfo: LanInfo;
  profileName: string;
  script: string;
}

const MODEL_LABELS: Record<RouterModel, string> = {
  huawei: "HUAWEI",
  "hp1002-4": "HP 1002-4",
  hpmsr900: "HPMSR900",
  hpmsr931: "HPMSR931",
  hpmsr920: "HPMSR920",
};

const OWNER_LABELS: Record<OwnerType, string> = {
  oi: "OI",
  sencinet: "SENCINET",
};

const LINK_LABELS: Record<LinkType, string> = {
  "4g": "4G",
  vsat: "VSAT",
};

const OPERATOR_LABELS: Record<FourGOperator, string> = {
  vivo: "VIVO",
  tim: "TIM",
  arqia: "ARQIA",
};

const SWITCH_LABELS: Record<SwitchMode, string> = {
  com_switch: "C/SW",
  sem_switch: "S/SW",
};

const APN_BY_OPERATOR: Record<FourGOperator, string> = {
  vivo: "zap.vivo.com.br",
  tim: "timbrasil.br",
  arqia: "m2m.arqia.br",
};

const MODEL_INTERFACES: Record<RouterModel, {
  wanVsat: string;
  wan4g: string;
  lanRouted: string;
  switchPorts: string[];
  loopback: string;
}> = {
  huawei: {
    wanVsat: "GigabitEthernet0/0/0",
    wan4g: "Cellular0/0/0",
    lanRouted: "GigabitEthernet0/0/1",
    switchPorts: ["GigabitEthernet0/0/1", "GigabitEthernet0/0/2"],
    loopback: "LoopBack10",
  },
  "hp1002-4": {
    wanVsat: "Ethernet0/0",
    wan4g: "Cellular0/0",
    lanRouted: "Ethernet0/1",
    switchPorts: ["Ethernet0/1", "Ethernet0/2", "Ethernet0/3"],
    loopback: "LoopBack10",
  },
  hpmsr900: {
    wanVsat: "Ethernet0/0",
    wan4g: "Cellular0/0",
    lanRouted: "Ethernet0/1",
    switchPorts: ["Ethernet0/1", "Ethernet0/2", "Ethernet0/3", "Ethernet0/4", "Ethernet0/5"],
    loopback: "LoopBack10",
  },
  hpmsr931: {
    wanVsat: "GigabitEthernet0/0",
    wan4g: "Cellular0/0",
    lanRouted: "GigabitEthernet0/1",
    switchPorts: ["GigabitEthernet0/1", "GigabitEthernet0/2"],
    loopback: "LoopBack10",
  },
  hpmsr920: {
    wanVsat: "GigabitEthernet0/0",
    wan4g: "Cellular0/0",
    lanRouted: "GigabitEthernet0/1",
    switchPorts: ["GigabitEthernet0/1", "GigabitEthernet0/2"],
    loopback: "LoopBack10",
  },
};

const parseIp = (value: string) => {
  const match = value.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!match) return null;
  const octets = value.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.some((item) => Number.isNaN(item) || item < 0 || item > 255)) return null;
  return octets;
};

const ipToNumber = (value: string) => {
  const octets = parseIp(value);
  if (!octets) return null;
  return (((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + octets[3]) >>> 0;
};

const numberToIp = (value: number) => {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
};

const prefixToMask = (prefix: number) => {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return numberToIp(mask);
};

const maskToWildcard = (mask: string) => {
  const maskNum = ipToNumber(mask);
  if (maskNum === null) return null;
  return numberToIp((~maskNum) >>> 0);
};

const parseLanInfo = (value: string): LanInfo | null => {
  const source = normalizeText(value);
  if (!source) return null;

  let ip = "";
  let mask = "";
  let prefix: number | null = null;

  const cidrMatch = source.match(/(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})/);
  if (cidrMatch) {
    ip = cidrMatch[1];
    prefix = Number.parseInt(cidrMatch[2], 10);
    const cidrMask = prefixToMask(prefix);
    if (!cidrMask) return null;
    mask = cidrMask;
  } else {
    const ipMaskMatch = source.match(/(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})/);
    if (ipMaskMatch) {
      ip = ipMaskMatch[1];
      mask = ipMaskMatch[2];
    } else {
      const ipOnly = source.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
      if (!ipOnly) return null;
      ip = ipOnly[1];
      mask = "255.255.255.0";
      prefix = 24;
    }
  }

  const ipNum = ipToNumber(ip);
  const maskNum = ipToNumber(mask);
  if (ipNum === null || maskNum === null) return null;

  const wildcard = maskToWildcard(mask);
  if (!wildcard) return null;

  const networkNum = (ipNum & maskNum) >>> 0;
  const hostBits = (~maskNum) >>> 0;
  const hostPart = ipNum & hostBits;
  const interfaceIpNum = hostBits > 1 && hostPart === 0 ? (networkNum + 1) >>> 0 : ipNum;

  return {
    source,
    networkIp: numberToIp(networkNum),
    mask,
    wildcard,
    interfaceIp: numberToIp(interfaceIpNum),
    prefix,
  };
};

const safeSysname = (value: string) => {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (clean || "UL-SCRIPT").slice(0, 32);
};

const toProfileName = (
  model: RouterModel,
  owner: OwnerType,
  link: LinkType,
  switchMode: SwitchMode,
  operator4g: FourGOperator,
) => {
  const base = `${MODEL_LABELS[model]} ${LINK_LABELS[link]} Owner ${OWNER_LABELS[owner]} - ${SWITCH_LABELS[switchMode]}`;
  if (link === "4g") return `${base} (${OPERATOR_LABELS[operator4g]})`;
  return base;
};

const buildOwnerBlock = (owner: OwnerType) => {
  if (owner === "sencinet") {
    return [
      "aaa",
      " hwtacacs scheme fac-svr-tacacs-template",
      "  primary authentication 172.31.248.45 key cipher <CHAVE_TACACS>",
      "  secondary authentication 172.31.252.45 key cipher <CHAVE_TACACS>",
      "  authorization hwtacacs local",
      "  accounting hwtacacs local",
      " domain default enable hwtacacs-scheme fac-svr-tacacs-template local",
      "quit",
      "#",
    ];
  }

  return [
    "aaa",
    " authentication-scheme default",
    " authorization-scheme default",
    " accounting-scheme default",
    " domain default enable system",
    "quit",
    "#",
  ];
};

const buildSwitchBlock = (model: RouterModel, switchMode: SwitchMode, lan: LanInfo) => {
  const info = MODEL_INTERFACES[model];
  if (switchMode === "com_switch") {
    const accessLines = info.switchPorts.flatMap((port) => [
      `interface ${port}`,
      " port link-mode bridge",
      " port access vlan 1",
      "quit",
      "#",
    ]);

    return [
      "vlan 1",
      "quit",
      "#",
      ...accessLines,
      "interface Vlan-interface1",
      " description REDE LAN UL",
      ` ip address ${lan.interfaceIp} ${lan.mask}`,
      "quit",
      "#",
    ];
  }

  return [
    `interface ${info.lanRouted}`,
    " port link-mode route",
    " description REDE LAN UL",
    ` ip address ${lan.interfaceIp} ${lan.mask}`,
    "quit",
    "#",
  ];
};

const buildLinkBlock = (
  model: RouterModel,
  owner: OwnerType,
  link: LinkType,
  operator4g: FourGOperator,
) => {
  const info = MODEL_INTERFACES[model];
  if (link === "4g") {
    return [
      `interface ${info.wan4g}`,
      ` description LINK 4G ${OPERATOR_LABELS[operator4g]} OWNER ${OWNER_LABELS[owner]}`,
      " dialer enable-circular",
      ` apn ${APN_BY_OPERATOR[operator4g]}`,
      " ip address ppp-negotiate",
      "quit",
      "#",
      "ip route-static 0.0.0.0 0.0.0.0 192.168.248.253",
      "#",
    ];
  }

  return [
    `interface ${info.wanVsat}`,
    ` description LINK VSAT OWNER ${OWNER_LABELS[owner]}`,
    " ip address dhcp-alloc",
    "quit",
    "#",
    "ip route-static 0.0.0.0 0.0.0.0 192.168.10.254",
    "#",
  ];
};

const buildRouterScript = (
  row: LotericaLookupRow,
  model: RouterModel,
  owner: OwnerType,
  link: LinkType,
  operator4g: FourGOperator,
  switchMode: SwitchMode,
  loopbackSec: string,
  lan: LanInfo,
) => {
  const codUl = normalizeText(row.cod_ul);
  const lotericaName = normalizeText(row.nome_loterica) || "-";
  const profileName = toProfileName(model, owner, link, switchMode, operator4g);
  const info = MODEL_INTERFACES[model];
  const sysname = safeSysname(`${codUl}-${MODEL_LABELS[model]}`);
  const generatedAt = new Date().toLocaleString("pt-BR");

  const lines = [
    "###############################################",
    "# SCRIPT ROUTER SCT - GERADO AUTOMATICAMENTE",
    `# PERFIL: ${profileName}`,
    `# UL: ${codUl} | LOTERICA: ${lotericaName}`,
    `# LOOPBACK SECUNDARIO: ${loopbackSec}`,
    `# REDE LAN: ${lan.source}`,
    `# GERADO EM: ${generatedAt}`,
    "###############################################",
    "",
    "system-view",
    `sysname ${sysname}`,
    "clock timezone BRZ minus 03:00:00",
    "#",
    `interface ${info.loopback}`,
    ` description LOOPBACK SECUNDARIO UL ${codUl}`,
    ` ip address ${loopbackSec} 255.255.255.255`,
    "quit",
    "#",
    ...buildSwitchBlock(model, switchMode, lan),
    ...buildLinkBlock(model, owner, link, operator4g),
    "acl number 3102",
    ` rule 5 permit ip source ${lan.networkIp} ${lan.wildcard}`,
    "quit",
    "#",
    "ip local policy-based-route LOOP_SEC",
    "#",
    "nqa entry testerota icmp",
    ` destination ip ${loopbackSec}`,
    " frequency 15000",
    " timeout 5",
    " probe count 15",
    "quit",
    "nqa schedule icmp testerota start-time now lifetime forever",
    "#",
    ...buildOwnerBlock(owner),
    "save force",
  ];

  return {
    profileName,
    script: lines.join("\n"),
  };
};

const ScriptRouterSctTab = ({ initialCodUl = "" }: ScriptRouterSctTabProps) => {
  const [codUlInput, setCodUlInput] = useState("");
  const [model, setModel] = useState<RouterModel>("hpmsr900");
  const [owner, setOwner] = useState<OwnerType>("sencinet");
  const [link, setLink] = useState<LinkType>("4g");
  const [operator4g, setOperator4g] = useState<FourGOperator>("tim");
  const [switchMode, setSwitchMode] = useState<SwitchMode>("sem_switch");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!codUlInput.trim() && initialCodUl.trim()) {
      setCodUlInput(initialCodUl.trim());
    }
  }, [initialCodUl, codUlInput]);

  const profilePreview = useMemo(() => {
    return toProfileName(model, owner, link, switchMode, operator4g);
  }, [model, owner, link, switchMode, operator4g]);

  const copyScript = () => {
    if (!result?.script) return;
    navigator.clipboard.writeText(result.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleGenerate = async () => {
    const terms = dedupeTerms(parseTerms(codUlInput));
    if (terms.length !== 1) {
      setError("Informe somente 1 codigo UL para gerar o script.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const rows = await fetchLookupRows(terms);
      const [match] = resolveMatches(terms, rows);
      if (!match?.row) {
        setResult(null);
        setError("UL nao encontrada na base.");
        return;
      }

      const row = match.row;
      const loopbackSec = getSecondaryLoopbackValue(row);
      const redeLan = getRedeLanValue(row);

      if (!loopbackSec) {
        setResult(null);
        setError("A UL nao possui loopback secundario para gerar o script.");
        return;
      }
      if (!redeLan) {
        setResult(null);
        setError("A UL nao possui REDE LAN para gerar o script.");
        return;
      }

      const lanInfo = parseLanInfo(redeLan);
      if (!lanInfo) {
        setResult(null);
        setError("Nao foi possivel interpretar a REDE LAN da UL. Exemplo esperado: 10.50.10.0/24.");
        return;
      }

      const scriptData = buildRouterScript(
        row,
        model,
        owner,
        link,
        operator4g,
        switchMode,
        loopbackSec,
        lanInfo,
      );

      setResult({
        row,
        codUl: normalizeText(row.cod_ul) || terms[0],
        loopbackSec,
        redeLan,
        lanInfo,
        profileName: scriptData.profileName,
        script: scriptData.script,
      });
    } catch (lookupError) {
      setResult(null);
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao gerar script."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" /> Script Router SCT
          </CardTitle>
          <Button variant="outline" size="sm" onClick={copyScript} disabled={!result?.script}>
            {copied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copiado!" : "Copiar Script"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sct-cod-ul">Codigo UL</Label>
              <Input
                id="sct-cod-ul"
                placeholder="21-000666-8"
                value={codUlInput}
                onChange={(e) => setCodUlInput(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Modelo do Roteador</Label>
              <Select value={model} onValueChange={(v) => setModel(v as RouterModel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="huawei">HUAWEI</SelectItem>
                  <SelectItem value="hp1002-4">HP 1002-4</SelectItem>
                  <SelectItem value="hpmsr900">HPMSR900</SelectItem>
                  <SelectItem value="hpmsr931">HPMSR931</SelectItem>
                  <SelectItem value="hpmsr920">HPMSR920</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={owner} onValueChange={(v) => setOwner(v as OwnerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oi">OI</SelectItem>
                  <SelectItem value="sencinet">Sencinet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Link</Label>
              <Select value={link} onValueChange={(v) => setLink(v as LinkType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4g">4G</SelectItem>
                  <SelectItem value="vsat">VSAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Operadora 4G</Label>
              <Select value={operator4g} onValueChange={(v) => setOperator4g(v as FourGOperator)} disabled={link !== "4g"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivo">VIVO</SelectItem>
                  <SelectItem value="tim">TIM</SelectItem>
                  <SelectItem value="arqia">ARQIA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Switch</Label>
              <Select value={switchMode} onValueChange={(v) => setSwitchMode(v as SwitchMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_switch">Sem Switch (S/SW)</SelectItem>
                  <SelectItem value="com_switch">Com Switch (C/SW)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{profilePreview}</Badge>
            <p className="text-xs text-muted-foreground">
              A UL e buscada automaticamente e o script usa LOOPBACK SECUNDARIO + REDE LAN da base.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Script"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setResult(null);
              }}
            >
              Limpar Resultado
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Codigo UL</p>
                  <p className="font-mono font-semibold">{result.codUl}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loterica</p>
                  <p>{normalizeText(result.row.nome_loterica) || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loopback Secundario</p>
                  <p className="font-mono">{result.loopbackSec}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rede LAN</p>
                  <p className="font-mono">{result.redeLan}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rede / Mascara</p>
                  <p className="font-mono">{result.lanInfo.networkIp} {result.lanInfo.mask}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Wildcard</p>
                  <p className="font-mono">{result.lanInfo.wildcard}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP LAN (Interface)</p>
                  <p className="font-mono">{result.lanInfo.interfaceIp}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Perfil Gerado</p>
                  <p>{result.profileName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Script Router SCT</Label>
                <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[560px] overflow-y-auto">
                  {result.script}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum script gerado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScriptRouterSctTab;
