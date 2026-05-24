import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { buildCodUlExactCandidates, buildCodUlSearchVariants, normalizeCodUlTerm } from "@/lib/lotericaCodUl";
import { buildCircuitSearchVariants } from "@/lib/lotericaCircuito";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { formatImportBasePlanilhaSummary, importBasePlanilhaFile, type ImportBasePlanilhaProgress } from "@/lib/importBasePlanilha";
import PingaoTab from "@/components/loterica/PingaoTab";
import ScriptRouterSctTab from "@/components/loterica/ScriptRouterSctTab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

const parseCodUlTerms = (value: string) => {
  const parts = String(value || "")
    .split(/[\n,;\t]+/)
    .map((term) => normalizeCodUlTerm(term))
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const key = part.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }

  return result;
};

const buildDashboardSearchFilter = (value: string) => {
  const term = String(value || "").trim();
  if (!term) return "";

  const filters = new Set<string>([
    `nome_loterica.ilike.%${term}%`,
    `cidade.ilike.%${term}%`,
  ]);

  for (const candidate of buildCircuitSearchVariants(term)) {
    filters.add(`ccto_oi.ilike.%${candidate}%`);
    filters.add(`ccto_oemp.ilike.%${candidate}%`);
  }

  for (const candidate of buildCodUlSearchVariants(term)) {
    filters.add(`cod_ul.ilike.%${candidate}%`);
  }

  return [...filters].join(",");
};

const formatDateTimePtBr = (value: unknown) => {
  const text = asString(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString("pt-BR");
};

const LEGACY_EXPORT_HEADERS = [
  "Código UL",
  "Nome Lotérica",
  "CCTO OI",
  "CCTO OEMP",
  "Designação Nova",
  "Operadora",
  "IP NAT",
  "IP WAN",
  "Loopback Principal",
  "Loopback Secundário",
  "Rede LAN",
  "Endereço",
  "Contato",
  "Status",
  "Cidade",
  "UF",
  "IP Switch",
  "TFL",
  "Circuito OEMP",
  "Circuitos Meraki",
  "Empresa OEMP",
  "Tipo UL",
  "Perímetro",
  "Tecnologia",
  "Modelo Roteador",
  "SIM Card 4G",
  "Owner",
  "Resp. Backup",
  "Região",
  "CEP",
  "Migração",
  "Homologado",
  "Atualizado em",
] as const;

const USER_EXPORT_HEADERS = [
  "Usuário que alterou",
  "Código usuário que alterou",
  "Nome usuário que alterou",
] as const;

const normalizeHeaderKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");

const BASE_ALIAS_KEYS = [
  "cod_ul",
  "nome_loterica",
  "ccto_oi",
  "ccto_oemp",
  "designacao_nova",
  "operadora",
  "ip_nat",
  "ip_wan",
  "loopback_wan",
  "loopback_lan",
  "endereco",
  "contato",
  "status",
  "cidade",
  "uf",
  "updated_at",
  "updated_by",
  "CODIGO DA LOTERICA_",
  "CÓDIGO DA LOTÉRICA_",
  "NOME UL",
  "STATUS UL",
  "MUNICIPIO",
  "MUNICÍPIO",
  "REDE LAN",
  "REDE_LAN",
  "IP SWITCH",
  "LOOPBACK SWITCH",
  "TFLs",
  "TFLS",
  "CIRCUITO MERAKI",
  "CIRCUITOS MERAKI",
  "TIPO LOTERICA",
  "TIPO UL",
  "PERIMETRO",
  "PERÍMETRO",
  "SIM CARD 4G",
  "RESP BACKUP",
  "MIGRACAO",
  "MIGRAÇÃO",
] as const;

const BASE_NORMALIZED_HEADER_KEYS = new Set<string>([
  ...LEGACY_EXPORT_HEADERS.map((header) => normalizeHeaderKey(header)),
  ...BASE_ALIAS_KEYS.map((key) => normalizeHeaderKey(key)),
]);

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    setOnExport,
    setOnImportClick,
    setOnSearchSubmit,
    setShowLotericaTabs,
    setLotericaTab,
    lotericaTab,
    consultaSearch: sidebarSearch,
    setConsultaSearch,
  } = useSidebarActions();
  const [lotericas, setLotericas] = useState<Tables<"lotericas">[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportBasePlanilhaProgress | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const search = sidebarSearch;

  const fetchLotericas = useCallback(async () => {
    const term = search.trim();
    if (!term) {
      setLotericas([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const exactCandidates = buildCodUlExactCandidates(term);

      if (exactCandidates.length > 1 || (exactCandidates.length === 1 && exactCandidates[0] !== term.toUpperCase())) {
        const { data, count, error } = await supabase
          .from("lotericas")
          .select("*", { count: "exact" })
          .in("cod_ul", exactCandidates)
          .order("cod_ul")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
          console.error("Erro ao buscar lotericas por codigo", error);
        } else if ((count || 0) > 0) {
          setLotericas(data || []);
          setTotal(count || 0);
          return;
        }
      }

      const orFilter = buildDashboardSearchFilter(term);
      const query = supabase.from("lotericas").select("*", { count: "exact" }).or(orFilter);

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

    const parsedTerms = parseCodUlTerms(term);
    if (parsedTerms.length > 1) {
      alert("Para consultar varias ULs ao mesmo tempo, use o menu Consulta Massa.");
      return;
    }

    const singleTerm = parsedTerms[0] || normalizeCodUlTerm(term) || term;

    try {
      const exactCandidates = buildCodUlExactCandidates(singleTerm);
      let codUl: string | undefined;

      if (exactCandidates.length > 0) {
        const { data: exactRows, error: exactError } = await supabase
          .from("lotericas")
          .select("cod_ul")
          .in("cod_ul", exactCandidates)
          .order("cod_ul")
          .limit(1);

        if (exactError) {
          console.error("Erro ao buscar loterica por codigo", exactError);
        } else {
          codUl = exactRows?.[0]?.cod_ul;
        }
      }

      if (codUl) {
        setLotericaTab("consulta");
        navigate(`/loterica/${encodeURIComponent(codUl)}`);
        return;
      }

      const orFilter = buildDashboardSearchFilter(singleTerm);
      const { data, error } = await supabase
        .from("lotericas")
        .select("cod_ul")
        .or(orFilter)
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

      const preparedRows = allRows.map((row) => {
        const raw = asRecord(row.raw_data);
        const rawByNormalized = new Map<string, unknown>();
        Object.entries(raw).forEach(([key, value]) => {
          const normalized = normalizeHeaderKey(key);
          if (normalized && !rawByNormalized.has(normalized)) {
            rawByNormalized.set(normalized, value);
          }
        });

        const pickRaw = (...aliases: string[]) => {
          for (const alias of aliases) {
            const value = rawByNormalized.get(normalizeHeaderKey(alias));
            if (isFilled(value)) return value;
          }
          return "";
        };

        const codUl = firstFilled(row.cod_ul, pickRaw("CODIGO DA LOTERICA_", "CÓDIGO DA LOTÉRICA_", "cod_ul"));
        const nomeLoterica = firstFilled(row.nome_loterica, pickRaw("NOME UL", "nome_loterica"));
        const cctoOi = firstFilled(row.ccto_oi, pickRaw("CCTO OI", "ccto_oi"));
        const cctoOemp = firstFilled(row.ccto_oemp, pickRaw("CCTO OEMP", "ccto_oemp"));
        const designacaoNova = firstFilled(row.designacao_nova, pickRaw("DESIGINACAO NOVA", "DESIGNAÇÃO NOVA", "designacao_nova"));
        const operadora = firstFilled(row.operadora, pickRaw("OPERADORA 4G", "operadora"));
        const ipNat = firstFilled(row.ip_nat, pickRaw("IP NAT", "ip_nat"));
        const ipWan = firstFilled(row.ip_wan, pickRaw("IP WAN", "ip_wan"));
        const loopbackPrincipal = firstFilled(row.loopback_wan, pickRaw("LOOPBACK PRINCIPAL", "loopback_wan"));
        const loopbackSecundario = firstFilled(
          row.loopback_lan,
          pickRaw("LOOPBACK SECUNDARIO", "LOOPBACK SECUNDÁRIO", "loopback_lan"),
        );
        const endereco = firstFilled(row.endereco, pickRaw("ENDERECO", "ENDEREÇO", "endereco"));
        const contato = firstFilled(row.contato, pickRaw("CONTATO", "contato"));
        const status = firstFilled(row.status, pickRaw("STATUS UL", "status"));
        const cidade = firstFilled(row.cidade, pickRaw("MUNICIPIO", "MUNICÍPIO", "CIDADE", "cidade"));
        const uf = firstFilled(row.uf, pickRaw("UF", "uf"));
        const updatedAtRaw = firstFilled(row.updated_at, pickRaw("ATUALIZADO EM", "updated_at"));

        const updatedBy = asString(row.updated_by);
        const updaterProfile = updatedBy ? profileById.get(updatedBy) : undefined;
        const updatedByDisplay = [updaterProfile?.user_code, updaterProfile?.name].filter(Boolean).join(" - ");

        const baseData: Record<(typeof LEGACY_EXPORT_HEADERS)[number], unknown> = {
          "Código UL": codUl,
          "Nome Lotérica": nomeLoterica,
          "CCTO OI": cctoOi,
          "CCTO OEMP": cctoOemp,
          "Designação Nova": designacaoNova,
          "Operadora": operadora,
          "IP NAT": ipNat,
          "IP WAN": ipWan,
          "Loopback Principal": loopbackPrincipal,
          "Loopback Secundário": loopbackSecundario,
          "Rede LAN": firstFilled(pickRaw("REDE LAN", "REDE_LAN"), row.loopback_lan),
          "Endereço": endereco,
          "Contato": contato,
          "Status": status,
          "Cidade": cidade,
          UF: uf,
          "IP Switch": pickRaw("IP SWITCH", "LOOPBACK SWITCH"),
          TFL: pickRaw("TFL", "TFLs", "TFLS"),
          "Circuito OEMP": pickRaw("CIRCUITO OEMP"),
          "Circuitos Meraki": pickRaw("CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI"),
          "Empresa OEMP": pickRaw("EMPRESA OEMP"),
          "Tipo UL": pickRaw("TIPO LOTERICA", "TIPO UL"),
          "Perímetro": pickRaw("PERIMETRO", "PERÍMETRO"),
          Tecnologia: pickRaw("TECNOLOGIA"),
          "Modelo Roteador": pickRaw("MODELO ROTEADOR"),
          "SIM Card 4G": pickRaw("SIM CARD 4G"),
          Owner: pickRaw("OWNER"),
          "Resp. Backup": pickRaw("RESP BACKUP"),
          "Região": pickRaw("REGIAO", "REGIÃO"),
          CEP: pickRaw("CEP"),
          "Migração": pickRaw("MIGRACAO", "MIGRAÇÃO"),
          Homologado: pickRaw("HOMOLOGADO"),
          "Atualizado em": formatDateTimePtBr(updatedAtRaw),
        };

        const userData: Record<(typeof USER_EXPORT_HEADERS)[number], unknown> = {
          "Usuário que alterou": updatedByDisplay || updatedBy,
          "Código usuário que alterou": updaterProfile?.user_code ?? "",
          "Nome usuário que alterou": updaterProfile?.name ?? "",
        };

        return { raw, rawByNormalized, baseData, userData };
      });

      const extraHeaders: Array<{ label: string; normalized: string }> = [];
      const seenExtra = new Set<string>();

      preparedRows.forEach(({ raw }) => {
        Object.keys(raw).forEach((key) => {
          const normalized = normalizeHeaderKey(key);
          if (!normalized || BASE_NORMALIZED_HEADER_KEYS.has(normalized) || seenExtra.has(normalized)) return;
          seenExtra.add(normalized);
          extraHeaders.push({ label: key, normalized });
        });
      });

      const exportData = preparedRows.map(({ rawByNormalized, baseData, userData }) => {
        const orderedRow: Record<string, unknown> = {};

        LEGACY_EXPORT_HEADERS.forEach((header) => {
          orderedRow[header] = baseData[header] ?? "";
        });

        extraHeaders.forEach(({ label, normalized }) => {
          orderedRow[label] = firstFilled(rawByNormalized.get(normalized), "");
        });

        USER_EXPORT_HEADERS.forEach((header) => {
          orderedRow[header] = userData[header] ?? "";
        });

        return orderedRow;
      });

      const wb = jsonToWorkbook([{ name: "Lotéricas", data: exportData }]);
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
    setImportSummary(null);
    setImportErrorMessage(null);
    setImportProgress({ phase: "reading", percent: 0, message: "Iniciando importacao da base..." });
    try {
      const result = await importBasePlanilhaFile(file, {
        strictBase: false,
        preserveLotericas: true,
        onProgress: (evt) => {
          setImportProgress(evt);
        },
      });
      const summary = formatImportBasePlanilhaSummary(result);
      setImportSummary(summary);
      setImportProgress({ phase: "completed", percent: 100, message: "Importacao concluida com sucesso." });
      void fetchLotericas();
    } catch (error) {
      console.error("Falha inesperada na importacao", error);
      const message = "Falha inesperada na importacao: " + (error instanceof Error ? error.message : String(error));
      setImportErrorMessage(message);
      alert(message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  useLayoutEffect(() => {
    setShowLotericaTabs(false);
    setOnExport(() => handleExport);
    setOnImportClick(() => () => importRef.current?.click());
    setOnSearchSubmit(() => () => {
      void goToFirstResult();
    });
    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
      setOnSearchSubmit(undefined);
    };
  }, [sidebarSearch, goToFirstResult, handleExport, setOnExport, setOnImportClick, setOnSearchSubmit, setShowLotericaTabs]);

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
              onChange={(e) => setConsultaSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void goToFirstResult();
                }
              }}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => void fetchLotericas()} title="Atualizar resultados">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {(importing || importProgress || importSummary || importErrorMessage) && (
          <Card className="mb-4">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Status da importacao da base</p>
                <span className="text-xs text-muted-foreground">
                  {importing ? "Importando..." : importErrorMessage ? "Falha" : importSummary ? "Concluida" : "Aguardando"}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{importProgress?.message || "Aguardando importacao..."}</span>
                  <span>{Math.round(importProgress?.percent || 0)}%</span>
                </div>
                <Progress value={importProgress?.percent || 0} />
              </div>

              {!!importErrorMessage && <p className="text-xs text-destructive whitespace-pre-line">{importErrorMessage}</p>}
              {!!importSummary && !importing && !importErrorMessage && (
                <p className="text-xs text-green-700 whitespace-pre-line">{importSummary}</p>
              )}
            </CardContent>
          </Card>
        )}

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
