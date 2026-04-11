import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  RotateCcw,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  executePing,
  fetchPingHistory,
  type PingTestType,
  type PingExecutionResult,
  type PingHistoryEntry,
  type PingStepResult,
  STATUS_COLORS,
  STEP_LABELS,
} from "@/services/pingExecutor";

interface PingExecutionPanelProps {
  pageType: PingTestType;
  host: string;
  label?: string;
  disabled?: boolean;
}

const StepIcon = ({ status }: { status: string }) => {
  if (status === "ok") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  if (status === "erro") return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (status === "timeout") return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
};

const PingExecutionPanel = ({ pageType, host, label, disabled }: PingExecutionPanelProps) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PingExecutionResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [history, setHistory] = useState<PingHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const totalSteps = pageType === "pingao_nat" ? 4 : 6;

  const run = useCallback(async () => {
    if (!host) {
      setError("IP/host não definido");
      return;
    }
    setRunning(true);
    setError("");
    setResult(null);
    setProgress(10);

    // Simulate progress while waiting
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 85));
    }, 1500);

    try {
      const res = await executePing(pageType, host);
      setResult(res);
      setProgress(100);
    } catch (err) {
      setError(String((err as Error)?.message || err));
      setProgress(0);
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  }, [host, pageType]);

  const loadHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await fetchPingHistory(pageType, 20);
      setHistory(data);
      setShowHistory(true);
    } catch (err) {
      setError("Falha ao carregar histórico");
    } finally {
      setLoadingHistory(false);
    }
  }, [pageType, showHistory]);

  const statusColor = result?.status_final ? STATUS_COLORS[result.status_final] || "" : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="w-5 h-5" />
          {label || "Execução de Ping via Backend"}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <History className="w-4 h-4 mr-1" />
            )}
            Histórico
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Execute button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={run}
            disabled={running || disabled || !host}
            className="min-w-[180px]"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Executar Ping
              </>
            )}
          </Button>
          {result && (
            <Button variant="outline" size="sm" onClick={run}>
              <RotateCcw className="w-4 h-4 mr-1" /> Retry
            </Button>
          )}
          <span className="text-sm text-muted-foreground font-mono">{host || "—"}</span>
        </div>

        {/* Progress */}
        {running && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Conectando via SSH → TACACS → {pageType !== "pingao_nat" ? "Telnet → Concentrador → " : ""}Ping...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={`text-sm px-3 py-1 font-semibold ${statusColor}`}>
                {result.status_final}
              </Badge>
              {result.perda_percentual !== null && (
                <span className="text-sm text-muted-foreground">
                  Perda: <strong>{result.perda_percentual}%</strong>
                </span>
              )}
              {result.tempo_medio && (
                <span className="text-sm text-muted-foreground">
                  Tempo médio: <strong>{result.tempo_medio}</strong>
                </span>
              )}
              {result.etapa_que_falhou && (
                <span className="text-sm text-destructive">
                  Falha em: {STEP_LABELS[result.etapa_que_falhou] || result.etapa_que_falhou}
                </span>
              )}
            </div>

            {/* Steps */}
            {result.etapas && result.etapas.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Etapas:</p>
                <div className="grid gap-1">
                  {result.etapas.map((step: PingStepResult, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30"
                    >
                      <StepIcon status={step.status} />
                      <span className="font-medium min-w-[140px]">
                        {STEP_LABELS[step.etapa] || step.etapa}
                      </span>
                      {step.duracao_ms !== undefined && (
                        <span className="text-muted-foreground">{step.duracao_ms}ms</span>
                      )}
                      {step.erro && (
                        <span className="text-destructive ml-auto">{step.erro}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLog(!showLog)}
              className="text-xs"
            >
              {showLog ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              {showLog ? "Ocultar log" : "Ver log completo"}
            </Button>

            {showLog && result.resultado_bruto && (
              <ScrollArea className="h-[250px] rounded border">
                <pre className="text-xs font-mono p-3 whitespace-pre-wrap">
                  {result.resultado_bruto}
                </pre>
              </ScrollArea>
            )}
          </div>
        )}

        {/* History */}
        {showHistory && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Últimas execuções</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum histórico encontrado.</p>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-1">
                  {history.map((entry) => {
                    const color = STATUS_COLORS[entry.status] || "";
                    const summary = entry.summary_json || {};
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30 hover:bg-muted/50"
                      >
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>
                          {entry.status}
                        </Badge>
                        <span className="font-mono">{entry.target || entry.input_term}</span>
                        {summary.perda_percentual !== null && summary.perda_percentual !== undefined && (
                          <span className="text-muted-foreground">
                            {summary.perda_percentual}%
                          </span>
                        )}
                        {summary.tempo_medio && (
                          <span className="text-muted-foreground">{summary.tempo_medio}</span>
                        )}
                        <span className="text-muted-foreground ml-auto">
                          {new Date(entry.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PingExecutionPanel;
