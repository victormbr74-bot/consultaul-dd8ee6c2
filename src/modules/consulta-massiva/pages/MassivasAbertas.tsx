import { useQuery } from "@tanstack/react-query";
import { Activity, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OpenMassiva = {
  id: string;
  id_massiva: string;
  tipo_massiva: string;
  uf: string;
  operadora: string;
  qtd_circuitos: number;
  qtd_lotericas_isoladas: number;
  cidade_epicentro: string | null;
  uf_epicentro: string | null;
  primeiro_alarme: string | null;
  created_at: string;
  mascara_texto: string | null;
};

async function fetchOpenMassivas(): Promise<OpenMassiva[]> {
  const { data, error } = await supabase
    .from("massivas")
    .select("id,id_massiva,tipo_massiva,uf,operadora,qtd_circuitos,qtd_lotericas_isoladas,cidade_epicentro,uf_epicentro,primeiro_alarme,created_at,mascara_texto")
    .eq("status", "MASSIVA")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as OpenMassiva[];
}

export default function MassivasAbertas() {
  const q = useQuery({ queryKey: ["massivas-abertas"], queryFn: fetchOpenMassivas, staleTime: 30_000 });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Mascara copiada");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Massivas abertas</h2>
          <p className="text-xs text-muted-foreground">Registros salvos no banco com status MASSIVA.</p>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          Total: <span className="font-mono font-semibold">{q.data?.length ?? 0}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Activity className="h-4 w-4 text-noc-blue" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Eventos</h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2">Operadora</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Isoladas</th>
                <th className="px-3 py-2">Epicentro</th>
                <th className="px-3 py-2">Falha</th>
                <th className="px-3 py-2 text-right">Mascara</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Carregando...</td></tr>}
              {!q.isLoading && (q.data ?? []).length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Nenhuma massiva aberta.</td></tr>
              )}
              {(q.data ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono">{m.id_massiva}</td>
                  <td className="px-3 py-2 font-mono">{m.tipo_massiva}</td>
                  <td className="px-3 py-2 font-mono">{m.uf}</td>
                  <td className="px-3 py-2 font-mono">{m.operadora}</td>
                  <td className="px-3 py-2 text-right font-mono">{m.qtd_circuitos}</td>
                  <td className="px-3 py-2 text-right font-mono">{m.qtd_lotericas_isoladas}</td>
                  <td className="px-3 py-2 font-mono">{m.cidade_epicentro ? `${m.cidade_epicentro}/${m.uf_epicentro}` : "-"}</td>
                  <td className="px-3 py-2 font-mono">{m.primeiro_alarme ? new Date(m.primeiro_alarme).toLocaleString("pt-BR") : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" disabled={!m.mascara_texto} onClick={() => copy(m.mascara_texto ?? "")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
