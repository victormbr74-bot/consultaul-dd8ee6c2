import { useMemo, useState } from "react";
import PingExecutionPanel from "@/components/loterica/PingExecutionPanel";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Activity, Download } from "lucide-react";
import {
  dedupeTerms,
  fetchLookupRows,
  parseTerms,
  resolveMatches,
  normalizeText,
  type LotericaLookupRow,
} from "@/components/loterica/lotericaLookup";


type PingStatus = "UP" | "DOWN" | "PERDA DE PACOTE" | "SEM DADOS";
const DEFAULT_PACKET_COUNT = 2;
const MAX_PACKET_COUNT = 20;

interface LookupNatItem {
  query: string;
  status: "ok" | "missing_ip" | "not_found";
  ip: string;
  codUl: string;
  nomeLoterica: string;
}

interface ParsedLinuxPing {
  ip: string;
  sent: number | null;
  received: number | null;
  lossPct: number | null;
  timeMs: number | null;
}

interface AnalyzedNatRow extends ParsedLinuxPing {
  query: string;
  codUl: string;
  nomeLoterica: string;
  status: PingStatus;
  reason: string;
}

const getNatIp = (row: LotericaLookupRow): string => {
  const ip = normalizeText(row.ip_nat);
  const match = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  return match ? match[1] : "";
};

const isIpAddress = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  return match.slice(1, 5).every((o) => { const n = parseInt(o, 10); return n >= 0 && n <= 255; });
};

const statusBadgeClass = (status: PingStatus) => {
  if (status === "UP") return "border-green-500/50 bg-green-500/15 text-green-700 dark:text-green-400";
  if (status === "DOWN") return "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400";
  if (status === "PERDA DE PACOTE") return "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400";
  return "border-muted-foreground/30 bg-muted/20 text-muted-foreground";
};

const normalizeCircuitSpacing = (value: string) => {
  let normalized = value.trim();
  let previous = "";

  // Example: "UDI 5010343" => "UDI5010343"
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized
      .replace(/([A-Za-z])\s+(\d)/g, "$1$2")
      .replace(/(\d)\s+([A-Za-z])/g, "$1$2");
  }

  return normalized;
};

const parsePacketCount = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PACKET_COUNT;
  return Math.min(MAX_PACKET_COUNT, Math.max(1, parsed));
};

const buildPingCommands = (items: LookupNatItem[], packetCount: number): string => {
  const valid = items.filter((i) => i.status === "ok" && i.ip);
  if (!valid.length) return "";

  const timeoutSeconds = Math.max(2, packetCount + 1);

  return valid
    .map(
      (item, idx) =>
        `ping -c ${packetCount} -q -w ${timeoutSeconds} ${item.ip} #### ${item.codUl} #### ${String(idx + 1).padStart(2, "0")}`,
    )
    .join("\n");
};

const parseLinuxPingOutput = (text: string): ParsedLinuxPing[] => {
  const lines = text.split(/\r?\n/);
  const rows: ParsedLinuxPing[] = [];

  let currentIp: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Match "--- X.X.X.X ping statistics ---"
    const statsMatch = line.match(/---\s+(\d{1,3}(?:\.\d{1,3}){3})\s+ping statistics\s+---/);
    if (statsMatch) {
      currentIp = statsMatch[1];
      continue;
    }

    // Match "X packets transmitted, Y received, Z% packet loss, time NNNms"
    if (currentIp) {
      const resultMatch = line.match(
        /(\d+)\s+packets?\s+transmitted,?\s+(\d+)\s+received,?\s+([\d.]+)%\s+packet\s+loss(?:,\s*time\s+(\d+))?/i
      );
      if (resultMatch) {
        rows.push({
          ip: currentIp,
          sent: parseInt(resultMatch[1], 10),
          received: parseInt(resultMatch[2], 10),
          lossPct: parseFloat(resultMatch[3]),
          timeMs: resultMatch[4] ? parseInt(resultMatch[4], 10) : null,
        });
        currentIp = null;
      }
    }
  }

  return rows;
};

const evaluateNatStatus = (row: ParsedLinuxPing): { status: PingStatus; reason: string } => {
  if (row.sent === null || row.received === null) {
    return { status: "SEM DADOS", reason: "Não foi possível identificar resultado." };
  }
  if (row.received === 0) {
    return { status: "DOWN", reason: "Sem respostas ICMP." };
  }
  if (row.lossPct !== null && row.lossPct > 0) {
    return { status: "PERDA DE PACOTE", reason: `Perda de pacote detectada (${row.lossPct}%).` };
  }
  return { status: "UP", reason: "Sem perda de pacote." };
};

const PingaoNatTab = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [packetCountInput, setPacketCountInput] = useState(String(DEFAULT_PACKET_COUNT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [querySummary, setQuerySummary] = useState<LookupNatItem[]>([]);
  const [pingResultInput, setPingResultInput] = useState("");
  const [analysisRows, setAnalysisRows] = useState<AnalyzedNatRow[]>([]);
  const packetCount = useMemo(() => parsePacketCount(packetCountInput), [packetCountInput]);
  const script = useMemo(() => buildPingCommands(querySummary, packetCount), [packetCount, querySummary]);

  const pingSummary = useMemo(() => {
    const total = analysisRows.length;
    const up = analysisRows.filter((r) => r.status === "UP").length;
    const down = analysisRows.filter((r) => r.status === "DOWN").length;
    const loss = analysisRows.filter((r) => r.status === "PERDA DE PACOTE").length;
    const noData = analysisRows.filter((r) => r.status === "SEM DADOS").length;
    return { total, up, down, loss, noData };
  }, [analysisRows]);

  const copy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const runLookup = async () => {
    const terms = dedupeTerms(parseTerms(input));
    if (!terms.length) {
      setError("Informe ao menos um código UL, circuito ou IP.");
      setQuerySummary([]);
      return;
    }

    const directIpTerms = terms.filter((t) => isIpAddress(t));
    const lookupTerms = terms.filter((t) => !isIpAddress(t));

    setLoading(true);
    setError("");

    try {
      const directSummary: LookupNatItem[] = directIpTerms.map((ip) => ({
        query: ip.trim(),
        status: "ok" as const,
        ip: ip.trim(),
        codUl: "-",
        nomeLoterica: "-",
      }));

      let lookupSummary: LookupNatItem[] = [];

      if (lookupTerms.length) {
        const sanitizedTerms = lookupTerms.map((term) => normalizeCircuitSpacing(term));
        const fetchTerms = dedupeTerms([...lookupTerms, ...sanitizedTerms]);

        const rows = await fetchLookupRows(fetchTerms);
        const matches = resolveMatches(lookupTerms, rows);

        lookupSummary = matches.map((match) => {
          if (!match.row) {
            return { query: match.query, status: "not_found" as const, ip: "", codUl: "-", nomeLoterica: "-" };
          }

          const ip = getNatIp(match.row);
          if (!ip) {
            return {
              query: match.query,
              status: "missing_ip" as const,
              ip: "",
              codUl: normalizeText(match.row.cod_ul) || "-",
              nomeLoterica: normalizeText(match.row.nome_loterica) || "-",
            };
          }

          return {
            query: match.query,
            status: "ok" as const,
            ip,
            codUl: normalizeText(match.row.cod_ul) || "-",
            nomeLoterica: normalizeText(match.row.nome_loterica) || "-",
          };
        });
      }

      const summary = [...directSummary, ...lookupSummary];
      setQuerySummary(summary);
    } catch (err) {
      setQuerySummary([]);
      setError(String((err as Error)?.message || err || "Falha ao gerar Pingão NAT."));
    } finally {
      setLoading(false);
    }
  };

  const runPingResultAnalysis = (rawText?: string) => {
    const sourceText = typeof rawText === "string" ? rawText : pingResultInput;
    const parsed = parseLinuxPingOutput(sourceText);

    const ipIndex = new Map<string, LookupNatItem>();
    for (const item of querySummary) {
      if (item.status !== "ok" || !item.ip) continue;
      if (!ipIndex.has(item.ip)) ipIndex.set(item.ip, item);
    }

    const analyzed: AnalyzedNatRow[] = parsed.map((row) => {
      const mapped = ipIndex.get(row.ip);
      const { status, reason } = evaluateNatStatus(row);
      return {
        ...row,
        query: mapped?.query || "-",
        codUl: mapped?.codUl || "-",
        nomeLoterica: mapped?.nomeLoterica || "-",
        status,
        reason,
      };
    });

    setAnalysisRows(analyzed);
  };

  const exportResultXlsx = async () => {
    if (!analysisRows.length) return;
    try {
      const exportRows = analysisRows.map((row) => ({
        "Código UL": row.codUl,
        Consulta: row.query,
        Lotérica: row.nomeLoterica,
        "IP NAT": row.ip,
        "Pacotes Enviados": row.sent ?? "",
        "Pacotes Recebidos": row.received ?? "",
        "Perda (%)": row.lossPct ?? "",
        "Tempo (ms)": row.timeMs ?? "",
        Status: row.status,
        Observação: row.reason,
      }));
      const wb = jsonToWorkbook([{ name: "Pingao NAT Resultado", data: exportRows }]);
      await writeFile(wb, "pingao_nat_resultado.xlsx");
    } catch (err) {
      alert("Falha ao exportar: " + String((err as Error)?.message || err));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" /> Pingao NAT - Gerar Comandos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(script, "pingao-nat-script")} disabled={!script}>
              {copiedId === "pingao-nat-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {copiedId === "pingao-nat-script" ? "Copiado!" : "Copiar Script"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-[220px] space-y-1.5">
            <Label htmlFor="pingao-nat-packet-count">Quantidade de pacotes por IP</Label>
            <Input
              id="pingao-nat-packet-count"
              inputMode="numeric"
              min={1}
              max={MAX_PACKET_COUNT}
              type="number"
              value={packetCountInput}
              onChange={(event) => setPacketCountInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
              onBlur={() => setPacketCountInput(String(packetCount))}
            />
            <p className="text-xs text-muted-foreground">O valor define o parametro `-c` de cada comando ping.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pingao-nat-input">Códigos UL ou circuitos (um por linha)</Label>
            <Textarea
              id="pingao-nat-input"
              placeholder={"21-000666-8\n21-000666-3\n21-000666-5"}
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
                setError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {querySummary.length > 0 && (
            <div className="rounded-lg border overflow-auto max-h-[280px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Consulta</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Código UL</th>
                    <th className="p-2 font-medium">Lotérica</th>
                    <th className="p-2 font-medium">IP NAT</th>
                  </tr>
                </thead>
                <tbody>
                  {querySummary.map((item, idx) => {
                    const text = item.status === "ok" ? "Pronto" : item.status === "missing_ip" ? "Sem IP NAT" : "Não encontrado";
                    const variant = item.status === "ok" ? "default" : item.status === "missing_ip" ? "secondary" : "outline";
                    return (
                      <tr key={`${item.query}-${idx}`} className="border-t align-top">
                        <td className="p-2 font-mono">{item.query}</td>
                        <td className="p-2"><Badge variant={variant}>{text}</Badge></td>
                        <td className="p-2 font-mono">{item.codUl}</td>
                        <td className="p-2">{item.nomeLoterica}</td>
                        <td className="p-2 font-mono">{item.ip || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Comandos de Ping</Label>
            {script ? (
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[260px] overflow-y-auto">
                {script}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum IP NAT válido encontrado para gerar script.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Análise de Resultado do Ping</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void exportResultXlsx()} disabled={!analysisRows.length}>
            <Download className="w-4 h-4 mr-1" /> Exportar XLSX
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ping-nat-result-input">Cole o resultado do ping</Label>
            <Textarea
              id="ping-nat-result-input"
              value={pingResultInput}
              onChange={(e) => setPingResultInput(e.target.value)}
              className="min-h-[190px] font-mono text-xs"
              placeholder={"--- 100.92.114.180 ping statistics ---\n3 packets transmitted, 0 received, 100% packet loss, time 300"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runPingResultAnalysis()}>Analisar resultado</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPingResultInput("");
                setAnalysisRows([]);
              }}
            >
              Limpar
            </Button>
          </div>

          {analysisRows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Total: {pingSummary.total}</Badge>
                <Badge variant="outline" className={statusBadgeClass("UP")}>UP: {pingSummary.up}</Badge>
                <Badge variant="outline" className={statusBadgeClass("DOWN")}>DOWN: {pingSummary.down}</Badge>
                <Badge variant="outline" className={statusBadgeClass("PERDA DE PACOTE")}>Perda: {pingSummary.loss}</Badge>
                <Badge variant="outline" className={statusBadgeClass("SEM DADOS")}>Sem dados: {pingSummary.noData}</Badge>
              </div>

              <div className="rounded-lg border overflow-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Código UL</th>
                      <th className="p-2 font-medium">Lotérica</th>
                      <th className="p-2 font-medium">IP NAT</th>
                      <th className="p-2 font-medium">Enviados</th>
                      <th className="p-2 font-medium">Recebidos</th>
                      <th className="p-2 font-medium">Perda</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisRows.map((row, idx) => (
                      <tr key={`${row.ip}-${idx}`} className="border-t align-top">
                        <td className="p-2 font-mono">{row.codUl}</td>
                        <td className="p-2">{row.nomeLoterica}</td>
                        <td className="p-2 font-mono">{row.ip}</td>
                        <td className="p-2">{row.sent ?? "-"}</td>
                        <td className="p-2">{row.received ?? "-"}</td>
                        <td className="p-2">{row.lossPct !== null ? `${row.lossPct}%` : "-"}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={cn(statusBadgeClass(row.status), "font-semibold")}>
                            {row.status}
                          </Badge>
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

      {/* Execução via Backend */}
      {querySummary.filter(i => i.status === "ok").length === 1 && (
        <PingExecutionPanel
          pageType="pingao_nat"
          host={querySummary.find(i => i.status === "ok")?.ip || ""}
          label="Executar Ping NAT via Backend"
        />
      )}
    </div>
  );
};

export default PingaoNatTab;


