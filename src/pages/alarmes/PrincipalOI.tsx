import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

export default function PrincipalOI() {
  const [search, setSearch] = useState("");

  const { data: lotericas = [] } = useQuery({
    queryKey: ["principal-oi"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("lotericas").select("*").not("ccto_oi", "is", null).range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const stats = useMemo(() => {
    const total = lotericas.length;
    const ufs = new Map<string, number>();
    lotericas.forEach((l: any) => {
      const uf = (l.uf || "N/A").trim();
      ufs.set(uf, (ufs.get(uf) || 0) + 1);
    });
    return { total, ufs: Array.from(ufs.entries()).sort((a, b) => b[1] - a[1]) };
  }, [lotericas]);

  const filtered = useMemo(() => {
    if (!search) return lotericas;
    const s = search.toLowerCase();
    return lotericas.filter((l: any) =>
      (l.cod_ul || "").toLowerCase().includes(s) ||
      (l.nome_loterica || "").toLowerCase().includes(s) ||
      (l.ccto_oi || "").toLowerCase().includes(s)
    );
  }, [lotericas, search]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Principal - OI</h1>
        <p className="text-sm text-muted-foreground">Circuitos principais gerenciados pela OI</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total OI</p>
            <p className="text-4xl font-bold text-primary mt-2">{stats.total}</p>
          </CardContent>
        </Card>
        {stats.ufs.slice(0, 3).map(([uf, count]) => (
          <Card key={uf} className="border-border/80">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{uf}</p>
              <p className="text-4xl font-bold text-foreground mt-2">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por código, nome, CCTO OI..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-muted-foreground">{filtered.length} registro(s)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">CCTO OI</TableHead>
                <TableHead className="text-xs">Designação</TableHead>
                <TableHead className="text-xs">Cidade/UF</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((l: any) => (
                <TableRow key={l.cod_ul}>
                  <TableCell className="text-xs font-mono">{l.cod_ul}</TableCell>
                  <TableCell className="text-xs">{l.nome_loterica}</TableCell>
                  <TableCell className="text-xs font-mono">{l.ccto_oi}</TableCell>
                  <TableCell className="text-xs font-mono">{l.designacao_nova}</TableCell>
                  <TableCell className="text-xs">{l.cidade} - {l.uf}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.status || "N/A"}</Badge></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
