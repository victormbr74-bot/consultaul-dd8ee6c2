import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { importNatIpsFile, NatImportProgress, NatImportResult } from "@/lib/importNatIps";

export default function ImportNatIps() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<NatImportProgress | null>(null);
  const [result, setResult] = useState<NatImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState("");

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(null);
    setResult(null);
    setErrorMessage("");
    setSelectedFile(file.name);

    try {
      const res = await importNatIpsFile(file, setProgress);
      setResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container px-4 py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar IPs NAT
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Suba a planilha de IPs NAT (.xlsx). O sistema irá atualizar os IPs das lotéricas existentes
            (por designação/circuito) e inserir os novos registros.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Selecionar arquivo
            </Button>
            {selectedFile && (
              <span className="text-sm text-muted-foreground truncate max-w-[250px]">
                {selectedFile}
              </span>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{progress.message}</span>
                <Badge variant={progress.phase === "completed" ? "default" : "secondary"}>
                  {progress.phase === "completed" ? "Concluído" : `${progress.percent}%`}
                </Badge>
              </div>
              <Progress value={progress.percent} />
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          {result && !errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium">Importação concluída</p>
                <p className="text-muted-foreground mt-1">
                  Total: {result.total} registros · Atualizados: {result.updated} · Inseridos: {result.inserted} · Erros: {result.errors}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
