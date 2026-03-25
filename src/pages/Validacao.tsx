import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { copyRichTextToClipboard } from "@/lib/richClipboard";
import {
  dedupeTerms,
  fetchLookupRows,
  normalizeText,
  parseTerms,
  resolveMatches,
  type LotericaLookupRow,
  type MatchField,
  type TermMatch,
} from "@/components/loterica/lotericaLookup";
import {
  buildEmailDraftUrl,
  buildValidationEmailText,
  buildValidationHtmlTable,
  resolveValidationDesignacao,
  resolveValidationUnidade,
  type ValidationCircuitTarget,
  type ValidationEmailRow,
} from "@/lib/validacaoEmail";
import { Check, Copy, Mail, Search, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";

interface ValidationState {
  acaoRealizada: string;
  chamado: string;
  chamadoOperadora: string;
  circuito: ValidationCircuitTarget;
  tipoFalha: string;
}

const DEFAULT_ROW_STATE: ValidationState = {
  acaoRealizada: "",
  chamado: "",
  chamadoOperadora: "",
  circuito: "primario",
  tipoFalha: "",
};

const MATCH_FIELD_LABELS: Record<MatchField, string> = {
  cod_ul: "Codigo UL",
  ccto_oi: "CCTO OI",
  ccto_oemp: "CCTO OEMP",
  designacao_nova: "Designacao",
};

const buildEmailSubject = (codes: string[]) => {
  if (!codes.length) return "Validacao de circuito";
  if (codes.length === 1) return `Validacao de circuito - ${codes[0]}`;
  return `Validacao de circuito - ${codes[0]} + ${codes.length - 1} ULs`;
};

const uniqueRowsByCode = (matches: TermMatch[]) => {
  const rows = new Map<string, LotericaLookupRow>();

  for (const match of matches) {
    if (!match.row) continue;
    const code = normalizeText(match.row.cod_ul);
    if (!code || rows.has(code)) continue;
    rows.set(code, match.row);
  }

  return [...rows.values()];
};

const Validacao = () => {
  const { setOnExport, setOnImportClick, setOnSearchSubmit, setShowLotericaTabs } = useSidebarActions();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<TermMatch[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [stateByCode, setStateByCode] = useState<Record<string, ValidationState>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useLayoutEffect(() => {
    setShowLotericaTabs(false);
    setOnExport(undefined);
    setOnImportClick(undefined);
    setOnSearchSubmit(undefined);

    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
      setOnSearchSubmit(undefined);
    };
  }, [setOnExport, setOnImportClick, setOnSearchSubmit, setShowLotericaTabs]);

  const foundRows = useMemo(() => uniqueRowsByCode(matches), [matches]);

  useEffect(() => {
    setStateByCode((prev) => {
      const next: Record<string, ValidationState> = {};

      for (const row of foundRows) {
        const code = normalizeText(row.cod_ul);
        if (!code) continue;
        next[code] = prev[code] || DEFAULT_ROW_STATE;
      }

      return next;
    });
  }, [foundRows]);

  useEffect(() => {
    const validCodes = new Set(foundRows.map((row) => normalizeText(row.cod_ul)).filter(Boolean));
    setSelectedCodes((prev) => prev.filter((code) => validCodes.has(code)));
  }, [foundRows]);

  const resultRows = useMemo(
    () =>
      matches.map((match) => {
        if (!match.row) {
          return {
            query: match.query,
            matchedBy: "-",
            nome: "-",
            primario: "-",
            secundario: "-",
            statusType: "not_found" as const,
            statusText: "Nao encontrado",
            code: "-",
          };
        }

        return {
          query: match.query,
          matchedBy: match.matchField ? MATCH_FIELD_LABELS[match.matchField] : "-",
          nome: normalizeText(match.row.nome_loterica) || "-",
          primario: resolveValidationDesignacao(match.row, "primario"),
          secundario: resolveValidationDesignacao(match.row, "secundario"),
          statusType: "ok" as const,
          statusText: "Encontrado",
          code: normalizeText(match.row.cod_ul) || "-",
        };
      }),
    [matches],
  );

  const selectedRows = useMemo(() => {
    const selected = new Set(selectedCodes);

    return foundRows
      .filter((row) => selected.has(normalizeText(row.cod_ul)))
      .map((row) => {
        const code = normalizeText(row.cod_ul);
        const state = stateByCode[code] || DEFAULT_ROW_STATE;
        return {
          code,
          unidadeLoterico: resolveValidationUnidade(row),
          designacao: resolveValidationDesignacao(row, state.circuito),
          circuito: state.circuito,
          acaoRealizada: state.acaoRealizada,
          chamado: state.chamado,
          chamadoOperadora: state.chamadoOperadora,
          tipoFalha: state.tipoFalha,
        };
      });
  }, [foundRows, selectedCodes, stateByCode]);

  const emailRows = useMemo<ValidationEmailRow[]>(
    () =>
      selectedRows.map((row) => ({
        unidadeLoterico: row.unidadeLoterico,
        designacao: row.designacao,
        circuito: row.circuito === "primario" ? "Primario" : "Secundario",
        acaoRealizada: row.acaoRealizada,
        chamado: row.chamado,
        chamadoOperadora: row.chamadoOperadora,
        tipoFalha: row.tipoFalha,
        status: "",
      })),
    [selectedRows],
  );

  const emailText = useMemo(() => buildValidationEmailText(emailRows), [emailRows]);
  const emailHtml = useMemo(() => buildValidationHtmlTable(emailRows), [emailRows]);
  const emailSubject = useMemo(() => buildEmailSubject(selectedRows.map((row) => row.code)), [selectedRows]);
  const allFoundSelected = foundRows.length > 0 && selectedCodes.length === foundRows.length;

  const setCopiedFeedback = (id: string) => {
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 1800);
  };

  const updateRowState = (code: string, patch: Partial<ValidationState>) => {
    setStateByCode((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || DEFAULT_ROW_STATE),
        ...patch,
      },
    }));
  };

  const runLookup = async () => {
    const terms = dedupeTerms(parseTerms(input));
    if (!terms.length) {
      setError("Informe ao menos um codigo UL ou circuito.");
      setMatches([]);
      setSelectedCodes([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const lookupRows = await fetchLookupRows(terms);
      const resolved = resolveMatches(terms, lookupRows);
      const foundCodes = uniqueRowsByCode(resolved).map((row) => normalizeText(row.cod_ul)).filter(Boolean);

      setMatches(resolved);
      setSelectedCodes(foundCodes);
    } catch (lookupError) {
      setMatches([]);
      setSelectedCodes([]);
      setError(String((lookupError as Error)?.message || lookupError || "Falha ao consultar lotericas."));
    } finally {
      setLoading(false);
    }
  };

  const copyText = async () => {
    if (!emailRows.length) return;
    await navigator.clipboard.writeText(emailText);
    setCopiedFeedback("text");
  };

  const copyTable = async () => {
    if (!emailRows.length) return;

    await copyRichTextToClipboard({ html: emailHtml, text: emailText });
    setCopiedFeedback("table");
  };

  const sendEmail = async () => {
    if (!emailRows.length) return;

    let clipboardReady = false;

    try {
      await copyRichTextToClipboard({ html: emailHtml, text: emailText });
      clipboardReady = true;
      setCopiedFeedback("email");
      toast.success("Tabela copiada. Cole no corpo do email com Ctrl+V.");
    } catch (error) {
      console.error("Falha ao copiar tabela para o email", error);
    }

    window.location.href = buildEmailDraftUrl({
      subject: emailSubject,
      body: emailText,
      clipboardReady,
    });
  };

  return (
    <div className="bg-background">
      <main className="container px-4 py-6 max-w-7xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" /> Validacao de Circuito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="validacao-input">Codigos UL ou circuitos (um por linha)</Label>
              <Textarea
                id="validacao-input"
                placeholder={"21-000666-8\n21-000666-3\n219123456789"}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void runLookup()} disabled={loading}>
                {loading ? "Consultando..." : "Carregar lotericas"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInput("");
                  setMatches([]);
                  setSelectedCodes([]);
                  setError("");
                }}
              >
                Limpar
              </Button>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {resultRows.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Consultas: {resultRows.length}</Badge>
                  <Badge variant="default">Encontradas: {foundRows.length}</Badge>
                  <Badge variant="outline">Selecionadas: {selectedRows.length}</Badge>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={allFoundSelected}
                    disabled={foundRows.length === 0}
                    onCheckedChange={(checked) => {
                      setSelectedCodes(
                        checked === true
                          ? foundRows.map((row) => normalizeText(row.cod_ul)).filter(Boolean)
                          : [],
                      );
                    }}
                    aria-label="Selecionar todas as lotericas encontradas"
                  />
                  <span className="text-muted-foreground">Selecionar todas as lotericas encontradas</span>
                </div>

                <div className="rounded-lg border overflow-auto max-h-[360px]">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr className="text-left">
                        <th className="p-2 font-medium">Selecionar</th>
                        <th className="p-2 font-medium">Consulta</th>
                        <th className="p-2 font-medium">Status</th>
                        <th className="p-2 font-medium">Codigo UL</th>
                        <th className="p-2 font-medium">Nome</th>
                        <th className="p-2 font-medium">Designacao Primario</th>
                        <th className="p-2 font-medium">Designacao Secundario</th>
                        <th className="p-2 font-medium">Encontrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultRows.map((row, index) => {
                        const canSelect = row.statusType === "ok" && row.code !== "-";
                        const isSelected = canSelect && selectedCodes.includes(row.code);
                        return (
                          <tr key={`${row.query}-${index}`} className="border-t align-top">
                            <td className="p-2">
                              <Checkbox
                                checked={isSelected}
                                disabled={!canSelect}
                                onCheckedChange={(checked) => {
                                  if (!canSelect) return;
                                  setSelectedCodes((prev) => {
                                    const next = new Set(prev);
                                    if (checked === true) {
                                      next.add(row.code);
                                    } else {
                                      next.delete(row.code);
                                    }
                                    return [...next];
                                  });
                                }}
                                aria-label={`Selecionar ${row.code}`}
                              />
                            </td>
                            <td className="p-2 font-mono">{row.query}</td>
                            <td className="p-2">
                              <Badge variant={row.statusType === "ok" ? "default" : "outline"}>{row.statusText}</Badge>
                            </td>
                            <td className="p-2 font-mono">{row.code}</td>
                            <td className="p-2">{row.nome}</td>
                            <td className="p-2 font-mono">{row.primario}</td>
                            <td className="p-2 font-mono">{row.secundario}</td>
                            <td className="p-2">{row.matchedBy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Solicitacao de Validacao</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Unidade Loterico e Designacao sao preenchidos automaticamente. Escolha se o circuito e primario ou secundario.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyText()} disabled={!emailRows.length}>
                {copiedId === "text" ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedId === "text" ? "Copiado!" : "Copiar texto"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyTable()} disabled={!emailRows.length}>
                {copiedId === "table" ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <TableIcon className="w-4 h-4 mr-1" />}
                {copiedId === "table" ? "Copiado!" : "Copiar tabela"}
              </Button>
              <Button size="sm" onClick={() => void sendEmail()} disabled={!emailRows.length}>
                {copiedId === "email" ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Mail className="w-4 h-4 mr-1" />}
                {copiedId === "email" ? "Tabela pronta" : "Enviar por email"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedRows.length ? (
              <p className="text-sm text-muted-foreground">
                Consulte e selecione ao menos uma loterica para montar a solicitacao de validacao.
              </p>
            ) : (
              <>
                <div className="rounded-lg border overflow-auto">
                  <table className="w-full text-xs min-w-[1120px]">
                    <thead className="bg-muted/60">
                      <tr className="text-left">
                        <th className="p-2 font-medium">Codigo UL</th>
                        <th className="p-2 font-medium">Unidade Loterico</th>
                        <th className="p-2 font-medium">Primario/Secundario</th>
                        <th className="p-2 font-medium">Designacao</th>
                        <th className="p-2 font-medium">Acao realizada / Reparo</th>
                        <th className="p-2 font-medium">Chamado SIGSC (REQ)</th>
                        <th className="p-2 font-medium">Chamado Operadora (interno)</th>
                        <th className="p-2 font-medium">Tipo de falha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row) => (
                        <tr key={row.code} className="border-t align-top">
                          <td className="p-2 font-mono">{row.code}</td>
                          <td className="p-2">{row.unidadeLoterico}</td>
                          <td className="p-2">
                            <Select
                              value={row.circuito}
                              onValueChange={(value) => updateRowState(row.code, { circuito: value as ValidationCircuitTarget })}
                            >
                              <SelectTrigger className="min-w-[160px]">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primario">Primario</SelectItem>
                                <SelectItem value="secundario">Secundario</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 font-mono">{row.designacao}</td>
                          <td className="p-2">
                            <Input
                              value={row.acaoRealizada}
                              onChange={(event) => updateRowState(row.code, { acaoRealizada: event.target.value })}
                              placeholder="Ex: Migracao na rede de transporte"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.chamado}
                              onChange={(event) => updateRowState(row.code, { chamado: event.target.value })}
                              placeholder="Ex: REQ000143434307"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.chamadoOperadora}
                              onChange={(event) => updateRowState(row.code, { chamadoOperadora: event.target.value })}
                              placeholder="Ex: WO0000079738107"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.tipoFalha}
                              onChange={(event) => updateRowState(row.code, { tipoFalha: event.target.value })}
                              placeholder="Ex: Indisponibilidade (Total)"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  O botao de email abre o cliente padrao configurado no Windows e ja copia a tabela formatada para colar no corpo da
                  mensagem.
                </p>

                <div className="rounded-xl border bg-card overflow-auto">
                  <div className="p-4 border-b bg-muted/30">
                    <p>Bom dia, tudo bem?</p>
                    <p className="mt-3">Poderiam validar o circuito abaixo, por gentileza:</p>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[1040px] text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="p-3 font-medium border-b">Unidade Loterico</th>
                          <th className="p-3 font-medium border-b">Designacao</th>
                          <th className="p-3 font-medium border-b">Primario/Secundario</th>
                          <th className="p-3 font-medium border-b">Acao realizada / Reparo</th>
                          <th className="p-3 font-medium border-b">Chamado SIGSC (REQ)</th>
                          <th className="p-3 font-medium border-b">Chamado Operadora (interno)</th>
                          <th className="p-3 font-medium border-b">Tipo de falha</th>
                          <th className="p-3 font-medium border-b bg-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailRows.map((row) => (
                          <tr key={`${row.unidadeLoterico}-${row.designacao}`} className="border-b align-top">
                            <td className="p-3">{row.unidadeLoterico}</td>
                            <td className="p-3 font-mono">{row.designacao}</td>
                            <td className="p-3">{row.circuito}</td>
                            <td className="p-3">{row.acaoRealizada || "-"}</td>
                            <td className="p-3 font-mono">{row.chamado || "-"}</td>
                            <td className="p-3 font-mono">{row.chamadoOperadora || "-"}</td>
                            <td className="p-3">{row.tipoFalha || "-"}</td>
                            <td className="p-3 bg-muted/30">{row.status || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Validacao;
