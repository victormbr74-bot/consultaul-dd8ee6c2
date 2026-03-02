import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Activity } from "lucide-react";
import {
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  parseTerms,
  resolveMatches,
  type LinkTarget,
} from "@/components/loterica/lotericaLookup";

const SOURCE_INTERFACE = "gigabitEthernet0/0/1.1090";
const PINGAO_REPEAT = 2;

type LinkProfile = "principal_backup" | "4g" | "vsat";

type PingStatus = "UP" | "DOWN" | "PERDA DE PACOTE" | "ALTA LATENCIA" | "SEM DADOS";

interface ParsedPingRow {
  ip: string;
  successRate: number | null;
  sent: number | null;
  received: number | null;
  lossPct: number | null;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  status: PingStatus;
  reason: string;
}

const LINK_PROFILES: Array<{ id: LinkProfile; label: string; limitMs: number }> = [
  { id: "principal_backup", label: "Principal / Backup (BRISANET)", limitMs: 150 },
  { id: "4g", label: "4G", limitMs: 400 },
  { id: "vsat", label: "VSAT", limitMs: 900 },
];

const padOctet = (value: string) => value.padStart(3, "0");

const parseIpOctets = (value: string) => {
  const fullMatch = value.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!fullMatch) return null;

  const octets = fullMatch.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return null;
  return octets;
};

const buildTclScriptFromIps = (ips: string[]) => {
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
      return `"${padded} source ${SOURCE_INTERFACE} repeat ${PINGAO_REPEAT}"`;
    })
    .join("\n");

  return `tclsh\nforeach add {\n${commands}\n} { ping $add }`;
};

const statusBadgeVariant = (status: PingStatus) => {
  if (status === "UP") return "default" as const;
  if (status === "SEM DADOS") return "outline" as const;
  return "destructive" as const;
};

const parsePingOutput = (text: string, latencyLimit: number): ParsedPingRow[] => {
  const lines = text.split(/\r?\n/);
  const rows: ParsedPingRow[] = [];

  let current: Omit<ParsedPingRow, "status" | "reason"> | null = null;

  const flushCurrent = () => {
    if (!current) return;

    const successRate = current.successRate;
    const sent = current.sent;
    const received = current.received;

    let lossPct = current.lossPct;
    if (lossPct === null) {
      if (typeof sent === "number" && typeof received === "number" && sent > 0) {
        lossPct = Math.max(0, Number((((sent - received) / sent) * 100).toFixed(2)));
      } else if (typeof successRate === "number") {
        lossPct = Math.max(0, Number((100 - successRate).toFixed(2)));
      }
    }

    const latencyRef = current.avgMs ?? current.maxMs ?? null;

    let status: PingStatus = "SEM DADOS";
    let reason = "Nao foi possivel identificar sucesso do ping.";

    if (typeof successRate === "number") {
      if (successRate <= 0 || received === 0) {
        status = "DOWN";
        reason = "Sem respostas ICMP.";
      } else if (typeof lossPct === "number" && lossPct > 0) {
        status = "PERDA DE PACOTE";
        reason = `Perda de pacote detectada (${lossPct}%).`;
      } else if (typeof latencyRef === "number" && latencyRef > latencyLimit) {
        status = "ALTA LATENCIA";
        reason = `Latencia acima do limite (${latencyRef} ms > ${latencyLimit} ms).`;
      } else {
        status = "UP";
        reason = "Sem perda e latencia dentro do limite.";
      }
    }

    rows.push({
      ...current,
      lossPct,
      status,
      reason,
    });

    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sendMatch = line.match(/Sending\s+\d+,\s*\d+-byte ICMP Echos to\s+(\d{1,3}(?:\.\d{1,3}){3})/i);
    if (sendMatch) {
      flushCurrent();
      current = {
        ip: sendMatch[1],
        successRate: null,
        sent: null,
        received: null,
        lossPct: null,
        minMs: null,
        avgMs: null,
        maxMs: null,
      };
      continue;
    }

    if (!current) continue;

    const successMatch = line.match(/Success\s+rate\s+is\s+(\d+)\s*percent\s*\((\d+)\/(\d+)\)/i);
    if (successMatch) {
      current.successRate = Number.parseInt(successMatch[1], 10);
      current.received = Number.parseInt(successMatch[2], 10);
      current.sent = Number.parseInt(successMatch[3], 10);
      current.lossPct = current.sent > 0
        ? Math.max(0, Number((((current.sent - current.received) / current.sent) * 100).toFixed(2)))
        : null;
    }

    const latencyMatch = line.match(/round-trip\s+min\/avg\/max(?:\/\w+)?\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i);
    if (latencyMatch) {
      current.minMs = Number.parseFloat(latencyMatch[1]);
      current.avgMs = Number.parseFloat(latencyMatch[2]);
      current.maxMs = Number.parseFloat(latencyMatch[3]);
    }
  }

  flushCurrent();
  return rows;
};

const PingaoTab = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [target, setTarget] = useState<LinkTarget>("primario");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [querySummary, setQuerySummary] = useState<Array<{ query: string; status: "ok" | "missing_ip" | "not_found"; ip: string }>>([]);
  const [script, setScript] = useState("");

  const [profile, setProfile] = useState<LinkProfile>("principal_backup");
  const [pingResultInput, setPingResultInput] = useState("");
  const [pingRows, setPingRows] = useState<ParsedPingRow[]>([]);

  const selectedProfile = useMemo(() => {
    return LINK_PROFILES.find((item) => item.id === profile) || LINK_PROFILES[0];
  }, [profile]);

  const pingSummary = useMemo(() => {
    const total = pingRows.length;
    const up = pingRows.filter((row) => row.status === "UP").length;
    const down = pingRows.filter((row) => row.status === "DOWN").length;
    const loss = pingRows.filter((row) => row.status === "PERDA DE PACOTE").length;
    const highLatency = pingRows.filter((row) => row.status === "ALTA LATENCIA").length;
    const noData = pingRows.filter((row) => row.status === "SEM DADOS").length;

    return { total, up, down, loss, highLatency, noData };
  }, [pingRows]);

  const copy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  };

  const runLookup = async () => {
    const terms = dedupeTerms(parseTerms(input));
    if (!terms.length) {
      setError("Informe ao menos um codigo UL ou circuito.");
      setQuerySummary([]);
      setScript("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await fetchLookupRows(terms);
      const matches = resolveMatches(terms, rows);

      const summary = matches.map((match) => {
        if (!match.row) {
          return { query: match.query, status: "not_found" as const, ip: "" };
        }

        const ip = getLookupIp(match.row, target);
        if (!ip) {
          return { query: match.query, status: "missing_ip" as const, ip: "" };
        }

        return { query: match.query, status: "ok" as const, ip };
      });

      setQuerySummary(summary);
      setScript(buildTclScriptFromIps(summary.map((item) => item.ip).filter(Boolean)));
    } catch (lookupError) {
      setQuerySummary([]);
      setScript("");
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao gerar Pingao."));
    } finally {
      setLoading(false);
    }
  };

  const runPingResultAnalysis = () => {
    const rows = parsePingOutput(pingResultInput, selectedProfile.limitMs);
    setPingRows(rows);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" /> Pingao - Gerar Script TCL
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(script, "pingao-script")} disabled={!script}>
            {copiedId === "pingao-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copiedId === "pingao-script" ? "Copiado!" : "Copiar Script"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecionar IP para montar o Pingao</Label>
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
            <Label htmlFor="pingao-input">Codigos UL ou circuitos (um por linha)</Label>
            <Textarea
              id="pingao-input"
              placeholder={"21-000666-8\n21-000666-3\n21-000666-5\n21-000666-1"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runLookup()} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Script"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInput("");
                setQuerySummary([]);
                setScript("");
                setError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {querySummary.length > 0 && (
            <div className="rounded-lg border overflow-auto max-h-[260px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Consulta</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {querySummary.map((item, idx) => {
                    const text = item.status === "ok" ? "Pronto" : item.status === "missing_ip" ? "Sem IP" : "Nao encontrado";
                    const variant = item.status === "ok" ? "default" : item.status === "missing_ip" ? "secondary" : "outline";
                    return (
                      <tr key={`${item.query}-${idx}`} className="border-t">
                        <td className="p-2 font-mono">{item.query}</td>
                        <td className="p-2"><Badge variant={variant}>{text}</Badge></td>
                        <td className="p-2 font-mono">{item.ip || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Script TCL do Pingao</Label>
            {script ? (
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[260px] overflow-y-auto">
                {script}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum IP valido encontrado para gerar script.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analise de Resultado do Ping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Perfil de latencia</Label>
            <RadioGroup
              value={profile}
              onValueChange={(value) => setProfile(value as LinkProfile)}
              className="grid gap-2 md:grid-cols-3"
            >
              {LINK_PROFILES.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded border p-2">
                  <RadioGroupItem value={item.id} id={`profile-${item.id}`} />
                  <Label htmlFor={`profile-${item.id}`} className="text-xs">
                    {item.label} ({">"} {item.limitMs} ms)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ping-result-input">Cole o resultado do ping</Label>
            <Textarea
              id="ping-result-input"
              value={pingResultInput}
              onChange={(e) => setPingResultInput(e.target.value)}
              className="min-h-[170px] font-mono text-xs"
              placeholder="Type escape sequence to abort.\nSending 2, 100-byte ICMP Echos to 10.50.143.98..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runPingResultAnalysis}>Analisar resultado</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPingResultInput("");
                setPingRows([]);
              }}
            >
              Limpar
            </Button>
          </div>

          {pingRows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Total: {pingSummary.total}</Badge>
                <Badge variant="default">UP: {pingSummary.up}</Badge>
                <Badge variant="destructive">DOWN: {pingSummary.down}</Badge>
                <Badge variant="destructive">Perda: {pingSummary.loss}</Badge>
                <Badge variant="destructive">Alta latencia: {pingSummary.highLatency}</Badge>
                <Badge variant="outline">Sem dados: {pingSummary.noData}</Badge>
              </div>

              <div className="rounded-lg border overflow-auto max-h-[360px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">IP</th>
                      <th className="p-2 font-medium">Sucesso</th>
                      <th className="p-2 font-medium">Perda</th>
                      <th className="p-2 font-medium">Latencia (min/avg/max)</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Observacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pingRows.map((row, idx) => (
                      <tr key={`${row.ip}-${idx}`} className="border-t align-top">
                        <td className="p-2 font-mono">{row.ip}</td>
                        <td className="p-2">{row.successRate !== null ? `${row.successRate}%` : "-"}</td>
                        <td className="p-2">{row.lossPct !== null ? `${row.lossPct}%` : "-"}</td>
                        <td className="p-2 font-mono">
                          {row.minMs !== null && row.avgMs !== null && row.maxMs !== null
                            ? `${row.minMs}/${row.avgMs}/${row.maxMs} ms`
                            : "-"}
                        </td>
                        <td className="p-2">
                          <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                        </td>
                        <td className="p-2">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PingaoTab;
