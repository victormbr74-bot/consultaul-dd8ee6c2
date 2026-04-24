import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";

import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { supabase } from "@/integrations/supabase/client";
import {
  extractMacEquipmentInfo,
  formatMacDisplay,
  isViableMacSearchTerm,
  normalizeMacSearchTerm,
  type MacEquipmentInfo,
} from "@/lib/lotericaMac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;
const MAC_LOOKUP_MIGRATION = "20260424123000_loterica_mac_lookup.sql";

interface MacLookupRpcRow {
  cod_ul: string;
  nome_loterica: string | null;
  ccto_oi: string | null;
  ccto_oemp: string | null;
  designacao_nova: string | null;
  operadora: string | null;
  cidade: string | null;
  uf: string | null;
  status: string | null;
  matched_field: string;
  matched_value: string;
  raw_data: Record<string, unknown> | null;
  total_count: number;
}

interface MacLookupDisplayRow extends MacLookupRpcRow {
  equipment: MacEquipmentInfo;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const getSupabaseErrorMessage = (error: { message?: string } | null | undefined) => String(error?.message || "");

const buildMacLookupMissingFunctionMessage = () =>
  "Banco desatualizado: falta a funcao search_lotericas_by_mac.\n" +
  `Aplique a migration Supabase '${MAC_LOOKUP_MIGRATION}'.`;

const statusColor = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized.includes("ATIVO")) return "bg-success/15 text-success border-success/30";
  if (normalized.includes("SUSPEN") || normalized.includes("CANCEL")) return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-warning/15 text-warning border-warning/30";
};

export default function ConsultaMac() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setLotericaTab } = useSidebarActions();
  const initialQuery = String(searchParams.get("q") || "").trim();

  const [search, setSearch] = useState(initialQuery);
  const [submittedSearch, setSubmittedSearch] = useState(initialQuery);
  const [results, setResults] = useState<MacLookupDisplayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedSubmittedSearch = useMemo(() => normalizeMacSearchTerm(submittedSearch), [submittedSearch]);
  const submittedSearchTooShort = submittedSearch.length > 0 && !isViableMacSearchTerm(submittedSearch);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const loadResults = useCallback(async (term: string, targetPage: number) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    if (!isViableMacSearchTerm(trimmed)) {
      setResults([]);
      setTotal(0);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const normalizedSearch = normalizeMacSearchTerm(trimmed);
      const { data, error } = await supabase.rpc("search_lotericas_by_mac", {
        search_mac: normalizedSearch,
        page_size: PAGE_SIZE,
        page_offset: targetPage * PAGE_SIZE,
      });

      if (error) {
        const errorMessage = getSupabaseErrorMessage(error);
        const displayMessage =
          errorMessage.includes("search_lotericas_by_mac") && errorMessage.includes("Could not find the function")
            ? buildMacLookupMissingFunctionMessage()
            : "Erro ao consultar MAC Address.";

        console.error("Erro ao consultar MAC Address", error);
        setResults([]);
        setTotal(0);
        setErrorMessage(displayMessage);
        return;
      }

      const rows = ((data || []) as MacLookupRpcRow[]).map((row) => {
        const rawData = asRecord(row.raw_data);
        return {
          ...row,
          raw_data: rawData,
          equipment: extractMacEquipmentInfo(rawData, row.matched_field, row.matched_value, normalizedSearch),
        };
      });

      setResults(rows);
      setTotal(Number(rows[0]?.total_count || 0));
    } catch (error) {
      console.error("Falha inesperada ao consultar MAC Address", error);
      setResults([]);
      setTotal(0);
      setErrorMessage("Falha inesperada ao consultar MAC Address.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults(submittedSearch, page);
  }, [loadResults, page, submittedSearch]);

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextQuery = search.trim();

    setSearchParams(nextQuery ? { q: nextQuery } : {});

    if (page !== 0) {
      setPage(0);
    }

    if (nextQuery !== submittedSearch) {
      setSubmittedSearch(nextQuery);
      return;
    }

    if (page === 0) {
      void loadResults(nextQuery, 0);
    }
  };

  return (
    <div className="bg-background">
      <main className="container max-w-6xl px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-background via-background to-muted/40">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary">
                  Consulta dedicada
                </Badge>
                <Badge variant="outline">Base interna</Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl sm:text-4xl">Consulta MAC Address</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  Digite um MAC para localizar a UL e o equipamento relacionados a ele na base importada do sistema.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="h-14 border-primary/15 bg-background pl-12 font-mono text-base sm:text-lg"
                  />
                </div>
                <Button type="submit" className="h-14 px-8">
                  Consultar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => void loadResults(submittedSearch, page)}
                  title="Atualizar resultados"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Aceita formatos com `:` `-` `.` ou sem separador. Informe ao menos 6 caracteres hexadecimais.
              </p>
            </CardContent>
          </Card>

          {!!errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive whitespace-pre-line">
              {errorMessage}
            </div>
          )}

          {submittedSearch ? submittedSearchTooShort ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Informe ao menos 6 caracteres hexadecimais do MAC para pesquisar.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="font-mono">
                {formatMacDisplay(normalizedSubmittedSearch) || submittedSearch}
              </Badge>
              <span>{total} equipamentos encontrados</span>
              <span>Pagina {page + 1} de {totalPages || 1}</span>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                A pesquisa funciona como uma consulta dedicada, no estilo de buscador de MAC, mas retornando o equipamento vinculado dentro da sua base.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium text-muted-foreground">MAC</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Equipamento</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Codigo UL</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Nome</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Cidade/UF</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-muted-foreground">
                          Consultando...
                        </td>
                      </tr>
                    ) : results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-muted-foreground">
                          {submittedSearch && !submittedSearchTooShort ? "Nenhum MAC Address encontrado" : "Nenhuma consulta realizada"}
                        </td>
                      </tr>
                    ) : (
                      results.map((row) => (
                        <tr
                          key={`${row.cod_ul}:${row.matched_field}:${row.matched_value}`}
                          className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                          onClick={() => {
                            setLotericaTab("consulta");
                            navigate(`/loterica/${encodeURIComponent(row.cod_ul)}`);
                          }}
                        >
                          <td className="p-3 font-mono text-xs font-medium">{row.equipment.matchedMac || row.matched_value}</td>
                          <td className="p-3">
                            <div className="font-medium">{row.equipment.equipmentLabel}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {row.equipment.equipmentType}
                              {row.equipment.details ? ` | ${row.equipment.details}` : ` | Campo: ${row.equipment.matchedFieldLabel}`}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-xs font-medium">{row.cod_ul}</td>
                          <td className="p-3 font-medium">{row.nome_loterica || "-"}</td>
                          <td className="p-3 hidden lg:table-cell">
                            {row.cidade || "-"} - {row.uf || "-"}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(row.status || "")}`}>
                              {row.status || "-"}
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

          {totalPages > 1 && !submittedSearchTooShort && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
