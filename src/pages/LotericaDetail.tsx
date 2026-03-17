import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { normalizeCodUlTerm } from "@/lib/lotericaCodUl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, History, Save } from "lucide-react";
import ConsultaTab from "@/components/loterica/ConsultaTab";
import MascaraTab from "@/components/loterica/MascaraTab";
import TestesTab from "@/components/loterica/TestesTab";
import Ping99Tab from "@/components/loterica/Ping99Tab";
import PingaoTab from "@/components/loterica/PingaoTab";
import PingaoNatTab from "@/components/loterica/PingaoNatTab";
import ScriptRouterSctTab from "@/components/loterica/ScriptRouterSctTab";

const EDITABLE_KEYS = [
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
] as const;

const RAW_EDITABLE_KEYS: string[][] = [
  ["REDE LAN"],
  ["IP SWITCH", "LOOPBACK SWITCH"],
  ["TFL", "TFLs"],
  ["CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI"],
  ["EMPRESA OEMP"],
  ["TIPO LOTERICA", "TIPO UL"],
  ["PERIMETRO", "PERÍMETRO"],
  ["TECNOLOGIA"],
  ["MODELO ROTEADOR"],
  ["SIM CARD 4G"],
  ["OWNER"],
  ["RESP BACKUP"],
  ["REGIAO", "REGIÃO"],
  ["CEP"],
  ["MIGRACAO", "MIGRAÇÃO"],
  ["HOMOLOGADO"],
];

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseCodUlTerms = (value: string | undefined) => {
  const decoded = safeDecode(String(value || ""));
  const parts = decoded
    .split(/[\n,;\t ]+/)
    .map((term) => normalizeCodUlTerm(term))
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const normalized = part.toUpperCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(part);
  }

  return result;
};

const getRawValueByAliases = (obj: any, aliases: string[]) => {
  for (const alias of aliases) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, alias)) return obj[alias];
  }
  return undefined;
};

const normalizeLotericaRecord = (row: any) => {
  const raw = row?.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};
  const rawRedeLan = String(raw["REDE LAN"] || "").trim();
  const rawLoopbackSec = String(raw["LOOPBACK SECUNDARIO"] || raw["LOOPBACK SECUNDÁRIO"] || raw["LOOPBACK SECUNDÃƒÂRIO"] || "").trim();
  const currentLoopbackLan = String(row?.loopback_lan || "").trim();

  // Corrige registros antigos onde loopback_lan foi importado como REDE LAN.
  if (rawLoopbackSec && (!currentLoopbackLan || currentLoopbackLan === rawRedeLan) && rawLoopbackSec !== rawRedeLan) {
    return { ...row, loopback_lan: rawLoopbackSec };
  }

  return row;
};

const buildChangePayload = (beforeRecord: any, afterRecord: any) => {
  const changes: Record<string, unknown> = {};
  const beforeChanges: Record<string, unknown> = {};

  for (const key of EDITABLE_KEYS) {
    const beforeValue = beforeRecord?.[key] ?? null;
    const afterValue = afterRecord?.[key] ?? null;

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = afterValue;
      beforeChanges[key] = beforeValue;
    }
  }

  const rawBefore = beforeRecord?.raw_data && typeof beforeRecord.raw_data === "object" ? beforeRecord.raw_data : {};
  const rawAfter = afterRecord?.raw_data && typeof afterRecord.raw_data === "object" ? afterRecord.raw_data : {};

  const rawChanged = RAW_EDITABLE_KEYS.some((aliases) => {
    const beforeValue = getRawValueByAliases(rawBefore, aliases);
    const afterValue = getRawValueByAliases(rawAfter, aliases);
    return JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);
  });

  if (rawChanged) {
    changes.raw_data = rawAfter;
    beforeChanges.raw_data = rawBefore;
  }

  return { changes, beforeChanges };
};

const LotericaDetail = () => {
  const { codUl } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { lotericaTab, setLotericaTab, setShowLotericaTabs, setOnExport, setOnImportClick } = useSidebarActions();

  const requestedCodes = useMemo(() => parseCodUlTerms(codUl), [codUl]);
  const isBulkMode = requestedCodes.length > 1;
  const activeCode = requestedCodes[0] || "";

  const [queryInput, setQueryInput] = useState("");
  const [lotericas, setLotericas] = useState<any[]>([]);
  const [formsByCode, setFormsByCode] = useState<Record<string, any>>({});
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lotericaUpdatesEnabled, setLotericaUpdatesEnabled] = useState(true);
  const [lotericaUpdatesLoading, setLotericaUpdatesLoading] = useState(true);
  const [lotericaUpdatesError, setLotericaUpdatesError] = useState<string | null>(null);

  useLayoutEffect(() => {
    setShowLotericaTabs(true);
    setOnExport(undefined);
    setOnImportClick(undefined);
    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
    };
  }, [setShowLotericaTabs, setOnExport, setOnImportClick]);

  useEffect(() => {
    setQueryInput(requestedCodes.join(", "));
  }, [requestedCodes]);

  useEffect(() => {
    if (isBulkMode && lotericaTab !== "consulta") {
      setLotericaTab("consulta");
    }
  }, [isBulkMode, lotericaTab, setLotericaTab]);

  useEffect(() => {
    const fetchLotericas = async () => {
      setLoading(true);
      setShowHistory(false);
      setHistory([]);
      try {
        if (!requestedCodes.length) {
          setLotericas([]);
          setFormsByCode({});
          setMissingCodes([]);
          return;
        }

        const queryCodes = Array.from(new Set(requestedCodes.flatMap((code) => [code, code.toUpperCase()])));
        const { data, error } = await supabase.from("lotericas").select("*").in("cod_ul", queryCodes);

        if (error) {
          console.error("Erro ao carregar lotericas", error);
          setLotericas([]);
          setFormsByCode({});
          setMissingCodes([...requestedCodes]);
          return;
        }

        const byCode = new Map<string, any>();
        for (const row of data || []) {
          const code = String((row as any)?.cod_ul || "").trim().toUpperCase();
          if (!code || byCode.has(code)) continue;
          byCode.set(code, normalizeLotericaRecord(row));
        }

        const orderedRows = requestedCodes
          .map((code) => byCode.get(code.toUpperCase()))
          .filter((item): item is any => Boolean(item));

        const nextForms: Record<string, any> = {};
        for (const row of orderedRows) {
          const code = String(row?.cod_ul || "").trim();
          if (!code) continue;
          nextForms[code] = row;
        }

        const notFound = requestedCodes.filter((code) => !byCode.has(code.toUpperCase()));

        setLotericas(orderedRows);
        setFormsByCode(nextForms);
        setMissingCodes(notFound);
      } catch (error) {
        console.error("Falha inesperada ao carregar lotericas", error);
        setLotericas([]);
        setFormsByCode({});
        setMissingCodes([...requestedCodes]);
      } finally {
        setLoading(false);
      }
    };

    void fetchLotericas();
  }, [requestedCodes]);

  useEffect(() => {
    const fetchLotericaUpdatesSetting = async () => {
      setLotericaUpdatesLoading(true);
      setLotericaUpdatesError(null);
      try {
        const { data, error } = await (supabase as any)
          .from("app_settings")
          .select("value_boolean")
          .eq("key", "loterica_updates_enabled")
          .maybeSingle();

        if (error) {
          const msg = String((error as any)?.message || "");
          if (msg.includes("app_settings") && msg.includes("Could not find the table")) {
            setLotericaUpdatesEnabled(true);
            setLotericaUpdatesError(
              "Banco desatualizado: falta a tabela app_settings.\n" +
                "Aplique a migracao Supabase '20260306103000_loterica_updates_global_toggle.sql'.",
            );
            return;
          }
          throw new Error(msg || "Erro ao carregar configuracao de atualizacao.");
        }

        setLotericaUpdatesEnabled(Boolean((data as any)?.value_boolean ?? true));
      } catch (error) {
        console.error("Falha inesperada ao carregar configuracao de atualizacao", error);
        setLotericaUpdatesEnabled(true);
        setLotericaUpdatesError(error instanceof Error ? error.message : "Erro ao carregar configuracao de atualizacao.");
      } finally {
        setLotericaUpdatesLoading(false);
      }
    };

    void fetchLotericaUpdatesSetting();
  }, []);

  const activeForm = activeCode ? formsByCode[activeCode] || lotericas[0] || {} : {};

  const fetchHistory = async () => {
    if (!activeCode) {
      alert("Informe um codigo UL para consultar o historico.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("loterica_history")
        .select("*, profiles:changed_by(name)")
        .eq("cod_ul", activeCode)
        .order("changed_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Erro ao carregar historico", error);
        alert("Erro ao carregar historico.");
        return;
      }

      setHistory(data || []);
      setShowHistory(true);
    } catch (error) {
      console.error("Falha inesperada ao carregar historico", error);
      alert("Falha inesperada ao carregar historico.");
    }
  };

  const handleConsult = useCallback(() => {
    const codes = parseCodUlTerms(queryInput);
    if (!codes.length) {
      alert("Informe ao menos um codigo UL para consultar.");
      return;
    }

    setLotericaTab("consulta");
    navigate(`/loterica/${encodeURIComponent(codes.join(","))}`);
  }, [navigate, queryInput, setLotericaTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!lotericas.length) {
        alert("Nenhuma loterica carregada para salvar.");
        return;
      }

      if (!user?.id) {
        alert("Sessao invalida. Faca login novamente.");
        return;
      }

      if (!isAdmin && lotericaUpdatesLoading) {
        alert("Aguarde: validando permissao de atualizacao.");
        return;
      }

      if (!isAdmin && !lotericaUpdatesEnabled) {
        alert("Atualizacao de dados bloqueada pelo ADM para usuarios.");
        return;
      }

      const originalByCode = new Map<string, any>();
      for (const row of lotericas) {
        const code = String(row?.cod_ul || "").trim();
        if (!code) continue;
        originalByCode.set(code, row);
      }

      const pendingChanges = lotericas
        .map((row) => {
          const code = String(row?.cod_ul || "").trim();
          const currentForm = formsByCode[code] || row;
          const { changes, beforeChanges } = buildChangePayload(row, currentForm);
          return { code, changes, beforeChanges };
        })
        .filter((item) => item.code && Object.keys(item.changes).length > 0);

      if (!pendingChanges.length) {
        alert("Nenhuma alteracao para salvar.");
        return;
      }

      if (isAdmin) {
        const successCodes: string[] = [];
        const errors: string[] = [];
        const appliedByCode = new Map<string, Record<string, unknown>>();

        for (const item of pendingChanges) {
          const updatedAt = new Date().toISOString();
          const { error } = await supabase
            .from("lotericas")
            .update({ ...item.changes, updated_by: user.id, updated_at: updatedAt })
            .eq("cod_ul", item.code);

          if (error) {
            errors.push(`${item.code}: ${error.message}`);
            continue;
          }

          successCodes.push(item.code);
          appliedByCode.set(item.code, { ...item.changes, updated_by: user.id, updated_at: updatedAt });
        }

        if (successCodes.length) {
          setLotericas((prev) =>
            prev.map((row) => {
              const code = String(row?.cod_ul || "").trim();
              const patch = appliedByCode.get(code);
              return patch ? { ...row, ...patch } : row;
            }),
          );

          setFormsByCode((prev) => {
            const next = { ...prev };
            for (const code of successCodes) {
              const current = next[code] || originalByCode.get(code) || {};
              const patch = appliedByCode.get(code) || {};
              next[code] = { ...current, ...patch };
            }
            return next;
          });
        }

        if (!errors.length) {
          alert(successCodes.length === 1 ? "Salvo com sucesso!" : `${successCodes.length} lotericas salvas com sucesso!`);
          return;
        }

        alert(`${successCodes.length} lotericas salvas. ${errors.length} com erro:\n${errors.slice(0, 5).join("\n")}`);
        return;
      }

      const successCodes: string[] = [];
      const errors: string[] = [];

      for (const item of pendingChanges) {
        const { error: reqError } = await (supabase as any).from("loterica_change_requests").insert({
          cod_ul: item.code,
          proposed_by: user.id,
          before_data: item.beforeChanges,
          after_data: item.changes,
          status: "pending",
        } as any);

        if (reqError) {
          const msg = String((reqError as any)?.message || "");
          if (msg.includes("loterica_change_requests") && msg.includes("Could not find the table")) {
            alert(
              "Banco desatualizado: falta a tabela loterica_change_requests.\n" +
                "Aplique a migracao Supabase '20260213173000_approval_workflow_and_loopback_fix.sql' e tente novamente.",
            );
            return;
          }
          if (msg.toLowerCase().includes("row-level security")) {
            alert("Atualizacao de dados bloqueada pelo ADM para usuarios.");
            return;
          }
          errors.push(`${item.code}: ${msg || "Erro ao enviar para aprovacao."}`);
          continue;
        }

        successCodes.push(item.code);
      }

      if (successCodes.length) {
        setFormsByCode((prev) => {
          const next = { ...prev };
          for (const code of successCodes) {
            const original = originalByCode.get(code);
            if (original) next[code] = original;
          }
          return next;
        });
      }

      if (!errors.length) {
        alert(
          successCodes.length === 1
            ? "Alteracao enviada para aprovacao do ADM."
            : `${successCodes.length} alteracoes enviadas para aprovacao do ADM.`,
        );
        return;
      }

      if (!successCodes.length) {
        alert(`Nenhuma alteracao enviada. Erros:\n${errors.slice(0, 5).join("\n")}`);
        return;
      }

      alert(`${successCodes.length} alteracoes enviadas. ${errors.length} com erro:\n${errors.slice(0, 5).join("\n")}`);
    } catch (error) {
      console.error("Falha inesperada ao salvar loterica", error);
      alert("Falha inesperada ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const nonAdminUpdatesBlocked = !isAdmin && !lotericaUpdatesEnabled;
  const hasLoadedRows = lotericas.length > 0;
  const saveDisabled = saving || !hasLoadedRows || (!isAdmin && (lotericaUpdatesLoading || nonAdminUpdatesBlocked));

  return (
    <div className="bg-background">
      <div className="container px-4 py-3 border-b space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            {isBulkMode ? (
              <span className="text-sm font-medium text-foreground">
                {lotericas.length}/{requestedCodes.length} lotericas carregadas
              </span>
            ) : (
              <>
                <span className="font-mono text-sm font-medium text-foreground">{activeCode || "-"}</span>
                <span className="text-sm text-muted-foreground hidden sm:inline"> - {activeForm?.nome_loterica || "-"}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isBulkMode && hasLoadedRows && (
              <Button variant="outline" size="sm" onClick={fetchHistory}>
                <History className="w-4 h-4 mr-1" /> Histórico
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saveDisabled}>
              <Save className="w-4 h-4 mr-1" />{" "}
              {saving ? "Salvando..." : isAdmin ? "Salvar" : nonAdminUpdatesBlocked ? "Bloqueado pelo ADM" : "Enviar p/ Aprovacao"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <Textarea
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Informe 1 ou mais codigos UL (separados por virgula, espaco ou quebra de linha)"
            className="min-h-[64px] font-mono text-xs"
          />
          <Button variant="outline" onClick={handleConsult} className="lg:self-start">
            Consultar codigos
          </Button>
        </div>

        {missingCodes.length > 0 && <p className="text-xs text-warning">Codigos nao encontrados: {missingCodes.join(", ")}</p>}
      </div>

      {!isAdmin && (
        <div className="container px-4 py-2 border-b">
          {lotericaUpdatesLoading ? (
            <p className="text-xs text-muted-foreground">Verificando permissao de atualizacao...</p>
          ) : nonAdminUpdatesBlocked ? (
            <p className="text-xs text-destructive">Atualizacao de dados bloqueada pelo ADM para usuarios.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Atualizacao de dados liberada para envio de aprovacao.</p>
          )}
          {!!lotericaUpdatesError && <p className="text-xs text-destructive whitespace-pre-line">{lotericaUpdatesError}</p>}
        </div>
      )}

      <main className="container px-4 py-6 max-w-5xl">
        {!hasLoadedRows ? (
          <div className="min-h-[30vh] flex items-center justify-center text-muted-foreground">
            Nenhuma loterica encontrada para os codigos informados.
          </div>
        ) : isBulkMode ? (
          <div className="space-y-8">
            {lotericas.map((row) => {
              const rowCode = String(row?.cod_ul || "").trim();
              const rowForm = formsByCode[rowCode] || row;
              return (
                <section key={rowCode} className="space-y-3">
                  <h2 className="text-base font-semibold">
                    <span className="font-mono">{rowCode}</span>
                    <span className="text-muted-foreground"> - {String(rowForm?.nome_loterica || row?.nome_loterica || "-")}</span>
                  </h2>
                  <ConsultaTab
                    form={rowForm}
                    setForm={(nextForm) => {
                      setFormsByCode((prev) => ({ ...prev, [rowCode]: nextForm }));
                    }}
                  />
                </section>
              );
            })}
          </div>
        ) : (
          <>
            {lotericaTab === "consulta" && (
              <ConsultaTab
                form={activeForm}
                setForm={(nextForm) => {
                  if (!activeCode) return;
                  setFormsByCode((prev) => ({ ...prev, [activeCode]: nextForm }));
                }}
              />
            )}
            {lotericaTab === "mascara" && <MascaraTab form={activeForm} />}
            {lotericaTab === "testes" && <TestesTab form={activeForm} />}
            {lotericaTab === "ping99" && <Ping99Tab form={activeForm} />}
            {lotericaTab === "pingao" && <PingaoTab />}
            {lotericaTab === "pingao-nat" && <PingaoNatTab />}
            {lotericaTab === "script-router-sct" && <ScriptRouterSctTab initialCodUl={activeCode} />}

            {showHistory && (
              <Card className="mt-6 animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Alterações</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((h) => (
                        <div key={h.id} className="border rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{(h as any).profiles?.name || "Desconhecido"}</span>
                            <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {h.before_data && h.after_data && (
                              <div className="space-y-1">
                                {Object.keys(h.after_data)
                                  .filter(
                                    (k) =>
                                      k !== "raw_data" &&
                                      k !== "updated_at" &&
                                      k !== "updated_by" &&
                                      JSON.stringify(h.before_data[k]) !== JSON.stringify(h.after_data[k]),
                                  )
                                  .map((k) => (
                                    <div key={k}>
                                      <span className="font-medium text-foreground">{k}:</span>{" "}
                                      <span className="text-destructive line-through">{String(h.before_data[k] ?? "")}</span>{" -> "}
                                      <span className="text-green-600">{String(h.after_data[k] ?? "")}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {isBulkMode && (
          <Card className="mt-6">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">
                Modo lote ativo. Cada loterica gera uma solicitacao individual para aprovacao.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LotericaDetail;

