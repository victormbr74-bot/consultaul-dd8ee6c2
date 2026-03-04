import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { supabase } from "@/integrations/supabase/client";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { formatImportBasePlanilhaSummary, importBasePlanilhaFile } from "@/lib/importBasePlanilha";
import PingaoTab from "@/components/loterica/PingaoTab";
import ScriptRouterSctTab from "@/components/loterica/ScriptRouterSctTab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const PAGE_SIZE = 20;
const EXPORT_BATCH_SIZE = 1000;
const PROFILE_EXPORT_BATCH_SIZE = 200;

const isFilled = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return String(value).trim().length > 0;
};

const firstFilled = (...values: unknown[]) => {
  for (const value of values) {
    if (isFilled(value)) return value;
  }
  return "";
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const formatDateTimePtBr = (value: unknown) => {
  const text = asString(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString("pt-BR");
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { setOnExport, setOnImportClick, setShowLotericaTabs, setLotericaTab, lotericaTab } = useSidebarActions();
  const [lotericas, setLotericas] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchLotericas = useCallback(async () => {
    if (!search.trim()) {
      setLotericas([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = `%${search.trim()}%`;
      let query = supabase.from("lotericas").select("*", { count: "exact" })
        .or(`cod_ul.ilike.${s},nome_loterica.ilike.${s},ccto_oi.ilike.${s},cidade.ilike.${s}`);

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
        setLotericaTab("consulta");
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

      setLotericaTab("consulta");
      navigate(`/loterica/${encodeURIComponent(first)}`);
    } catch (error) {
      console.error("Falha inesperada ao buscar lotericas (atalho Enter)", error);
      alert("Falha inesperada ao buscar lot\u00E9ricas.");
    }
  }, [navigate, search, setLotericaTab]);

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

      const updatedByIds = Array.from(new Set(allRows.map((row) => asString(row.updated_by)).filter(Boolean)));
      const profileById = new Map<string, { name: string | null; user_code: string | null }>();

      if (updatedByIds.length > 0) {
        for (let index = 0; index < updatedByIds.length; index += PROFILE_EXPORT_BATCH_SIZE) {
          const batch = updatedByIds.slice(index, index + PROFILE_EXPORT_BATCH_SIZE);
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id,name,user_code")
            .in("id", batch);

          if (profileError) {
            console.error("Falha ao buscar perfis para exportacao", profileError);
            break;
          }

          (profiles || []).forEach((profile) => {
            profileById.set(profile.id, {
              name: profile.name ?? null,
              user_code: profile.user_code ?? null,
            });
          });
        }
      }

      const exportData = allRows.map((row) => {
        const raw = asRecord(row.raw_data);

        const codUl = firstFilled(row.cod_ul, raw.cod_ul, raw["CODIGO DA LOTERICA_"], raw["CÓDIGO DA LOTÉRICA_"]);
        const nomeLoterica = firstFilled(row.nome_loterica, raw.nome_loterica, raw["NOME UL"]);
        const cctoOi = firstFilled(row.ccto_oi, raw.ccto_oi, raw["CCTO OI"]);
        const cctoOemp = firstFilled(row.ccto_oemp, raw.ccto_oemp, raw["CCTO OEMP"]);
        const designacaoNova = firstFilled(row.designacao_nova, raw.designacao_nova, raw["DESIGINACAO NOVA"]);
        const operadora = firstFilled(row.operadora, raw.operadora, raw["OPERADORA 4G"]);
        const ipNat = firstFilled(row.ip_nat, raw.ip_nat, raw["IP NAT"]);
        const ipWan = firstFilled(row.ip_wan, raw.ip_wan, raw["IP WAN"]);
        const loopbackPrincipal = firstFilled(row.loopback_wan, raw.loopback_wan, raw["LOOPBACK PRINCIPAL"]);
        const loopbackSecundario = firstFilled(
          row.loopback_lan,
          raw.loopback_lan,
          raw["LOOPBACK SECUNDARIO"],
          raw["LOOPBACK SECUNDÁRIO"],
          raw["LOOPBACK SECUNDÃRIO"],
        );
        const endereco = firstFilled(row.endereco, raw.endereco, raw["ENDERECO"], raw["ENDEREÇO"], raw["ENDEREÃ‡O"]);
        const contato = firstFilled(row.contato, raw.contato, raw["CONTATO"]);
        const status = firstFilled(row.status, raw.status, raw["STATUS UL"]);
        const cidade = firstFilled(row.cidade, raw.cidade, raw["MUNICIPIO"], raw["MUNICÍPIO"], raw["CIDADE"]);
        const uf = firstFilled(row.uf, raw.uf, raw["UF"]);

        const redeLan = firstFilled(raw["REDE LAN"], raw["REDE_LAN"], row.loopback_lan);
        const ipSwitch = firstFilled(raw["IP SWITCH"], raw["LOOPBACK SWITCH"]);
        const tfl = firstFilled(raw["TFL"], raw["TFLs"], raw["TFLS"]);
        const circuitoOemp = firstFilled(raw["CIRCUITO OEMP"]);
        const circuitoMeraki = firstFilled(raw["CIRCUITO MERAKI"], raw["CIRCUITOS MERAKI"], raw["MERAKI"]);
        const empresaOemp = firstFilled(raw["EMPRESA OEMP"]);
        const tipoUl = firstFilled(raw["TIPO LOTERICA"], raw["TIPO UL"]);
        const perimetro = firstFilled(raw["PERIMETRO"], raw["PERÍMETRO"], raw["PERÃMETRO"]);
        const tecnologia = firstFilled(raw["TECNOLOGIA"]);
        const modeloRoteador = firstFilled(raw["MODELO ROTEADOR"]);
        const simCard4g = firstFilled(raw["SIM CARD 4G"]);
        const owner = firstFilled(raw["OWNER"]);
        const respBackup = firstFilled(raw["RESP BACKUP"]);
        const regiao = firstFilled(raw["REGIAO"], raw["REGIÃO"], raw["REGIÃƒO"]);
        const cep = firstFilled(raw["CEP"]);
        const migracao = firstFilled(raw["MIGRACAO"], raw["MIGRAÇÃO"], raw["MIGRAÃ‡ÃƒO"]);
        const homologado = firstFilled(raw["HOMOLOGADO"]);

        const updatedBy = asString(row.updated_by);
        const updaterProfile = updatedBy ? profileById.get(updatedBy) : undefined;
        const updatedByDisplay = [updaterProfile?.user_code, updaterProfile?.name].filter(Boolean).join(" - ");
        const updatedAt = firstFilled(row.updated_at, raw.updated_at, raw["ATUALIZADO EM"]);

        return {
          ...raw,
          cod_ul: codUl,
          nome_loterica: nomeLoterica,
          ccto_oi: cctoOi,
          ccto_oemp: cctoOemp,
          designacao_nova: designacaoNova,
          operadora,
          ip_nat: ipNat,
          ip_wan: ipWan,
          loopback_wan: loopbackPrincipal,
          loopback_lan: loopbackSecundario,
          endereco,
          contato,
          status,
          cidade,
          uf,
          "CODIGO DA LOTERICA_": codUl,
          "NOME UL": nomeLoterica,
          "CCTO OI": cctoOi,
          "CCTO OEMP": cctoOemp,
          "DESIGINACAO NOVA": designacaoNova,
          "OPERADORA 4G": operadora,
          "IP NAT": ipNat,
          "IP WAN": ipWan,
          "LOOPBACK PRINCIPAL": loopbackPrincipal,
          "LOOPBACK SECUNDARIO": loopbackSecundario,
          ENDERECO: endereco,
          CONTATO: contato,
          "STATUS UL": status,
          MUNICIPIO: cidade,
          UF: uf,
          "Codigo UL": codUl,
          "Nome Loterica": nomeLoterica,
          "Rede LAN": redeLan,
          "IP Switch": ipSwitch,
          TFL: tfl,
          "Circuito OEMP": circuitoOemp,
          "Circuitos Meraki": circuitoMeraki,
          "Empresa OEMP": empresaOemp,
          "Tipo UL": tipoUl,
          Perimetro: perimetro,
          Tecnologia: tecnologia,
          "Modelo Roteador": modeloRoteador,
          "SIM Card 4G": simCard4g,
          Owner: owner,
          "Resp. Backup": respBackup,
          Regiao: regiao,
          CEP: cep,
          Migracao: migracao,
          Homologado: homologado,
          updated_at: updatedAt,
          "ATUALIZADO EM": updatedAt,
          "DATA/HORA ATUALIZACAO": formatDateTimePtBr(updatedAt),
          updated_by: updatedBy,
          "USUARIO QUE ALTEROU": updatedByDisplay || updatedBy,
          "CODIGO USUARIO QUE ALTEROU": updaterProfile?.user_code ?? "",
          "NOME USUARIO QUE ALTEROU": updaterProfile?.name ?? "",
        };
      });
      const wb = jsonToWorkbook([{ name: "Lotericas", data: exportData }]);
      await writeFile(wb, "lotericas_export.xlsx");
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
      const result = await importBasePlanilhaFile(file, {
        strictBase: false,
        preserveLotericas: true,
      });
      alert(formatImportBasePlanilhaSummary(result));
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
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={handleImport}
        disabled={importing}
      />
      <main className="container px-4 py-6 max-w-6xl">
        {lotericaTab === "pingao" ? (
          <PingaoTab />
        ) : lotericaTab === "script-router-sct" ? (
          <ScriptRouterSctTab />
        ) : (
          <>
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

        {search.trim() ? (
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span>{total} {"lot\u00E9ricas encontradas"}</span>
            <span>{"P\u00E1gina"} {page + 1} {"de"} {totalPages || 1}</span>
          </div>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground">
            Digite um código, nome, CCTO ou cidade para pesquisar.
          </div>
        )}

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
                        onClick={() => {
                          setLotericaTab("consulta");
                          navigate(`/loterica/${encodeURIComponent(l.cod_ul)}`);
                        }}
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
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
