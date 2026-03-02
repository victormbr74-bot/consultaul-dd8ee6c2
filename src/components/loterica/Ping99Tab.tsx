import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Search, Wifi } from "lucide-react";

interface Ping99TabProps {
  form: {
    cod_ul?: unknown;
    tfl?: unknown;
    raw_data?: Record<string, unknown> | null;
  };
}

type PingIp = {
  normal: string;
  padded: string;
};

type LinkTarget = "primario" | "secundario";
type MatchField = "cod_ul" | "ccto_oi" | "ccto_oemp" | "designacao_nova";

interface LotericaLookupRow {
  cod_ul: string;
  nome_loterica: string | null;
  ccto_oi: string | null;
  ccto_oemp: string | null;
  designacao_nova: string | null;
  loopback_wan: string | null;
  loopback_lan: string | null;
  status: string | null;
  raw_data: Record<string, unknown> | null;
}

interface TermMatch {
  query: string;
  row: LotericaLookupRow | null;
  matchField?: MatchField;
}

interface DisplayLookupResult {
  query: string;
  statusType: "ok" | "missing_ip" | "not_found";
  statusText: string;
  codUl: string;
  nome: string;
  circuito: string;
  statusUl: string;
  ip: string;
  command: string;
  matchedBy: string;
}

const SEQUENCE_SIZE = 16;
const LOOKUP_BATCH_SIZE = 120;
const SOURCE_INTERFACE = "gigabitEthernet0/0/1.1090";
const PING99_REPEAT = 1;
const PINGAO_REPEAT = 2;

const REDE_LAN_KEYS = ["REDE LAN", "REDE_LAN", "rede lan", "rede_lan", "REDELAN", "LAN"] as const;
const LOOPBACK_PRIMARIO_KEYS = ["LOOPBACK PRINCIPAL", "LOOPBACK PRIMARIO", "LOOTPBACK PRIMARIO"] as const;
const LOOPBACK_SECUNDARIO_KEYS = [
  "LOOPBACK SECUNDARIO",
  "LOOPBACK SECUNDÁRIO",
  "LOOPBACK SECUNDÃRIO",
  "LOOPBACK SECUND?RIO",
] as const;
const MATCH_FIELDS: MatchField[] = ["cod_ul", "ccto_oi", "ccto_oemp", "designacao_nova"];

const padOctet = (value: string) => value.padStart(3, "0");
const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeKey = (value: unknown) => normalizeText(value).toUpperCase();
const normalizeLooseKey = (value: unknown) => normalizeKey(value).replace(/[^A-Z0-9]/g, "");

const toRawObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
};

const getRawString = (raw: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = normalizeText(raw[key]);
    if (value) return value;
  }
  return "";
};

const parseLanIp = (value: string) => {
  const fullMatch = value.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!fullMatch) return null;

  const octets = fullMatch.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return null;

  return {
    octets,
    subnet: `${octets[0]}.${octets[1]}.${octets[2]}.0/24`,
  };
};

const parseIp = (value: string) => {
  const fullMatch = value.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!fullMatch) return null;

  const octets = fullMatch.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return null;

  return octets;
};

const incrementIp = (octets: number[]) => {
  const next = [...octets];
  for (let i = 3; i >= 0; i--) {
    if (next[i] < 255) {
      next[i] += 1;
      for (let j = i + 1; j <= 3; j++) next[j] = 0;
      return next;
    }
  }
  return null;
};

const parseTerms = (value: string) => {
  return value
    .split(/[\n,;\t]+/)
    .map((term) => normalizeText(term))
    .filter(Boolean);
};

const dedupeTerms = (terms: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const key = normalizeKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result;
};

const getPrimaryLoopback = (row: LotericaLookupRow) => {
  const raw = toRawObject(row.raw_data);
  return normalizeText(row.loopback_wan || getRawString(raw, LOOPBACK_PRIMARIO_KEYS));
};

const getSecondaryLoopback = (row: LotericaLookupRow) => {
  const raw = toRawObject(row.raw_data);
  const rawSec = getRawString(raw, LOOPBACK_SECUNDARIO_KEYS);
  const rowSecondary = normalizeText(row.loopback_lan);
  const rawRedeLan = getRawString(raw, REDE_LAN_KEYS);

  if (rawSec && rowSecondary && rowSecondary === rawRedeLan && rawSec !== rawRedeLan) {
    return rawSec;
  }

  return normalizeText(rowSecondary || rawSec);
};

const getLookupIp = (row: LotericaLookupRow, target: LinkTarget) => {
  return target === "primario" ? getPrimaryLoopback(row) : getSecondaryLoopback(row);
};

const padIp = (ip: string) => {
  const parsed = parseIp(ip);
  if (!parsed) return "";
  return parsed.map((octet) => padOctet(String(octet))).join(".");
};

const buildPingCommand = (ip: string) => {
  return `ping ${ip} source ${SOURCE_INTERFACE} repeat ${PINGAO_REPEAT}`;
};

const buildTclScriptFromIps = (ips: string[], repeat = PINGAO_REPEAT) => {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const ip of ips) {
    const parsed = parseIp(ip);
    if (!parsed) continue;
    const normalized = parsed.join(".");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  if (!unique.length) return "";

  const commands = unique
    .map((ip) => `"${padIp(ip)} source ${SOURCE_INTERFACE} repeat ${repeat}"`)
    .join("\n");

  return `tclsh
foreach add {
${commands}
} { ping $add }`;
};

const buildLookupDisplay = (match: TermMatch, target: LinkTarget): DisplayLookupResult => {
  if (!match.row) {
    return {
      query: match.query,
      statusType: "not_found",
      statusText: "Nao encontrado",
      codUl: "-",
      nome: "-",
      circuito: "-",
      statusUl: "-",
      ip: "",
      command: "",
      matchedBy: "-",
    };
  }

  const row = match.row;
  const ipCandidate = getLookupIp(row, target);
  const parsed = parseIp(ipCandidate);
  const ip = parsed ? parsed.join(".") : "";
  const circuito = normalizeText(row.ccto_oi || row.designacao_nova || row.ccto_oemp);

  if (!ip) {
    return {
      query: match.query,
      statusType: "missing_ip",
      statusText: target === "primario" ? "Sem loopback primario" : "Sem loopback secundario",
      codUl: normalizeText(row.cod_ul) || "-",
      nome: normalizeText(row.nome_loterica) || "-",
      circuito: circuito || "-",
      statusUl: normalizeText(row.status) || "-",
      ip: "",
      command: "",
      matchedBy: match.matchField ? `Por ${match.matchField}` : "-",
    };
  }

  return {
    query: match.query,
    statusType: "ok",
    statusText: "Pronto para ping",
    codUl: normalizeText(row.cod_ul) || "-",
    nome: normalizeText(row.nome_loterica) || "-",
    circuito: circuito || "-",
    statusUl: normalizeText(row.status) || "-",
    ip,
    command: buildPingCommand(ip),
    matchedBy: match.matchField ? `Por ${match.matchField}` : "-",
  };
};

const fetchByColumn = async (column: MatchField, terms: string[]) => {
  const rows: LotericaLookupRow[] = [];
  for (let i = 0; i < terms.length; i += LOOKUP_BATCH_SIZE) {
    const chunk = terms.slice(i, i + LOOKUP_BATCH_SIZE);
    if (!chunk.length) continue;
    const queryTerms = Array.from(new Set(
      chunk
        .map((term) => [normalizeText(term), normalizeKey(term)])
        .flat()
        .filter(Boolean),
    ));

    const { data, error } = await supabase
      .from("lotericas")
      .select("cod_ul,nome_loterica,ccto_oi,ccto_oemp,designacao_nova,loopback_wan,loopback_lan,status,raw_data")
      .in(column, queryTerms);

    if (error) {
      throw new Error(error.message || "Falha ao buscar dados de loterica.");
    }

    const batch = (data || []).map((item: any) => ({
      ...item,
      raw_data: toRawObject(item.raw_data),
    })) as LotericaLookupRow[];

    rows.push(...batch);
  }

  return rows;
};

const fetchLookupRows = async (terms: string[]) => {
  const [byCode, byOi, byOemp, byDesignacao] = await Promise.all([
    fetchByColumn("cod_ul", terms),
    fetchByColumn("ccto_oi", terms),
    fetchByColumn("ccto_oemp", terms),
    fetchByColumn("designacao_nova", terms),
  ]);

  const unique = new Map<string, LotericaLookupRow>();
  for (const row of [...byCode, ...byOi, ...byOemp, ...byDesignacao]) {
    const key = normalizeKey(row.cod_ul);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, row);
  }

  return [...unique.values()];
};

const resolveMatches = (terms: string[], rows: LotericaLookupRow[]): TermMatch[] => {
  const strict = new Map<string, { row: LotericaLookupRow; field: MatchField }>();
  const loose = new Map<string, { row: LotericaLookupRow; field: MatchField }>();

  for (const row of rows) {
    for (const field of MATCH_FIELDS) {
      const value = normalizeText(row[field]);
      if (!value) continue;

      const strictKey = normalizeKey(value);
      if (strictKey && !strict.has(strictKey)) {
        strict.set(strictKey, { row, field });
      }

      const looseKey = normalizeLooseKey(value);
      if (looseKey && !loose.has(looseKey)) {
        loose.set(looseKey, { row, field });
      }
    }
  }

  return terms.map((query) => {
    const strictKey = normalizeKey(query);
    const looseKey = normalizeLooseKey(query);
    const found = strict.get(strictKey) || (looseKey ? loose.get(looseKey) : undefined);
    return { query, row: found?.row || null, matchField: found?.field };
  });
};

const Ping99Tab = ({ form }: Ping99TabProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [target, setTarget] = useState<LinkTarget>("primario");
  const [singleInput, setSingleInput] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState("");
  const [singleMatch, setSingleMatch] = useState<TermMatch | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkMatches, setBulkMatches] = useState<TermMatch[]>([]);

  const raw = useMemo(
    () => ((form?.raw_data && typeof form.raw_data === "object") ? form.raw_data as Record<string, unknown> : {}),
    [form?.raw_data],
  );

  const redeLan = getRawString(raw, REDE_LAN_KEYS);
  const codUl = normalizeText(form?.cod_ul);
  const tfl = normalizeText(raw["TFL"] ?? raw["TFLs"] ?? form?.tfl);

  const base = useMemo(() => {
    if (!redeLan) return null;
    return parseLanIp(redeLan);
  }, [redeLan]);

  const ips = useMemo<PingIp[]>(() => {
    if (!base) return [];
    const result: PingIp[] = [];
    result.push({
      normal: base.octets.join("."),
      padded: base.octets.map((octet) => padOctet(String(octet))).join("."),
    });

    let current = base.octets;
    for (let i = 0; i < SEQUENCE_SIZE - 1; i++) {
      const next = incrementIp(current);
      if (!next) break;
      current = next;
      result.push({
        normal: next.join("."),
        padded: next.map((octet) => padOctet(String(octet))).join("."),
      });
    }
    return result;
  }, [base]);

  const tclScript = useMemo(() => {
    if (!ips.length) return "";
    const comandos = ips
      .map((ip) => `"${ip.padded} source ${SOURCE_INTERFACE} repeat ${PING99_REPEAT}"`)
      .join("\n");
    return `tclsh
foreach add {
${comandos}
} { ping $add }`;
  }, [ips]);

  const singleView = useMemo(() => {
    if (!singleMatch) return null;
    return buildLookupDisplay(singleMatch, target);
  }, [singleMatch, target]);

  const singleTclScript = useMemo(() => {
    if (!singleView?.ip) return "";
    return buildTclScriptFromIps([singleView.ip]);
  }, [singleView]);

  const bulkView = useMemo(() => {
    return bulkMatches.map((item) => buildLookupDisplay(item, target));
  }, [bulkMatches, target]);

  const bulkSummary = useMemo(() => {
    const ready = bulkView.filter((item) => item.statusType === "ok").length;
    const missingIp = bulkView.filter((item) => item.statusType === "missing_ip").length;
    const notFound = bulkView.filter((item) => item.statusType === "not_found").length;
    return {
      total: bulkView.length,
      ready,
      missingIp,
      notFound,
    };
  }, [bulkView]);

  const bulkTclScript = useMemo(() => {
    return buildTclScriptFromIps(bulkView.map((item) => item.ip).filter(Boolean));
  }, [bulkView]);

  const copy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  };

  const runSingleLookup = async () => {
    const term = normalizeText(singleInput);
    if (!term) {
      setSingleError("Informe um codigo UL ou circuito.");
      setSingleMatch(null);
      return;
    }

    setSingleLoading(true);
    setSingleError("");

    try {
      const terms = dedupeTerms([term]);
      const rows = await fetchLookupRows(terms);
      const [match] = resolveMatches(terms, rows);
      setSingleMatch(match || { query: term, row: null });
    } catch (error) {
      setSingleMatch(null);
      setSingleError(String((error as Error)?.message || error || "Falha ao consultar loterica."));
    } finally {
      setSingleLoading(false);
    }
  };

  const runBulkLookup = async () => {
    const parsedTerms = dedupeTerms(parseTerms(bulkInput));
    if (!parsedTerms.length) {
      setBulkError("Informe ao menos um codigo UL ou circuito.");
      setBulkMatches([]);
      return;
    }

    setBulkLoading(true);
    setBulkError("");

    try {
      const rows = await fetchLookupRows(parsedTerms);
      const matches = resolveMatches(parsedTerms, rows);
      setBulkMatches(matches);
    } catch (error) {
      setBulkMatches([]);
      setBulkError(String((error as Error)?.message || error || "Falha na consulta em massa."));
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" /> Teste de Ping pelo CTC/DTC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Rede LAN</span>
              <div className="font-mono">{redeLan || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Codigo UL</span>
              <div className="font-mono">{codUl || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">TFL</span>
              <div className="font-mono">{tfl || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Subnet</span>
              <div className="font-mono">{base ? base.subnet : "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Script TCL - Ping 99</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(tclScript, "ping99-script")} disabled={!tclScript}>
            {copiedId === "ping99-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copiedId === "ping99-script" ? "Copiado!" : "Copiar"}
          </Button>
        </CardHeader>
        <CardContent>
          {tclScript ? (
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
              {tclScript}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground">Rede LAN nao disponivel para gerar o script.</div>
          )}
        </CardContent>
      </Card>

      {!!ips.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">IPs da Rede LAN (+1 ate 16 IPs)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {ips.map((ip) => (
                <div key={ip.normal} className="text-xs font-mono bg-muted/50 p-2 rounded text-center">
                  {ip.normal}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" /> Pingao - Consulta por Codigo UL ou Circuito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="pingao-single">Codigo UL ou circuito</Label>
              <Input
                id="pingao-single"
                placeholder="Ex.: 05-024029-3 ou FLA6013700"
                value={singleInput}
                onChange={(e) => setSingleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSingleLookup();
                  }
                }}
              />
            </div>
            <Button onClick={() => void runSingleLookup()} disabled={singleLoading}>
              {singleLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Selecionar IP para ping</Label>
            <RadioGroup
              value={target}
              onValueChange={(value) => setTarget(value as LinkTarget)}
              className="flex flex-row items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="primario" id="pingao-primario" />
                <Label htmlFor="pingao-primario">Primario</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="secundario" id="pingao-secundario" />
                <Label htmlFor="pingao-secundario">Secundario</Label>
              </div>
            </RadioGroup>
          </div>

          {singleError ? <p className="text-sm text-destructive">{singleError}</p> : null}

          {singleView && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Consulta: <span className="font-mono text-foreground">{singleView.query}</span>
                </div>
                <Badge variant={singleView.statusType === "ok" ? "default" : singleView.statusType === "missing_ip" ? "secondary" : "outline"}>
                  {singleView.statusText}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-muted/50 p-2">
                  <span className="text-muted-foreground">Codigo UL: </span>
                  <span className="font-mono">{singleView.codUl}</span>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <span className="text-muted-foreground">Circuito: </span>
                  <span className="font-mono">{singleView.circuito}</span>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <span className="text-muted-foreground">Status UL: </span>
                  <span>{singleView.statusUl}</span>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <span className="text-muted-foreground">IP ({target}): </span>
                  <span className="font-mono">{singleView.ip || "-"}</span>
                </div>
                <div className="rounded bg-muted/50 p-2 md:col-span-2">
                  <span className="text-muted-foreground">Nome: </span>
                  <span>{singleView.nome}</span>
                </div>
                <div className="rounded bg-muted/50 p-2 md:col-span-2">
                  <span className="text-muted-foreground">Origem do match: </span>
                  <span>{singleView.matchedBy}</span>
                </div>
              </div>

              {singleView.command && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Comando de ping</Label>
                    <Button variant="outline" size="sm" onClick={() => copy(singleView.command, "pingao-single-command")}>
                      {copiedId === "pingao-single-command" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copiedId === "pingao-single-command" ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                  <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto">
                    {singleView.command}
                  </pre>
                </div>
              )}

              {singleTclScript && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Script TCL</Label>
                    <Button variant="outline" size="sm" onClick={() => copy(singleTclScript, "pingao-single-script")}>
                      {copiedId === "pingao-single-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copiedId === "pingao-single-script" ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                  <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto">
                    {singleTclScript}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Pingao - Consulta em Massa</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(bulkTclScript, "pingao-bulk-script")} disabled={!bulkTclScript}>
            {copiedId === "pingao-bulk-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copiedId === "pingao-bulk-script" ? "Copiado!" : "Copiar Script"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pingao-massa">Codigos UL ou circuitos (um por linha)</Label>
            <Textarea
              id="pingao-massa"
              placeholder={"05-024029-3\nFLA6013700\n11-010157-0"}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runBulkLookup()} disabled={bulkLoading}>
              {bulkLoading ? "Consultando..." : "Consultar em massa"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBulkInput("");
                setBulkMatches([]);
                setBulkError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}

          {bulkView.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Total: {bulkSummary.total}</Badge>
                <Badge variant="default">Prontos: {bulkSummary.ready}</Badge>
                <Badge variant="secondary">Sem IP: {bulkSummary.missingIp}</Badge>
                <Badge variant="outline">Nao encontrados: {bulkSummary.notFound}</Badge>
              </div>

              <div className="rounded-lg border overflow-auto max-h-[360px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Consulta</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Codigo UL</th>
                      <th className="p-2 font-medium">Circuito</th>
                      <th className="p-2 font-medium">IP ({target})</th>
                      <th className="p-2 font-medium">Ping</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkView.map((item, idx) => (
                      <tr key={`${item.query}-${idx}`} className="border-t">
                        <td className="p-2 font-mono">{item.query}</td>
                        <td className="p-2">
                          <Badge
                            variant={item.statusType === "ok" ? "default" : item.statusType === "missing_ip" ? "secondary" : "outline"}
                          >
                            {item.statusText}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono">{item.codUl}</td>
                        <td className="p-2 font-mono">{item.circuito}</td>
                        <td className="p-2 font-mono">{item.ip || "-"}</td>
                        <td className="p-2 font-mono">{item.command || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Script TCL consolidado</Label>
                {bulkTclScript ? (
                  <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[240px] overflow-y-auto">
                    {bulkTclScript}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum IP valido encontrado para gerar script.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Ping99Tab;
