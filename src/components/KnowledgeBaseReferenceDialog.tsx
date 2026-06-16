import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { normalizeKnowledgeText, type KnowledgeBaseRow } from "@/lib/knowledgeBase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type KnowledgeBaseReferenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  keywords?: string[];
  title?: string;
};

const scoreRow = (row: KnowledgeBaseRow, terms: string[]) => {
  const tags = row.tags || [];
  const haystack = normalizeKnowledgeText([row.title, row.category, row.summary, row.content, ...tags].join(" "));
  return terms.reduce((score, term) => {
    if (!term) return score;
    if (haystack.includes(term)) return score + 2;
    return score;
  }, 0);
};

const extractProcedureLines = (content: string) => {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => normalizeKnowledgeText(line).startsWith("procedimento"));
  const relevant = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
  return relevant.map((line) => line.trim()).filter(Boolean);
};

const knowledgeBaseErrorMessage = (error: unknown) => {
  const message = String((error as { message?: string })?.message || error || "");
  const code = String((error as { code?: string })?.code || "");
  if (code === "PGRST205" || message.includes("knowledge_base") || message.includes("404")) {
    return "Tabela knowledge_base nao encontrada no Supabase. Aplique as migrations antes de consultar a base.";
  }
  return message;
};

export const KnowledgeBaseReferenceDialog = ({
  open,
  onOpenChange,
  context,
  keywords = [],
  title = "Base de conhecimento",
}: KnowledgeBaseReferenceDialogProps) => {
  const [rows, setRows] = useState<KnowledgeBaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("knowledge_base")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1000);
    setLoading(false);

    if (error) {
      toast.error("Falha ao carregar base de conhecimento", { description: knowledgeBaseErrorMessage(error) });
      setRows([]);
      return;
    }

    setRows((data as KnowledgeBaseRow[]) || []);
  }, []);

  useEffect(() => {
    if (open) void loadRows();
  }, [loadRows, open]);

  const searchTerms = useMemo(
    () =>
      [context, query, ...keywords]
        .map(normalizeKnowledgeText)
        .flatMap((term) => term.split(/\s+/))
        .filter((term) => term.length >= 3),
    [context, keywords, query],
  );

  const rankedRows = useMemo(() => {
    const scored = rows
      .map((row) => ({ row, score: scoreRow(row, searchTerms) }))
      .filter((item) => item.score > 0 || !query.trim());

    return scored
      .sort((a, b) => b.score - a.score || new Date(b.row.updated_at).getTime() - new Date(a.row.updated_at).getTime())
      .map((item) => item.row);
  }, [query, rows, searchTerms]);

  const selected = rankedRows.find((row) => row.id === selectedId) || rankedRows[0] || null;

  useEffect(() => {
    if (!selectedId && rankedRows[0]?.id) setSelectedId(rankedRows[0].id);
    if (selectedId && !rankedRows.some((row) => row.id === selectedId)) setSelectedId(rankedRows[0]?.id || null);
  }, [rankedRows, selectedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Procedimentos sugeridos pela base para o contexto atual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b p-4 lg:border-b-0 lg:border-r">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar procedimento..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[220px] lg:h-[560px]">
              <div className="space-y-2 pr-3">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : null}

                {!loading && rankedRows.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum procedimento encontrado para este contexto.
                  </div>
                ) : null}

                {rankedRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={[
                      "w-full rounded-md border p-3 text-left transition-colors",
                      selected?.id === row.id ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                    ].join(" ")}
                  >
                    <div className="font-medium text-sm">{row.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.category ? <Badge variant="outline">{row.category}</Badge> : null}
                      {(row.tags || []).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <ScrollArea className="h-[560px]">
            <div className="space-y-4 p-6">
              {selected ? (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{selected.title}</h2>
                      {selected.category ? <Badge variant="outline">{selected.category}</Badge> : null}
                    </div>
                    {selected.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {selected.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {selected.summary ? (
                      <p className="rounded-md bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{selected.summary}</p>
                    ) : null}
                  </div>

                  <div className="rounded-md border bg-muted/30 p-4">
                    <h3 className="mb-2 text-sm font-semibold">Passo a passo</h3>
                    <ol className="space-y-2 text-sm leading-6">
                      {extractProcedureLines(selected.content).map((line, index) => (
                        <li key={`${line}-${index}`} className="flex gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                            {index + 1}
                          </span>
                          <span className="whitespace-pre-wrap">{line.replace(/^\d+[\).\s-]+/, "")}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Fechar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Selecione um procedimento na lista.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
