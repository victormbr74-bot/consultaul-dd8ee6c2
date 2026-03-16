import { Fragment, useMemo, useRef, useState } from "react";
import { Check, Copy, FileText, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildTextCompareResult, type DiffCell, type TextCompareOptions } from "@/lib/textCompare";
import { cn } from "@/lib/utils";

const countLines = (text: string) => (text ? text.replace(/\r\n/g, "\n").split("\n").length : 0);

const diffCellTone = (cell: DiffCell, side: "left" | "right") => {
  if (cell.status === "same" || cell.status === "empty") return "bg-card";
  if (cell.status === "removed") return "bg-rose-500/10";
  if (cell.status === "added") return "bg-emerald-500/10";
  return side === "left" ? "bg-amber-500/10" : "bg-emerald-500/10";
};

const diffCellBorder = (cell: DiffCell, side: "left" | "right") => {
  if (cell.status === "same" || cell.status === "empty") return "border-transparent";
  if (cell.status === "removed") return "border-rose-500/50";
  if (cell.status === "added") return "border-emerald-500/50";
  return side === "left" ? "border-amber-500/50" : "border-emerald-500/50";
};

const diffSegmentTone = (cell: DiffCell, side: "left" | "right", changed: boolean) => {
  if (!changed) return "";
  if (cell.status === "removed") return "bg-rose-500/20 text-rose-900 dark:text-rose-100";
  if (cell.status === "added") return "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100";
  return side === "left"
    ? "bg-amber-500/25 text-amber-950 dark:text-amber-100"
    : "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100";
};

const renderDiffText = (cell: DiffCell, side: "left" | "right") => {
  if (!cell.text && cell.status === "empty") {
    return <span className="text-muted-foreground/60"> </span>;
  }

  if (!cell.text && cell.status !== "empty") {
    return <span className="text-muted-foreground/70">linha vazia</span>;
  }

  return cell.segments.map((segment, index) => (
    <span
      key={`${cell.lineNumber ?? "empty"}-${index}-${segment.changed ? "1" : "0"}`}
      className={cn(segment.changed && "rounded-sm px-0.5 font-medium", diffSegmentTone(cell, side, segment.changed))}
    >
      {segment.value}
    </span>
  ));
};

const DiffColumnHeader = ({ label, description }: { description: string; label: string }) => (
  <div className="border-b bg-muted/40 px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <p className="font-medium">{label}</p>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{description}</p>
    </div>
  </div>
);

const EditorPanel = ({
  copiedId,
  copyLabel,
  label,
  onChange,
  onClear,
  onCopy,
  placeholder,
  value,
}: {
  copiedId: string | null;
  copyLabel: string;
  label: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onCopy: () => void;
  placeholder: string;
  value: string;
}) => {
  const lineCount = countLines(value);
  const charCount = value.length;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div>
          <Label className="text-sm font-semibold text-foreground">{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {lineCount} linhas
            {" · "}
            {charCount} caracteres
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={!value}>
            {copiedId === copyLabel ? <Check className="text-green-600" /> : <Copy />}
            {copiedId === copyLabel ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={!value}>
            Limpar
          </Button>
        </div>
      </div>
      <div className="bg-gradient-to-b from-background to-muted/10 p-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[280px] resize-y border-0 bg-transparent p-3 font-mono text-xs leading-6 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
};

const MobileResultList = ({
  label,
  rows,
  side,
}: {
  label: string;
  rows: ReturnType<typeof buildTextCompareResult>["rows"];
  side: "left" | "right";
}) => (
  <div className="overflow-hidden rounded-xl border">
    <DiffColumnHeader label={label} description={side === "left" ? "Original" : "Comparado"} />
    <ScrollArea className="h-[420px]">
      <div>
        {rows.map((row, index) => {
          const cell = side === "left" ? row.left : row.right;

          return (
            <div
              key={`${side}-${index}-${cell.lineNumber ?? "empty"}`}
              className={cn("grid min-h-[44px] grid-cols-[56px_minmax(0,1fr)] border-b last:border-b-0", diffCellTone(cell, side))}
            >
              <div className="border-r bg-background/70 px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
                {cell.lineNumber ?? ""}
              </div>
              <div className={cn("border-l-4 px-3 py-2", diffCellBorder(cell, side))}>
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6">{renderDiffText(cell, side)}</pre>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  </div>
);

const TextCompareTab = () => {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [comparedTexts, setComparedTexts] = useState({ left: "", right: "" });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasCompared, setHasCompared] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const options = useMemo<TextCompareOptions>(
    () => ({
      ignoreCase,
      ignoreWhitespace,
    }),
    [ignoreCase, ignoreWhitespace],
  );

  const result = useMemo(
    () => buildTextCompareResult(comparedTexts.left, comparedTexts.right, options),
    [comparedTexts.left, comparedTexts.right, options],
  );

  const hasPendingChanges = hasCompared && (leftText !== comparedTexts.left || rightText !== comparedTexts.right);

  const handleCompare = () => {
    setComparedTexts({ left: leftText, right: rightText });
    setHasCompared(true);
    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSwap = () => {
    setLeftText(rightText);
    setRightText(leftText);
  };

  const handleClearAll = () => {
    setLeftText("");
    setRightText("");
    setComparedTexts({ left: "", right: "" });
    setHasCompared(false);
  };

  const handleCopy = async (text: string, id: string) => {
    if (!text) return;

    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 shadow-sm">
        <div className="border-b bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.14),_transparent_45%),linear-gradient(135deg,hsl(var(--card))_10%,hsl(var(--muted)/0.4)_100%)]">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-background/80 shadow-sm">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Comparar Texto</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dois paineis, comparacao destacada e leitura lado a lado no estilo Diffchecker.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                Split view
              </Badge>
              <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Adicoes em destaque
              </Badge>
              <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                Remocoes em destaque
              </Badge>
            </div>
          </CardHeader>
        </div>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)]">
            <EditorPanel
              copiedId={copiedId}
              copyLabel="left"
              label="Texto original"
              onChange={setLeftText}
              onClear={() => setLeftText("")}
              onCopy={() => void handleCopy(leftText, "left")}
              placeholder="Cole aqui o primeiro texto..."
              value={leftText}
            />

            <div className="flex flex-col justify-center gap-3">
              <Button onClick={handleCompare} className="w-full">
                <RefreshCw className="mr-1" />
                {hasCompared ? "Atualizar comparacao" : "Comparar textos"}
              </Button>
              <Button variant="outline" onClick={handleSwap} className="w-full" disabled={!leftText && !rightText}>
                Inverter lados
              </Button>
              <Button variant="ghost" onClick={handleClearAll} className="w-full" disabled={!leftText && !rightText && !hasCompared}>
                Limpar tudo
              </Button>
              <div className="rounded-2xl border bg-muted/25 p-3 text-xs text-muted-foreground">
                Compare blocos curtos ou longos. O resultado fica congelado ate voce atualizar a comparacao.
              </div>
            </div>

            <EditorPanel
              copiedId={copiedId}
              copyLabel="right"
              label="Texto comparado"
              onChange={setRightText}
              onClear={() => setRightText("")}
              onCopy={() => void handleCopy(rightText, "right")}
              placeholder="Cole aqui o segundo texto..."
              value={rightText}
            />
          </div>

          <div className="flex flex-wrap items-center gap-5 rounded-2xl border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-3">
              <Switch id="compare-ignore-case" checked={ignoreCase} onCheckedChange={setIgnoreCase} />
              <Label htmlFor="compare-ignore-case" className="text-sm">
                Ignorar maiusculas e minusculas
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="compare-ignore-whitespace" checked={ignoreWhitespace} onCheckedChange={setIgnoreWhitespace} />
              <Label htmlFor="compare-ignore-whitespace" className="text-sm">
                Ignorar espacos extras
              </Label>
            </div>
          </div>

          {hasPendingChanges ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              Os textos foram alterados depois da ultima comparacao. Clique em <strong>Comparar textos</strong> para atualizar o diff.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div ref={resultRef}>
        {hasCompared ? (
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/25">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Resultado da Comparacao</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.summary.hasDifferences
                      ? `${result.summary.totalRows} linhas alinhadas para leitura comparativa.`
                      : "Nenhuma diferenca encontrada com as regras atuais."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{result.summary.identicalLines} iguais</Badge>
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    {result.summary.changedLines} alteradas
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {result.summary.addedLines} adicionadas
                  </Badge>
                  <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                    {result.summary.removedLines} removidas
                  </Badge>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                    {result.summary.similarity}% igual
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="grid gap-4 p-4">
                  <MobileResultList label="Texto original" rows={result.rows} side="left" />
                  <MobileResultList label="Texto comparado" rows={result.rows} side="right" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 border-b">
                    <DiffColumnHeader label="Texto original" description={`${result.summary.leftLineCount} linhas`} />
                    <DiffColumnHeader label="Texto comparado" description={`${result.summary.rightLineCount} linhas`} />
                  </div>
                  <ScrollArea className="h-[560px]">
                    <div className="grid min-w-[980px] grid-cols-2">
                      {result.rows.map((row, index) => (
                        <Fragment key={`row-${index}-${row.left.lineNumber ?? "empty"}-${row.right.lineNumber ?? "empty"}`}>
                          <div
                            className={cn(
                              "grid min-h-[48px] grid-cols-[56px_minmax(0,1fr)] border-b border-r",
                              diffCellTone(row.left, "left"),
                            )}
                          >
                            <div className="border-r bg-background/70 px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
                              {row.left.lineNumber ?? ""}
                            </div>
                            <div className={cn("border-l-4 px-3 py-2", diffCellBorder(row.left, "left"))}>
                              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6">
                                {renderDiffText(row.left, "left")}
                              </pre>
                            </div>
                          </div>
                          <div
                            className={cn("grid min-h-[48px] grid-cols-[56px_minmax(0,1fr)] border-b", diffCellTone(row.right, "right"))}
                          >
                            <div className="border-r bg-background/70 px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
                              {row.right.lineNumber ?? ""}
                            </div>
                            <div className={cn("border-l-4 px-3 py-2", diffCellBorder(row.right, "right"))}>
                              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6">
                                {renderDiffText(row.right, "right")}
                              </pre>
                            </div>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[180px] items-center justify-center p-6 text-center">
              <div className="max-w-md space-y-2">
                <p className="font-medium">Cole os dois textos e rode a comparacao.</p>
                <p className="text-sm text-muted-foreground">
                  O resultado mostra linhas alinhadas, diferencas destacadas e indicadores de adicao, remocao e alteracao.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TextCompareTab;
