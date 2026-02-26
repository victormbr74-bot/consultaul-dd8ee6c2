import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const PAGE_SIZE = 20;
const EXPORT_BATCH_SIZE = 1000;

const Dashboard = () => {
  const navigate = useNavigate();
  const { setOnExport, setOnImportClick, setShowLotericaTabs } = useSidebarActions();
  const [lotericas, setLotericas] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchLotericas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("lotericas").select("*", { count: "exact" });
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(`cod_ul.ilike.${s},nome_loterica.ilike.${s},ccto_oi.ilike.${s},cidade.ilike.${s}`);
      }

      const { data, count, error } = await query
        .order("cod_ul")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error("Erro ao buscar lotericas", error);
        setLotericas([]);
        setTotal(0);
        return;
      }

      setLotericas(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error("Falha inesperada ao buscar lotericas", error);
      setLotericas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void fetchLotericas();
  }, [fetchLotericas]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const goToFirstResult = useCallback(async () => {
    const term = search.trim();
    if (!term) return;

    try {
      // Prefer exact match by codigo (cod_ul) to avoid jumping to unrelated results.
      const { data: exact, error: exactError } = await supabase
        .from("lotericas")
        .select("cod_ul")
        .eq("cod_ul", term)
        .maybeSingle();

      if (exactError) {
        console.error("Erro ao buscar loterica por codigo", exactError);
      }

      const codUl = exact?.cod_ul;
      if (codUl) {
        navigate(`/loterica/${encodeURIComponent(codUl)}`);
        return;
      }

      const s = `%${term}%`;
      const { data, error } = await supabase
        .from("lotericas")
        .select("cod_ul")
        .or(`cod_ul.ilike.${s},nome_loterica.ilike.${s},ccto_oi.ilike.${s},cidade.ilike.${s}`)
        .order("cod_ul")
        .limit(1);

      if (error) {
        console.error("Erro ao buscar lotericas (atalho Enter)", error);
        alert("Erro ao buscar lot\u00E9ricas.");
        return;
      }

      const first = data?.[0]?.cod_ul;
      if (!first) {
        alert("Nenhuma lot\u00E9rica encontrada.");
        return;
      }

      navigate(`/loterica/${encodeURIComponent(first)}`);
    } catch (error) {
      console.error("Falha inesperada ao buscar lotericas (atalho Enter)", error);
      alert("Falha inesperada ao buscar lot\u00E9ricas.");
    }
  }, [navigate, search]);

  const handleExport = useCallback(async () => {
    try {
      const allRows: Array<Record<string, unknown>> = [];
      let from = 0;

      while (true) {
        const to = from + EXPORT_BATCH_SIZE - 1;
        const { data, error } = await supabase.from("lotericas").select("*").order("cod_ul").range(from, to);
        if (error) {
          console.error("Erro ao exportar lotericas", error);
          alert("Erro ao exportar os dados.");
          return;
        }

        if (!data || data.length === 0) {
          break;
        }

        allRows.push(...data);
        if (data.length < EXPORT_BATCH_SIZE) {
          break;
        }

        from += EXPORT_BATCH_SIZE;
      }

      if (allRows.length === 0) {
        alert("Nenhum dado encontrado para exportacao.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(
        allRows.map((row) => {
          const raw = (row.raw_data && typeof row.raw_data === "object") ? row.raw_data as Record<string, unknown> : {};
          return {
            "Código UL": row.cod_ul,
            "Nome Lotérica": row.nome_loterica,
            "CCTO OI": row.ccto_oi,
            "CCTO OEMP": row.ccto_oemp,
            "Designação Nova": row.designacao_nova,
            "Operadora": row.operadora,
            "IP NAT": row.ip_nat,
            "IP WAN": row.ip_wan,
            "Loopback Principal": row.loopback_wan,
            "Loopback Secundário": raw["LOOPBACK SECUNDARIO"] ?? raw["LOOPBACK SECUNDÁRIO"] ?? "",
            "Rede LAN": raw["REDE LAN"] ?? row.loopback_lan ?? "",
            "Endereço": row.endereco,
            "Contato": row.contato,
            "Status": row.status,
            "Cidade": row.cidade,
            "UF": row.uf,
            "IP Switch": raw["IP SWITCH"] ?? raw["LOOPBACK SWITCH"] ?? "",
            "TFL": raw["TFL"] ?? raw["TFLs"] ?? "",
            "Circuito OEMP": raw["CIRCUITO OEMP"] ?? "",
            "Circuitos Meraki": raw["CIRCUITO MERAKI"] ?? raw["CIRCUITOS MERAKI"] ?? raw["MERAKI"] ?? "",
            "Empresa OEMP": raw["EMPRESA OEMP"] ?? "",
            "Tipo UL": raw["TIPO LOTERICA"] ?? raw["TIPO UL"] ?? "",
            "Perímetro": raw["PERIMETRO"] ?? raw["PERÍMETRO"] ?? "",
            "Tecnologia": raw["TECNOLOGIA"] ?? "",
            "Modelo Roteador": raw["MODELO ROTEADOR"] ?? "",
            "SIM Card 4G": raw["SIM CARD 4G"] ?? "",
            "Owner": raw["OWNER"] ?? "",
            "Resp. Backup": raw["RESP BACKUP"] ?? "",
            "Região": raw["REGIAO"] ?? raw["REGIÃO"] ?? "",
            "CEP": raw["CEP"] ?? "",
            "Migração": raw["MIGRACAO"] ?? raw["MIGRAÇÃO"] ?? "",
            "Homologado": raw["HOMOLOGADO"] ?? "",
            "Atualizado em": row.updated_at,
          };
        }),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lot\u00E9ricas");
      XLSX.writeFile(wb, "lotericas_export.xlsx");
    } catch (error) {
      console.error("Falha inesperada ao exportar lotericas", error);
      alert("Falha inesperada na exportacao.");
    }
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        alert("Sessão inválida. Faça login novamente.");
        return;
      }

      const findSheet = (name: string) => wb.SheetNames.find((sheet) => sheet.trim().toLowerCase() === name.trim().toLowerCase());
      const macroSheetName = findSheet("MACRO");
      const jiraSheetName = findSheet("Jira Abertos");
      const falhasSheetName = findSheet("Falhas GIS");

      const toRows = (sheetName?: string) => {
        if (!sheetName) return [] as Record<string, unknown>[];
        const ws = wb.Sheets[sheetName];
        if (!ws) return [] as Record<string, unknown>[];
        return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      };

      const macroSheetRows = toRows(macroSheetName);
      const macroRows =
        macroSheetRows.length > 0
          ? macroSheetRows
          : XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
      const jiraRows = toRows(jiraSheetName);
      const falhasRows = toRows(falhasSheetName);

      const invokeInChunks = async (
        dataset: "lotericas" | "jira_abertos" | "falhas_gis",
        rows: Record<string, unknown>[],
        replace: boolean,
      ) => {
        if (!rows.length) return { inserted: 0, errors: 0, total: 0 };
        const chunkSize = 300;
        const totalChunks = Math.ceil(rows.length / chunkSize);
        let inserted = 0;
        let errors = 0;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const chunk = rows.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
          const res = await supabase.functions.invoke("import-lotericas", {
            body: {
              dataset,
              rows: chunk,
              chunkIndex,
              chunkCount: totalChunks,
              replace,
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (res.error) {
            throw new Error(`${dataset}: ${res.error.message}`);
          }

          inserted += Number(res.data?.inserted || 0);
          errors += Number(res.data?.errors || 0);
        }

        return { inserted, errors, total: rows.length };
      };

      const importedMacro = await invokeInChunks("lotericas", macroRows, false);
      const importedJira = await invokeInChunks("jira_abertos", jiraRows, true);
      const importedFalhas = await invokeInChunks("falhas_gis", falhasRows, true);

      alert(
        [
          "Importação concluída.",
          `MACRO/lotéricas: ${importedMacro.inserted} inseridos, ${importedMacro.errors} erros.`,
          `Jira Abertos: ${importedJira.inserted} inseridos, ${importedJira.errors} erros.`,
          `Falhas GIS: ${importedFalhas.inserted} inseridos, ${importedFalhas.errors} erros.`,
          !jiraSheetName || !falhasSheetName ? "Obs.: arquivo sem uma ou mais abas esperadas (Jira Abertos/Falhas GIS)." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      void fetchLotericas();
    } catch (error) {
      console.error("Falha inesperada na importacao", error);
      alert("Falha inesperada na importacao: " + String((error as any)?.message || error));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  useLayoutEffect(() => {
    setShowLotericaTabs(false);
    setOnExport(() => handleExport);
    setOnImportClick(() => () => importRef.current?.click());
    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
    };
  }, [handleExport, setOnExport, setOnImportClick, setShowLotericaTabs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusColor = (status: string) => {
    const s = status?.toUpperCase() || "";
    if (s.includes("ATIVO")) return "bg-success/15 text-success border-success/30";
    if (s.includes("SUSPEN") || s.includes("CANCEL")) return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-warning/15 text-warning border-warning/30";
  };

  return (
    <div className="bg-background">
      <input
        ref={importRef}
        type="file"
        accept=".xlsx,.xls,.xlsm"
        className="hidden"
        onChange={handleImport}
        disabled={importing}
      />
      <main className="container px-4 py-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={"Buscar por c\u00F3digo, nome, CCTO ou cidade..."}
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void goToFirstResult();
                }
              }}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => void fetchLotericas()}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span>{total} {"lot\u00E9ricas encontradas"}</span>
          <span>{"P\u00E1gina"} {page + 1} {"de"} {totalPages || 1}</span>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">{"C\u00F3digo"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">CCTO</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Cidade/UF</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Operadora</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : lotericas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {"Nenhuma lot\u00E9rica encontrada"}
                      </td>
                    </tr>
                  ) : (
                    lotericas.map((l) => (
                      <tr
                        key={l.cod_ul}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/loterica/${encodeURIComponent(l.cod_ul)}`)}
                      >
                        <td className="p-3 font-mono text-xs font-medium">{l.cod_ul}</td>
                        <td className="p-3 font-medium">{l.nome_loterica}</td>
                        <td className="p-3 font-mono text-xs hidden md:table-cell">{l.ccto_oi}</td>
                        <td className="p-3 hidden lg:table-cell">{l.cidade} - {l.uf}</td>
                        <td className="p-3 hidden lg:table-cell">{l.operadora}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
