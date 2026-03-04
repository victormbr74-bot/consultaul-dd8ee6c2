import { useMemo, useState } from "react";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Activity, Download } from "lucide-react";
import {
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  parseTerms,
  resolveMatches,
  normalizeText,
  type LinkTarget,
  type MatchField,
  type LotericaLookupRow,
} from "@/components/loterica/lotericaLookup";


const SOURCE_INTERFACE = "gigabitEthernet0/0/1.1090";
const PINGAO_REPEAT = 2;

type LinkProfile = "principal_backup" | "4g" | "vsat";
type PingStatus = "UP" | "DOWN" | "PERDA DE PACOTE" | "ALTA LATENCIA" | "SEM DADOS";
type LookupMode = "auto" | "cod_ul" | "ccto";

type LookupStatus = "ok" | "missing_ip" | "not_found";

interface LookupSummaryItem {
  query: string;
  status: LookupStatus;
  ip: string;
  codUl: string;
  profile: LinkProfile;
  profileLabel: string;
  limitMs: number;
  techSource: string;
  matchedBy: MatchField | null;
}

interface ParsedPingMetrics {
  ip: string;
  successRate: number | null;
  sent: number | null;
  received: number | null;
  lossPct: number | null;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
}

interface AnalyzedPingRow extends ParsedPingMetrics {
  query: string;
  codUl: string;
  profileLabel: string;
  limitMs: number;
  status: PingStatus;
  reason: string;
}

const PROFILE_LIMITS: Record<LinkProfile, number> = {
  principal_backup: 150,
  "4g": 400,
  vsat: 900,
};

const PROFILE_LABELS: Record<LinkProfile, string> = {
  principal_backup: "Principal / Backup",
  "4g": "4G",
  vsat: "VSAT",
};

const LOOKUP_MODE_FIELDS: Record<LookupMode, MatchField[]> = {
  auto: ["cod_ul", "ccto_oi", "ccto_oemp", "designacao_nova"],
  cod_ul: ["cod_ul"],
  ccto: ["ccto_oi", "ccto_oemp"],
};

const MATCH_FIELD_LABELS: Record<MatchField, string> = {
  cod_ul: "Codigo UL",
  ccto_oi: "CCTO OI",
  ccto_oemp: "CCTO OEMP",
  designacao_nova: "Designacao",
};

const padOctet = (value: string) => value.padStart(3, "0");

const toUpperNoAccent = (value: unknown) => {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};

const isMeaningfulValue = (value: unknown) => {
  const normalized = toUpperNoAccent(value);
  if (!normalized) return false;
  if (["-", "N/A", "NA", "0", "[OBJECT OBJECT]", "NULL", "UNDEFINED", "NAO OEMP"].includes(normalized)) {
    return false;
  }
  return true;
};

const readRawByAliases = (row: LotericaLookupRow, aliases: string[]) => {
  const raw = row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};

  const exactMap = new Map<string, unknown>();
  const looseMap = new Map<string, unknown>();

  for (const [key, value] of Object.entries(raw)) {
    const exact = key.trim().toUpperCase();
    const loose = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (exact && !exactMap.has(exact)) exactMap.set(exact, value);
    if (loose && !looseMap.has(loose)) looseMap.set(loose, value);
  }

  for (const alias of aliases) {
    const exact = alias.trim().toUpperCase();
    const loose = alias
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    const exactHit = exactMap.get(exact);
    if (exactHit !== undefined && exactHit !== null && normalizeText(exactHit)) return normalizeText(exactHit);

    const looseHit = looseMap.get(loose);
    if (looseHit !== undefined && looseHit !== null && normalizeText(looseHit)) return normalizeText(looseHit);
  }

  return "";
};

const detectLatencyProfile = (row: LotericaLookupRow, target: LinkTarget) => {
  const tecnologia = readRawByAliases(row, ["TECNOLOGIA"]);
  const perimetro = readRawByAliases(row, ["PERIMETRO", "PERÍMETRO", "PERIMETRO"]);
  const operadora4g = readRawByAliases(row, ["OPERADORA 4G", "OPERADORA"]);
  const vsat = readRawByAliases(row, ["VSAT"]);
  const sim4g = readRawByAliases(row, ["SIM CARD 4G"]);

  const signalParts = [
    tecnologia,
    perimetro,
    operadora4g || row.operadora || "",
    vsat,
    sim4g,
    target === "primario" ? row.ccto_oi : row.ccto_oemp,
  ].filter(Boolean);

  const signalText = signalParts.join(" | ");
  const signal = toUpperNoAccent(signalText);

  const hasVSAT = signal.includes("VSAT") || isMeaningfulValue(vsat);
  const hasBrisanet = signal.includes("BRISANET");
  const has4GKeyword =
    signal.includes("4G") ||
    signal.includes("ARQIA") ||
    signal.includes("TIM") ||
    signal.includes("VIVO") ||
    signal.includes("CLARO");

  const has4GSim = isMeaningfulValue(sim4g);

  if (hasVSAT) {
    return {
      profile: "vsat" as const,
      profileLabel: PROFILE_LABELS.vsat,
      limitMs: PROFILE_LIMITS.vsat,
      techSource: signalText || "VSAT",
    };
  }

  if (hasBrisanet) {
    return {
      profile: "principal_backup" as const,
      profileLabel: "Backup BRISANET",
      limitMs: PROFILE_LIMITS.principal_backup,
      techSource: signalText || "BRISANET",
    };
  }

  if (target === "secundario" && (has4GKeyword || has4GSim)) {
    return {
      profile: "4g" as const,
      profileLabel: PROFILE_LABELS["4g"],
      limitMs: PROFILE_LIMITS["4g"],
      techSource: signalText || "4G",
    };
  }

  return {
    profile: "principal_backup" as const,
    profileLabel: PROFILE_LABELS.principal_backup,
    limitMs: PROFILE_LIMITS.principal_backup,
    techSource: signalText || "Principal/Backup",
  };
};

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

const parsePingOutput = (text: string): ParsedPingMetrics[] => {
  const lines = text.split(/\r?\n/);
  const rows: ParsedPingMetrics[] = [];

  let current: ParsedPingMetrics | null = null;

  const flushCurrent = () => {
    if (!current) return;

    let lossPct = current.lossPct;
    if (lossPct === null) {
      if (typeof current.sent === "number" && typeof current.received === "number" && current.sent > 0) {
        lossPct = Math.max(0, Number((((current.sent - current.received) / current.sent) * 100).toFixed(2)));
      } else if (typeof current.successRate === "number") {
        lossPct = Math.max(0, Number((100 - current.successRate).toFixed(2)));
      }
    }

    rows.push({ ...current, lossPct });
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

const evaluateStatus = (row: ParsedPingMetrics, limitMs: number): { status: PingStatus; reason: string } => {
  const latencyRef = row.avgMs ?? row.maxMs ?? null;

  if (typeof row.successRate !== "number") {
    return { status: "SEM DADOS", reason: "Nao foi possivel identificar sucesso do ping." };
  }

  if (row.successRate <= 0 || row.received === 0) {
    return { status: "DOWN", reason: "Sem respostas ICMP." };
  }

  if (typeof row.lossPct === "number" && row.lossPct > 0) {
    return { status: "PERDA DE PACOTE", reason: `Perda de pacote detectada (${row.lossPct}%).` };
  }

  if (typeof latencyRef === "number" && latencyRef > limitMs) {
    return {
      status: "ALTA LATENCIA",
      reason: `Latencia acima do limite (${latencyRef} ms > ${limitMs} ms).`,
    };
  }

  return { status: "UP", reason: "Sem perda e latencia dentro do limite." };
};

const statusBadgeClass = (status: PingStatus) => {
  if (status === "UP") {
    return "border-green-500/50 bg-green-500/15 text-green-700 dark:text-green-400";
  }
  if (status === "DOWN") {
    return "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400";
  }
  if (status === "PERDA DE PACOTE" || status === "ALTA LATENCIA") {
    return "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400";
  }
  return "border-muted-foreground/30 bg-muted/20 text-muted-foreground";
};

const PingaoTab = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [target, setTarget] = useState<LinkTarget>("primario");
  const [lookupMode, setLookupMode] = useState<LookupMode>("auto");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [querySummary, setQuerySummary] = useState<LookupSummaryItem[]>([]);
  const [script, setScript] = useState("");

  const [pingResultInput, setPingResultInput] = useState("");
  const [analysisRows, setAnalysisRows] = useState<AnalyzedPingRow[]>([]);

  const pingSummary = useMemo(() => {
    const total = analysisRows.length;
    const up = analysisRows.filter((row) => row.status === "UP").length;
    const down = analysisRows.filter((row) => row.status === "DOWN").length;
    const loss = analysisRows.filter((row) => row.status === "PERDA DE PACOTE").length;
    const highLatency = analysisRows.filter((row) => row.status === "ALTA LATENCIA").length;
    const noData = analysisRows.filter((row) => row.status === "SEM DADOS").length;

    return { total, up, down, loss, highLatency, noData };
  }, [analysisRows]);

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
      const fields = LOOKUP_MODE_FIELDS[lookupMode];
      const rows = await fetchLookupRows(terms, { fields });
      const matches = resolveMatches(terms, rows, { fields });

      const summary: LookupSummaryItem[] = matches.map((match) => {
        if (!match.row) {
          return {
            query: match.query,
            status: "not_found",
            ip: "",
            codUl: "-",
            profile: "principal_backup",
            profileLabel: "Nao identificado",
            limitMs: PROFILE_LIMITS.principal_backup,
            techSource: "-",
            matchedBy: null,
          };
        }

        const ip = getLookupIp(match.row, target);
        const profileData = detectLatencyProfile(match.row, target);

        if (!ip) {
          return {
            query: match.query,
            status: "missing_ip",
            ip: "",
            codUl: normalizeText(match.row.cod_ul) || "-",
            profile: profileData.profile,
            profileLabel: profileData.profileLabel,
            limitMs: profileData.limitMs,
            techSource: profileData.techSource,
            matchedBy: match.matchField ?? null,
          };
        }

        return {
          query: match.query,
          status: "ok",
          ip,
          codUl: normalizeText(match.row.cod_ul) || "-",
          profile: profileData.profile,
          profileLabel: profileData.profileLabel,
          limitMs: profileData.limitMs,
          techSource: profileData.techSource,
          matchedBy: match.matchField ?? null,
        };
      });

      setQuerySummary(summary);
      setScript(buildTclScriptFromIps(summary.filter((item) => item.status === "ok").map((item) => item.ip)));
    } catch (lookupError) {
      setQuerySummary([]);
      setScript("");
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao gerar Pingao."));
    } finally {
      setLoading(false);
    }
  };

  const runPingResultAnalysis = (rawText?: string) => {
    const sourceText = typeof rawText === "string" ? rawText : pingResultInput;
    const parsed = parsePingOutput(sourceText);

    const ipIndex = new Map<string, LookupSummaryItem>();
    for (const item of querySummary) {
      if (item.status !== "ok" || !item.ip) continue;
      if (!ipIndex.has(item.ip)) ipIndex.set(item.ip, item);
    }

    const analyzed = parsed.map((row) => {
      const mapped = ipIndex.get(row.ip);
      const limitMs = mapped?.limitMs ?? PROFILE_LIMITS.principal_backup;
      const { status, reason } = evaluateStatus(row, limitMs);

      return {
        ...row,
        query: mapped?.query || "-",
        codUl: mapped?.codUl || "-",
        profileLabel: mapped?.profileLabel || "Padrao",
        limitMs,
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
        "Codigo UL": row.codUl,
        "Consulta": row.query,
        "IP": row.ip,
        "Perfil Latencia": row.profileLabel,
        "Limite (ms)": row.limitMs,
        "Sucesso (%)": row.successRate ?? "",
        "Pacotes Recebidos": row.received ?? "",
        "Pacotes Enviados": row.sent ?? "",
        "Perda (%)": row.lossPct ?? "",
        "Latencia Min (ms)": row.minMs ?? "",
        "Latencia Avg (ms)": row.avgMs ?? "",
        "Latencia Max (ms)": row.maxMs ?? "",
        "Status": row.status,
        "Observacao": row.reason,
      }));

      const wb = jsonToWorkbook([{ name: "Pingao Resultado", data: exportRows }]);
      await writeFile(wb, "pingao_resultado.xlsx");
    } catch (exportError) {
      alert("Falha ao exportar resultado: " + String((exportError as Error)?.message || exportError));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" /> Pingao - Gerar Script TCL
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(script, "pingao-script")} disabled={!script}>
              {copiedId === "pingao-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {copiedId === "pingao-script" ? "Copiado!" : "Copiar Script"}
            </Button>
          </div>
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

          <div className="space-y-2">
            <Label>Buscar por</Label>
            <RadioGroup
              value={lookupMode}
              onValueChange={(value) => setLookupMode(value as LookupMode)}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="pingao-lookup-auto" />
                <Label htmlFor="pingao-lookup-auto">Automatico (UL + CCTO)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cod_ul" id="pingao-lookup-ul" />
                <Label htmlFor="pingao-lookup-ul">Codigo UL</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ccto" id="pingao-lookup-ccto" />
                <Label htmlFor="pingao-lookup-ccto">CCTO (OI/OEMP)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pingao-input">Codigos UL ou CCTO (um por linha)</Label>
            <Textarea
              id="pingao-input"
              placeholder={"21-000666-8\n21-000666-3\n21-000666-5\n219123456789"}
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
            <div className="rounded-lg border overflow-auto max-h-[280px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Consulta</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Codigo UL</th>
                    <th className="p-2 font-medium">IP</th>
                    <th className="p-2 font-medium">Encontrado por</th>
                    <th className="p-2 font-medium">Perfil</th>
                    <th className="p-2 font-medium">Limite</th>
                  </tr>
                </thead>
                <tbody>
                  {querySummary.map((item, idx) => {
                    const text = item.status === "ok" ? "Pronto" : item.status === "missing_ip" ? "Sem IP" : "Nao encontrado";
                    const variant = item.status === "ok" ? "default" : item.status === "missing_ip" ? "secondary" : "outline";
                    return (
                      <tr key={`${item.query}-${idx}`} className="border-t align-top">
                        <td className="p-2 font-mono">{item.query}</td>
                        <td className="p-2"><Badge variant={variant}>{text}</Badge></td>
                        <td className="p-2 font-mono">{item.codUl}</td>
                        <td className="p-2 font-mono">{item.ip || "-"}</td>
                        <td className="p-2">{item.matchedBy ? MATCH_FIELD_LABELS[item.matchedBy] : "-"}</td>
                        <td className="p-2">{item.profileLabel}</td>
                        <td className="p-2 font-mono">{item.limitMs} ms</td>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Analise de Resultado do Ping</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void exportResultXlsx()} disabled={!analysisRows.length}>
            <Download className="w-4 h-4 mr-1" /> Exportar XLSX
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ping-result-input">Cole o resultado do ping</Label>
            <Textarea
              id="ping-result-input"
              value={pingResultInput}
              onChange={(e) => setPingResultInput(e.target.value)}
              className="min-h-[190px] font-mono text-xs"
              placeholder="Type escape sequence to abort.\nSending 2, 100-byte ICMP Echos to 10.50.143.98..."
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
                <Badge variant="outline" className={statusBadgeClass("ALTA LATENCIA")}>Alta latencia: {pingSummary.highLatency}</Badge>
                <Badge variant="outline" className={statusBadgeClass("SEM DADOS")}>Sem dados: {pingSummary.noData}</Badge>
              </div>

              <div className="rounded-lg border overflow-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Codigo UL</th>
                      <th className="p-2 font-medium">IP</th>
                      <th className="p-2 font-medium">Perfil</th>
                      <th className="p-2 font-medium">Sucesso</th>
                      <th className="p-2 font-medium">Perda</th>
                      <th className="p-2 font-medium">Latencia (min/avg/max)</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Observacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisRows.map((row, idx) => (
                      <tr key={`${row.ip}-${idx}`} className="border-t align-top">
                        <td className="p-2 font-mono">{row.codUl}</td>
                        <td className="p-2 font-mono">{row.ip}</td>
                        <td className="p-2">{row.profileLabel} ({row.limitMs} ms)</td>
                        <td className="p-2">{row.successRate !== null ? `${row.successRate}%` : "-"}</td>
                        <td className="p-2">{row.lossPct !== null ? `${row.lossPct}%` : "-"}</td>
                        <td className="p-2 font-mono">
                          {row.minMs !== null && row.avgMs !== null && row.maxMs !== null
                            ? `${row.minMs}/${row.avgMs}/${row.maxMs} ms`
                            : "-"}
                        </td>
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
    </div>
  );
};

export default PingaoTab;
