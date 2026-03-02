import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Wifi } from "lucide-react";
import {
  buildLookupDisplay,
  dedupeTerms,
  fetchLookupRows,
  parseTerms,
  resolveMatches,
  type LinkTarget,
  type TermMatch,
} from "@/components/loterica/lotericaLookup";

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

const SEQUENCE_SIZE = 16;
const SOURCE_INTERFACE = "gigabitEthernet0/0/1.1090";
const PING99_REPEAT = 1;
const PINGAO_REPEAT = 2;

const REDE_LAN_KEYS = ["REDE LAN", "REDE_LAN", "rede lan", "rede_lan", "REDELAN", "LAN"] as const;

const padOctet = (value: string) => value.padStart(3, "0");
const normalizeText = (value: unknown) => String(value ?? "").trim();

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

const parseIpOctets = (value: string) => {
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

const buildPingCommand = (ip: string) => {
  return `ping ${ip} source ${SOURCE_INTERFACE} repeat ${PINGAO_REPEAT}`;
};

const buildTclScriptFromIps = (ips: string[], repeat = PINGAO_REPEAT) => {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const ip of ips) {
    const octets = parseIpOctets(ip);
    if (!octets) continue;
    const normalized = octets.join(".");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  if (!unique.length) return "";

  const commands = unique
    .map((ip) => {
      const padded = ip
        .split(".")
        .map((octet) => padOctet(octet))
        .join(".");
      return `"${padded} source ${SOURCE_INTERFACE} repeat ${repeat}"`;
    })
    .join("\n");

  return `tclsh
foreach add {
${commands}
} { ping $add }`;
};

const Ping99Tab = ({ form }: Ping99TabProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [target, setTarget] = useState<LinkTarget>("primario");
  const [pingaoInput, setPingaoInput] = useState("");
  const [pingaoLoading, setPingaoLoading] = useState(false);
  const [pingaoError, setPingaoError] = useState("");
  const [pingaoMatches, setPingaoMatches] = useState<TermMatch[]>([]);

  const raw = useMemo(
    () => ((form?.raw_data && typeof form.raw_data === "object") ? (form.raw_data as Record<string, unknown>) : {}),
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

  const pingaoRows = useMemo(() => {
    return pingaoMatches.map((item) => {
      const baseRow = buildLookupDisplay(item, target);
      return {
        ...baseRow,
        command: baseRow.ip ? buildPingCommand(baseRow.ip) : "",
      };
    });
  }, [pingaoMatches, target]);

  const pingaoSummary = useMemo(() => {
    const ready = pingaoRows.filter((row) => row.statusType === "ok").length;
    const missingIp = pingaoRows.filter((row) => row.statusType === "missing_ip").length;
    const notFound = pingaoRows.filter((row) => row.statusType === "not_found").length;

    return {
      total: pingaoRows.length,
      ready,
      missingIp,
      notFound,
    };
  }, [pingaoRows]);

  const pingaoScript = useMemo(() => {
    return buildTclScriptFromIps(pingaoRows.map((row) => row.ip).filter(Boolean));
  }, [pingaoRows]);

  const copy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  };

  const runPingaoLookup = async () => {
    const terms = dedupeTerms(parseTerms(pingaoInput));
    if (!terms.length) {
      setPingaoError("Informe ao menos um codigo UL ou circuito.");
      setPingaoMatches([]);
      return;
    }

    setPingaoLoading(true);
    setPingaoError("");

    try {
      const rows = await fetchLookupRows(terms);
      const matches = resolveMatches(terms, rows);
      setPingaoMatches(matches);
    } catch (error) {
      setPingaoMatches([]);
      setPingaoError(String((error as Error)?.message || error || "Falha na consulta do Pingao."));
    } finally {
      setPingaoLoading(false);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Pingao (multiplos codigos/circuitos)</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(pingaoScript, "pingao-script")} disabled={!pingaoScript}>
            {copiedId === "pingao-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copiedId === "pingao-script" ? "Copiado!" : "Copiar Script"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-1.5">
            <Label htmlFor="pingao-massa">Codigos UL ou circuitos (um por linha)</Label>
            <Textarea
              id="pingao-massa"
              placeholder={"21-000666-8\n21-000666-3\n21-000666-5\n21-000666-1"}
              value={pingaoInput}
              onChange={(e) => setPingaoInput(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runPingaoLookup()} disabled={pingaoLoading}>
              {pingaoLoading ? "Consultando..." : "Gerar Pingao"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPingaoInput("");
                setPingaoMatches([]);
                setPingaoError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {pingaoError ? <p className="text-sm text-destructive">{pingaoError}</p> : null}

          {pingaoRows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Total: {pingaoSummary.total}</Badge>
                <Badge variant="default">Prontos: {pingaoSummary.ready}</Badge>
                <Badge variant="secondary">Sem IP: {pingaoSummary.missingIp}</Badge>
                <Badge variant="outline">Nao encontrados: {pingaoSummary.notFound}</Badge>
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
                    {pingaoRows.map((row, idx) => (
                      <tr key={`${row.query}-${idx}`} className="border-t">
                        <td className="p-2 font-mono">{row.query}</td>
                        <td className="p-2">
                          <Badge
                            variant={row.statusType === "ok" ? "default" : row.statusType === "missing_ip" ? "secondary" : "outline"}
                          >
                            {row.statusText}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono">{row.codUl}</td>
                        <td className="p-2 font-mono">{row.circuito}</td>
                        <td className="p-2 font-mono">{row.ip || "-"}</td>
                        <td className="p-2 font-mono">{row.command || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Script TCL do Pingao</Label>
                {pingaoScript ? (
                  <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[240px] overflow-y-auto">
                    {pingaoScript}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum IP valido encontrado para gerar script.</p>
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
