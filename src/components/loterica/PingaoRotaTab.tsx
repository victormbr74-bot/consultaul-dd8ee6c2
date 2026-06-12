import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Check, Route, Download } from "lucide-react";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { cn } from "@/lib/utils";
import {
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  parseTerms,
  resolveMatches,
  normalizeText,
  type MatchField,
  type LotericaLookupRow,
} from "@/components/loterica/lotericaLookup";
import { parseRouteUptime, uptimeToDate, formatDateTime } from "@/lib/routeUptime";

type LookupMode = "auto" | "cod_ul" | "ccto" | "ip";
type LinkChoice = "primario" | "secundario" | "ambos";

interface RotaTarget {
  query: string;
  codUl: string;
  nome: string;
  ip: string;
  link: "primario" | "secundario" | "direto";
  matchedBy: MatchField | null;
  status: "ok" | "missing_ip" | "not_found";
}

interface AnalyzedRotaRow {
  ip: string;
  codUl: string;
  nome: string;
  link: string;
  tempoRota: string;
  dataRota: string;
  totalSeconds: number;
  status: "OK" | "SEM ROTA" | "NAO RECONHECIDO";
}

const LOOKUP_MODE_FIELDS: Record<Exclude<LookupMode, "ip">, MatchField[]> = {
  auto: ["cod_ul", "ccto_oi", "ccto_oemp", "designacao_nova"],
  cod_ul: ["cod_ul"],
  ccto: ["ccto_oi", "ccto_oemp"],
};

const isIp = (value: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(value.trim());

const buildRouteCommand = (ip: string) => `sh ip route | inc   ${ip}/32`;

const PingaoRotaTab = () => {
  const [input, setInput] = useState("");
  const [lookupMode, setLookupMode] = useState<LookupMode>("auto");
  const [linkChoice, setLinkChoice] = useState<LinkChoice>("primario");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targets, setTargets] = useState<RotaTarget[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [pasted, setPasted] = useState("");
  const [analysisRows, setAnalysisRows] = useState<AnalyzedRotaRow[]>([]);
  const [showOnlyAbove24h, setShowOnlyAbove24h] = useState(false);

  const validTargets = useMemo(() => targets.filter((t) => t.status === "ok" && t.ip), [targets]);

  const commandsScript = useMemo(
    () => validTargets.map((t) => buildRouteCommand(t.ip)).join("\n"),
    [validTargets],
  );

  const copy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const runLookup = async () => {
    const terms = dedupeTerms(parseTerms(input));
    if (!terms.length) {
      setError("Informe ao menos um codigo UL, circuito ou IP.");
      setTargets([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const directIpTerms = terms.filter(isIp);
      const lookupTerms = terms.filter((t) => !isIp(t));

      const directs: RotaTarget[] = directIpTerms.map((ip) => ({
        query: ip,
        codUl: "-",
        nome: "-",
        ip: ip.trim(),
        link: "direto",
        matchedBy: null,
        status: "ok",
      }));

      let resolved: RotaTarget[] = [];

      if (lookupTerms.length && lookupMode !== "ip") {
        const fields = LOOKUP_MODE_FIELDS[lookupMode];
        const rows = await fetchLookupRows(lookupTerms, { fields });
        const matches = resolveMatches(lookupTerms, rows, { fields });

        const wantPrim = linkChoice === "primario" || linkChoice === "ambos";
        const wantSec = linkChoice === "secundario" || linkChoice === "ambos";

        resolved = matches.flatMap((match): RotaTarget[] => {
          if (!match.row) {
            return [
              {
                query: match.query,
                codUl: "-",
                nome: "-",
                ip: "",
                link: "primario",
                matchedBy: null,
                status: "not_found",
              },
            ];
          }
          const row = match.row as LotericaLookupRow;
          const out: RotaTarget[] = [];
          const codUl = normalizeText(row.cod_ul) || "-";
          const nome = normalizeText(row.nome_loterica) || "-";

          if (wantPrim) {
            const ip = getLookupIp(row, "primario");
            out.push({
              query: match.query,
              codUl,
              nome,
              ip,
              link: "primario",
              matchedBy: match.matchField ?? null,
              status: ip ? "ok" : "missing_ip",
            });
          }
          if (wantSec) {
            const ip = getLookupIp(row, "secundario");
            out.push({
              query: match.query,
              codUl,
              nome,
              ip,
              link: "secundario",
              matchedBy: match.matchField ?? null,
              status: ip ? "ok" : "missing_ip",
            });
          }
          return out;
        });
      }

      setTargets([...directs, ...resolved]);
    } catch (err) {
      setTargets([]);
      setError(String((err as Error)?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = () => {
    const now = new Date();
    const indexByIp = new Map<string, RotaTarget>();
    for (const t of validTargets) {
      if (!indexByIp.has(t.ip)) indexByIp.set(t.ip, t);
    }

    const results: AnalyzedRotaRow[] = [];
    const seen = new Set<string>();

    // Try to match each target IP in the pasted text
    for (const target of validTargets) {
      const escaped = target.ip.replace(/\./g, "\\.");
      const key = `${target.ip}|${target.link}`;
      seen.add(key);

      // Find ALL lines containing IP/32 and pick the route line (has "via"),
      // ignoring command-echo lines like "...#sh ip route | inc   10.x.x.x/32"
      const lineRegex = new RegExp(`^[^\\n]*\\b${escaped}/32\\b[^\\n]*$`, "gim");
      const candidates = pasted.match(lineRegex) ?? [];
      const routeLine = candidates
        .map((l) => l.trim())
        .find((l) => /\bvia\b/i.test(l) && !/#\s*sh\s+ip\s+route/i.test(l) && !/\|/.test(l));

      if (!routeLine) {
        results.push({
          ip: target.ip,
          codUl: target.codUl,
          nome: target.nome,
          link: target.link,
          tempoRota: "-",
          dataRota: "-",
          totalSeconds: 0,
          status: "SEM ROTA",
        });
        continue;
      }

      // last whitespace/comma separated token of the route line
      const tokens = routeLine.split(/[\s,]+/).filter(Boolean);
      const last = tokens[tokens.length - 1] ?? "";
      const parsed = parseRouteUptime(last);

      if (!parsed) {
        results.push({
          ip: target.ip,
          codUl: target.codUl,
          nome: target.nome,
          link: target.link,
          tempoRota: last || "-",
          dataRota: "-",
          totalSeconds: 0,
          status: "NAO RECONHECIDO",
        });
        continue;
      }

      const installed = uptimeToDate(last, now)!;
      results.push({
        ip: target.ip,
        codUl: target.codUl,
        nome: target.nome,
        link: target.link,
        tempoRota: parsed.raw,
        dataRota: formatDateTime(installed),
        totalSeconds: parsed.totalSeconds,
        status: "OK",
      });
    }

    setAnalysisRows(results);
  };

  const displayedRows = useMemo(
    () => (showOnlyAbove24h ? analysisRows.filter((r) => r.totalSeconds >= 86400) : analysisRows),
    [analysisRows, showOnlyAbove24h],
  );

  const above24hCount = useMemo(
    () => analysisRows.filter((r) => r.totalSeconds >= 86400).length,
    [analysisRows],
  );

  const exportXlsx = async () => {
    const source = showOnlyAbove24h ? displayedRows : analysisRows;
    if (!source.length) return;
    try {
      const data = source.map((r) => ({
        "Codigo UL": r.codUl,
        Nome: r.nome,
        IP: r.ip,
        Link: r.link,
        "Tempo de Rota": r.tempoRota,
        "Data da Rota": r.dataRota,
        Status: r.status,
      }));
      const wb = jsonToWorkbook([{ name: "Pingao Rota", data }]);
      await writeFile(wb, showOnlyAbove24h ? "pingao_rota_acima_24h.xlsx" : "pingao_rota.xlsx");
    } catch (err) {
      alert("Falha ao exportar: " + String((err as Error)?.message || err));
    }
  };

  const statusBadge = (status: AnalyzedRotaRow["status"]) => {
    if (status === "OK") return "border-green-500/50 bg-green-500/15 text-green-700 dark:text-green-400";
    if (status === "SEM ROTA") return "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400";
    return "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Route className="w-5 h-5" /> Pingao Rota - Tempo de rota
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(commandsScript, "rota-script")} disabled={!commandsScript}>
            {copiedId === "rota-script" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copiedId === "rota-script" ? "Copiado!" : "Copiar comandos"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar por</Label>
            <RadioGroup
              value={lookupMode}
              onValueChange={(v) => setLookupMode(v as LookupMode)}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="rota-auto" />
                <Label htmlFor="rota-auto">Automatico (UL + CCTO)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cod_ul" id="rota-ul" />
                <Label htmlFor="rota-ul">Codigo UL</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ccto" id="rota-ccto" />
                <Label htmlFor="rota-ccto">Circuito (CCTO OI/OEMP)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ip" id="rota-ip" />
                <Label htmlFor="rota-ip">Somente IPs digitados</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Link</Label>
            <RadioGroup
              value={linkChoice}
              onValueChange={(v) => setLinkChoice(v as LinkChoice)}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="primario" id="rota-link-pri" />
                <Label htmlFor="rota-link-pri">Primario</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="secundario" id="rota-link-sec" />
                <Label htmlFor="rota-link-sec">Secundario</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ambos" id="rota-link-ambos" />
                <Label htmlFor="rota-link-ambos">Ambos</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rota-input">Codigo UL, circuito ou IP (um por linha)</Label>
            <Textarea
              id="rota-input"
              placeholder={"21-000666-8\n10.51.0.182\nXXY-1234-5678"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[110px] font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runLookup()} disabled={loading}>
              {loading ? "Gerando..." : "Gerar comandos"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInput("");
                setTargets([]);
                setPasted("");
                setAnalysisRows([]);
                setError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {targets.length > 0 && (
            <div className="rounded-lg border overflow-auto max-h-[260px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2">Consulta</th>
                    <th className="p-2">Codigo UL</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Link</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Comando</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t, idx) => (
                    <tr key={`${t.query}-${t.link}-${idx}`} className="border-t">
                      <td className="p-2 font-mono">{t.query}</td>
                      <td className="p-2 font-mono">{t.codUl}</td>
                      <td className="p-2">{t.nome}</td>
                      <td className="p-2 capitalize">{t.link}</td>
                      <td className="p-2 font-mono">{t.ip || "-"}</td>
                      <td className="p-2 font-mono whitespace-nowrap">
                        {t.status === "ok" ? buildRouteCommand(t.ip) : (
                          <Badge variant="outline" className="font-semibold border-orange-500/50 bg-orange-500/15 text-orange-700">
                            {t.status === "missing_ip" ? "Sem IP" : "Nao encontrado"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Comandos gerados</Label>
            {commandsScript ? (
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap overflow-x-auto max-h-[220px] overflow-y-auto">
                {commandsScript}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum IP valido para montar comandos.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Analisar saida (sh ip route)</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={runAnalysis} disabled={!pasted || !validTargets.length}>
              Analisar
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportXlsx()} disabled={!analysisRows.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rota-output">Cole aqui o retorno dos comandos</Label>
            <Textarea
              id="rota-output"
              placeholder={"B    10.51.0.182/32 [20/0] via 10.201.160.5, 19:27:32"}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          {analysisRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={showOnlyAbove24h}
                  onChange={(e) => setShowOnlyAbove24h(e.target.checked)}
                />
                <span className="font-medium">Mostrar somente rotas acima de 24h</span>
              </label>
              <span className="text-muted-foreground">
                Acima de 24h: <strong className="text-foreground">{above24hCount}</strong> de {analysisRows.length}
              </span>
            </div>
          )}

          {analysisRows.length > 0 && (
            <div className="rounded-lg border overflow-auto max-h-[360px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2">Codigo UL</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Link</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Tempo de Rota</th>
                    <th className="p-2">Data da Rota</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground">
                        Nenhuma rota acima de 24h.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r, idx) => (
                      <tr
                        key={`${r.ip}-${r.link}-${idx}`}
                        className={cn(
                          "border-t",
                          r.totalSeconds >= 86400 && r.status === "OK" && "bg-red-500/5",
                        )}
                      >
                        <td className="p-2 font-mono">{r.codUl}</td>
                        <td className="p-2">{r.nome}</td>
                        <td className="p-2 capitalize">{r.link}</td>
                        <td className="p-2 font-mono">{r.ip}</td>
                        <td className="p-2 font-mono">{r.tempoRota}</td>
                        <td className="p-2 font-mono">{r.dataRota}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={cn("font-semibold", statusBadge(r.status))}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PingaoRotaTab;
