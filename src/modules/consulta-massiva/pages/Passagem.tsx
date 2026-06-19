import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

async function fetchMassivasAbertasCount(): Promise<number> {
  const { count, error } = await supabase
    .from("massivas")
    .select("id", { count: "exact", head: true })
    .eq("status", "MASSIVA");
  if (error) throw error;
  return count ?? 0;
}

export default function Passagem() {
  const countQ = useQuery({ queryKey: ["passagem-massivas-count"], queryFn: fetchMassivasAbertasCount, staleTime: 30_000 });
  const [turno, setTurno] = useState("07 hs");
  const [tade, setTade] = useState("33");
  const [proatividade, setProatividade] = useState("17:39");
  const [casosNovos, setCasosNovos] = useState("00");
  const [criticos, setCriticos] = useState("129");
  const [concentradores, setConcentradores] = useState("00");
  const [cgs, setCgs] = useState("22");

  const texto = useMemo(() => {
    const massivas = String(countQ.data ?? 0).padStart(2, "0");
    return [
      "===========================",
      `PASSAGEM DE TURNO ${turno}`,
      "============================",
      `TADE: ${tade}`,
      "============================",
      `PROATIVIDADE HORARIO FINAL: ${proatividade}`,
      `CASOS NOVOS CONSORCIO: ${casosNovos}`,
      "============================",
      `CASOS CRITICOS LOTERICAS ISOLADAS: ${criticos}`,
      `MASSIVAS CONSORCIO: ${massivas}`,
      `CONCENTRADORES: ${concentradores}`,
      `CGS/FCR/FCRDE: ${cgs}`,
    ].join("\n");
  }, [casosNovos, cgs, concentradores, countQ.data, criticos, proatividade, tade, turno]);

  const copy = async () => {
    await navigator.clipboard.writeText(texto);
    toast.success("Passagem copiada");
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Passagem</h2>
          <p className="text-xs text-muted-foreground">Modelo de passagem com contagem automatica de massivas abertas.</p>
        </div>
        <Button onClick={copy}><Copy className="h-4 w-4" /> Copiar</Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-noc-blue" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Dados</h3>
          </div>
          <div className="grid gap-3">
            <Field label="Turno" value={turno} onChange={setTurno} />
            <Field label="TADE" value={tade} onChange={setTade} />
            <Field label="Proatividade horario final" value={proatividade} onChange={setProatividade} />
            <Field label="Casos novos consorcio" value={casosNovos} onChange={setCasosNovos} />
            <Field label="Casos criticos lotericas isoladas" value={criticos} onChange={setCriticos} />
            <Field label="Concentradores" value={concentradores} onChange={setConcentradores} />
            <Field label="CGS/FCR/FCRDE" value={cgs} onChange={setCgs} />
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              Massivas consorcio: <span className="font-mono font-semibold">{String(countQ.data ?? 0).padStart(2, "0")}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <textarea
            className="h-[520px] w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            readOnly
            value={texto}
          />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
