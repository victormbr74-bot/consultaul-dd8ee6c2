import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, HardHat } from "lucide-react";

export default function ImplantacaoPage() {
  const [search, setSearch] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*")
        .order("atualizado_em", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const s = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      !s ||
      `${r.codigo_loterica} ${r.loterica ?? ""} ${r.parceira ?? ""} ${r.analise_tipo ?? ""}`
        .toLowerCase()
        .includes(s),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Implantação</h1>
          <p className="text-sm text-muted-foreground">
            Base OS / Reparo — {filtered.length} registros
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <HardHat className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum dado de implantação. Importe a base OS / Reparo e processe o controle.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Lotérica</TableHead>
                <TableHead>Status Censitec</TableHead>
                <TableHead>Análise / Tipo</TableHead>
                <TableHead>Parceira</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Novo Circuito</TableHead>
                <TableHead>Nova Designação</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.codigo_loterica}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{r.loterica}</TableCell>
                  <TableCell>
                    {r.status_censitec && <Badge variant="secondary">{r.status_censitec}</Badge>}
                  </TableCell>
                  <TableCell>{r.analise_tipo}</TableCell>
                  <TableCell>{r.parceira}</TableCell>
                  <TableCell>{r.fase}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.evento ?? ""}>
                    {r.evento}
                  </TableCell>
                  <TableCell>{r.novo_circuito}</TableCell>
                  <TableCell>{r.nova_designacao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.data_atualizacao
                      ? new Date(r.data_atualizacao).toLocaleDateString("pt-BR")
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
