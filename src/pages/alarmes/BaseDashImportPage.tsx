import { useLayoutEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import {
  ImportBasePlanilhaProgress,
  ImportBasePlanilhaResult,
  importBasePlanilhaFile,
} from "@/lib/importBasePlanilha";

function StageBadge({ progress }: { progress: ImportBasePlanilhaProgress | null }) {
  if (!progress) return <Badge variant="outline">Aguardando arquivo</Badge>;
  if (progress.phase === "completed") return <Badge variant="default">Concluído</Badge>;
  if (progress.phase === "uploading") return <Badge variant="secondary">Importando</Badge>;
  return <Badge variant="outline">Preparando</Badge>;
}

function ResultSummary({ result }: { result: ImportBasePlanilhaResult }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">MACRO (base)</p>
        <p className="text-lg font-semibold mt-1">{result.importedMacro.inserted}</p>
        <p className="text-xs text-muted-foreground">Erros: {result.importedMacro.errors}</p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Jira Abertos</p>
        <p className="text-lg font-semibold mt-1">{result.importedJira.inserted}</p>
        <p className="text-xs text-muted-foreground">Erros: {result.importedJira.errors}</p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Falhas GIS</p>
        <p className="text-lg font-semibold mt-1">{result.importedFalhas.inserted}</p>
        <p className="text-xs text-muted-foreground">Erros: {result.importedFalhas.errors}</p>
      </div>
    </div>
  );
}

export default function BaseDashImportPage() {
  const { setOnExport, setOnImportClick, setShowLotericaTabs } = useSidebarActions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<ImportBasePlanilhaProgress | null>(null);
  const [result, setResult] = useState<ImportBasePlanilhaResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [progressLog, setProgressLog] = useState<string[]>([]);

  useLayoutEffect(() => {
    setShowLotericaTabs(false);
    setOnExport(undefined);
    setOnImportClick(undefined);
    return () => {
      setOnExport(undefined);
      setOnImportClick(undefined);
      setShowLotericaTabs(false);
    };
  }, [setOnExport, setOnImportClick, setShowLotericaTabs]);

  const appendLog = (line: string) => {
    setProgressLog((prev) => {
      if (!line) return prev;
      if (prev[prev.length - 1] === line) return prev;
      const next = [...prev, line];
      return next.slice(-25);
    });
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file.name);
    setUploading(true);
    setResult(null);
    setErrorMessage("");
    setProgress({ phase: "reading", percent: 0, message: "Iniciando importação..." });
    setProgressLog([`Arquivo selecionado: ${file.name}`]);

    try {
      const importResult = await importBasePlanilhaFile(file, {
        strictBase: true,
        preserveLotericas: true,
        macroTarget: "macro_base_alarmes",
        onProgress: (evt) => {
          setProgress(evt);
          if (evt.phase === "uploading" && evt.datasetLabel && evt.chunkIndex && evt.chunkCount) {
            appendLog(`${evt.datasetLabel}: lote ${evt.chunkIndex}/${evt.chunkCount}`);
          } else {
            appendLog(evt.message);
          }
        },
      });

      setResult(importResult);
      appendLog("Importação finalizada.");
    } catch (error) {
      const msg = String((error as any)?.message || error);
      setErrorMessage(msg);
      appendLog(`Erro: ${msg}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const progressValue = progress?.percent ?? 0;

  return (
    <div className="space-y-6 p-6">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={handleSelect}
        disabled={uploading}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base Dash</h1>
          <p className="text-sm text-muted-foreground">
            Importe a base que abastece os menus Dash, Principal, Backup e Desempenho.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formato recomendado: `.xlsm`/`.xlsx` com abas `MACRO`, `Jira Abertos` e `Falhas GIS`.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Importando..." : "Selecionar Arquivo"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setProgress(null);
              setResult(null);
              setErrorMessage("");
              setSelectedFile("");
              setProgressLog([]);
            }}
            disabled={uploading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Status da Importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedFile || "Nenhum arquivo selecionado"}</p>
              <p className="text-xs text-muted-foreground">{progress?.message || "Aguardando importação."}</p>
            </div>
            <StageBadge progress={progress} />
          </div>

          <Progress value={progressValue} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-lg font-semibold mt-1">{Math.round(progressValue)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Base Atual</p>
              <p className="text-sm font-medium mt-1">{progress?.datasetLabel || "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Lote</p>
              <p className="text-sm font-medium mt-1">
                {progress?.chunkIndex && progress?.chunkCount ? `${progress.chunkIndex}/${progress.chunkCount}` : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Erro na importação
            </div>
            <p className="text-sm text-muted-foreground mt-2 break-words">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {result && !errorMessage && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResultSummary result={result} />
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Abas lidas</p>
              <p className="text-sm mt-1 break-words">{result.workbookSheets.join(", ") || "-"}</p>
              {result.missingSheets.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">Abas ausentes: {result.missingSheets.join(", ")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Progresso (log)</CardTitle>
        </CardHeader>
        <CardContent>
          {progressLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
          ) : (
            <div className="max-h-[260px] overflow-auto rounded-md border bg-muted/20 p-3">
              <div className="space-y-1">
                {progressLog.map((line, index) => (
                  <p key={`${index}-${line}`} className="text-xs font-mono text-foreground/90">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

