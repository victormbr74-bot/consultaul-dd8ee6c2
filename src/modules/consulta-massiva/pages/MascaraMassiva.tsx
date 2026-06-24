import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FileSignature, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type MassivaRecord = {
  id: string;
  id_massiva: string;
  circuito_pai: string | null;
  tipo_massiva: string;
  uf: string;
  operadora: string;
  qtd_circuitos: number;
  qtd_lotericas_isoladas: number;
  mascara_texto: string | null;
  created_at: string;
};

async function fetchMascaras(): Promise<MassivaRecord[]> {
  const { data, error } = await supabase
    .from("massivas")
    .select("id,id_massiva,circuito_pai,tipo_massiva,uf,operadora,qtd_circuitos,qtd_lotericas_isoladas,mascara_texto,created_at")
    .not("mascara_texto", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as MassivaRecord[];
}

function extractCircuitoPaiFromMascara(text: string | null): string {
  const line = (text ?? "").split(/\r?\n/).find((item) => item.includes("Evento Massivo") && item.includes("|"));
  return line?.split("|")[0]?.trim() || "";
}

function displayCircuitoPai(m: MassivaRecord | null): string {
  if (!m) return "Mascara";
  return m.circuito_pai?.trim() || extractCircuitoPaiFromMascara(m.mascara_texto) || m.id_massiva;
}

function extractQtdIsoladas(text: string | null): number {
  const line = (text ?? "").split(/\r?\n/).find((item) => item.trim().toLowerCase().startsWith("quantidade isoladas:"));
  const value = line?.match(/\d+/)?.[0];
  return value ? Number(value) : 0;
}

function displayQtdIsoladas(m: MassivaRecord): string {
  const qtd = Number(m.qtd_lotericas_isoladas ?? 0) || extractQtdIsoladas(m.mascara_texto);
  return String(qtd).padStart(2, "0");
}

export default function MascaraMassiva() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const q = useQuery({ queryKey: ["passagem-turno-mascaras"], queryFn: fetchMascaras, staleTime: 30_000 });

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = q.data ?? [];
    if (!term) return rows;
    return rows.filter((m) =>
      [m.id_massiva, m.circuito_pai ?? "", m.tipo_massiva, m.uf, m.operadora, m.mascara_texto ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [q.data, query]);

  const selected = items.find((m) => m.id === selectedId) ?? items[0] ?? null;
  const hasDraftChanges = !!selected && draft !== (selected.mascara_texto ?? "");

  useEffect(() => {
    setDraft(selected?.mascara_texto ?? "");
  }, [selected?.id, selected?.mascara_texto]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase.from("massivas").update({ mascara_texto: text }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["passagem-turno-mascaras"] });
      await queryClient.invalidateQueries({ queryKey: ["massivas-controle"] });
      toast.success("Mascara salva");
    },
    onError: (error) => toast.error("Falha ao salvar mascara: " + (error as Error).message),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Mascara copiada");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Mascara de massiva</h2>
          <p className="text-xs text-muted-foreground">Mascaras geradas automaticamente no momento da analise.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar circuito pai, UF ou operadora" />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3 text-xs font-semibold uppercase tracking-wide">
            Massivas ({items.length})
          </div>
          <div className="max-h-[640px] overflow-auto">
            {q.isLoading && <div className="p-4 text-xs text-muted-foreground">Carregando...</div>}
            {!q.isLoading && items.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhuma mascara encontrada.</div>}
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`block w-full border-b border-border/60 px-3 py-3 text-left text-xs hover:bg-accent/50 ${selected?.id === m.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{displayCircuitoPai(m)}</span>
                  <span className="font-mono text-muted-foreground">{displayQtdIsoladas(m)}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{m.tipo_massiva} | {m.uf} | {m.operadora} | {displayQtdIsoladas(m)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-noc-blue" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{displayCircuitoPai(selected)}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!selected || !hasDraftChanges || saveMutation.isPending} onClick={() => selected && saveMutation.mutate({ id: selected.id, text: draft })}>
                <Save className="h-4 w-4" /> Salvar
              </Button>
              <Button size="sm" variant="outline" disabled={!draft} onClick={() => copy(draft)}>
                <Copy className="h-4 w-4" /> Copiar
              </Button>
            </div>
          </div>
          <div className="p-3">
            <textarea
              className="h-[640px] w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
