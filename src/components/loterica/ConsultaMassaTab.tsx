import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, PencilLine, Search, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { useLotericaUpdatesAccess } from "@/hooks/useLotericaUpdatesAccess";
import {
  buildMassUpdateRowChange,
  createMassUpdateTemplateWorkbook,
  MASS_UPDATE_ACCEPTED_EXTENSIONS,
  MASS_UPDATE_SUPPORTED_FIELDS,
  MASS_UPDATE_TEMPLATE_FILENAME,
  parseMassUpdateFile,
  type MassUpdateExistingRow,
} from "@/lib/lotericaMassUpdate";
import { writeFile, jsonToWorkbook } from "@/lib/excelCompat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildLookupDisplay,
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  normalizeText,
  parseTerms,
  resolveMatches,
  type LotericaLookupRow,
  type TermMatch,
} from "@/components/loterica/lotericaLookup";

interface ConsultaMassaRow {
  query: string;
  statusType: "ok" | "missing_ip" | "not_found";
  statusText: string;
  codUl: string;
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  contato: string;
  statusUl: string;
  cctoOi: string;
  designacaoNova: string;
  ipNat: string;
  ipWan: string;
  loopbackWan: string;
  loopbackLan: string;
  cctoOemp: string;
  operadora: string;
  tecnologia: string;
  ipPrimario: string;
  ipSecundario: string;
  matchedBy: string;
  source: TermMatch;
}

interface FieldSpec {
  label: string;
  aliases: string[];
  mono?: boolean;
  fallback?: (row: LotericaLookupRow) => unknown;
}

interface FieldSection {
  title: string;
  description: string;
  fields: FieldSpec[];
}

interface ModalField {
  label: string;
  value: string;
  mono?: boolean;
}

interface RawEntry {
  key: string;
  value: string;
}

interface RawLookup {
  exact: Map<string, string>;
  loose: Map<string, string>;
  entries: RawEntry[];
}

const asText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleString("pt-BR");

  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json === "{}" ? "" : json;
    } catch {
      return String(value).trim();
    }
  }

  return String(value).trim();
};

const normalizeHeaderLoose = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const buildRawLookup = (rawData: Record<string, unknown> | null | undefined): RawLookup => {
  const raw = rawData && typeof rawData === "object" ? rawData : {};
  const exact = new Map<string, string>();
  const loose = new Map<string, string>();
  const entries: RawEntry[] = [];

  for (const [key, rawValue] of Object.entries(raw)) {
    const value = asText(rawValue);
    const displayValue = value || "-";
    entries.push({ key, value: displayValue });

    if (!value) continue;

    const exactKey = key.trim().toUpperCase();
    const looseKey = normalizeHeaderLoose(key);

    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, value);
    if (looseKey && !loose.has(looseKey)) loose.set(looseKey, value);
  }

  return { exact, loose, entries };
};

const getByAliases = (lookup: RawLookup, aliases: string[]) => {
  for (const alias of aliases) {
    const exactValue = lookup.exact.get(alias.trim().toUpperCase());
    if (exactValue) return exactValue;

    const looseValue = lookup.loose.get(normalizeHeaderLoose(alias));
    if (looseValue) return looseValue;
  }

  return "";
};

const getFieldValue = (row: LotericaLookupRow, lookup: RawLookup, field: FieldSpec) => {
  const rawValue = getByAliases(lookup, field.aliases);
  if (rawValue) return rawValue;

  const fallback = field.fallback ? asText(field.fallback(row)) : "";
  return fallback || "-";
};

const FIELD_SECTIONS: FieldSection[] = [
  {
    title: "Dados da Loterica",
    description: "Informacoes gerais de identificacao e operacao da UL.",
    fields: [
      {
        label: "Codigo UL",
        mono: true,
        aliases: ["COD. UL", "CODIGO DA UL", "CODIGO UL", "CÓDIGO UL", "CÓDIGO DA LOTÉRICA_", "cod_ul"],
        fallback: (row) => row.cod_ul,
      },
      {
        label: "Nome da Loterica",
        aliases: ["NOME DA LOTERICA", "NOME UL", "nome_loterica"],
        fallback: (row) => row.nome_loterica,
      },
      {
        label: "Endereco",
        aliases: ["ENDEREÇO", "ENDERECO", "ENDEREÃ‡O", "endereco"],
        fallback: (row) => row.endereco,
      },
      {
        label: "Municipio / Cidade",
        aliases: ["MUNICIPIO", "MUNICÍPIO", "CIDADE", "cidade"],
        fallback: (row) => row.cidade,
      },
      {
        label: "UF",
        mono: true,
        aliases: ["UF", "uf"],
        fallback: (row) => row.uf,
      },
      {
        label: "Contato",
        aliases: ["CONTATO", "contato"],
        fallback: (row) => row.contato,
      },
      {
        label: "Status UL",
        aliases: ["STATUS UL", "status"],
        fallback: (row) => row.status,
      },
      {
        label: "Migracao",
        aliases: ["MIGRAÇÃO", "MIGRACAO", "MIGRAÃ‡ÃƒO"],
      },
      {
        label: "Homologado",
        aliases: ["HOMOLOGADO"],
      },
      {
        label: "Tipo UL",
        aliases: ["TIPO UL", "TIPO LOTERICA", "TIPO LOTÉRICA"],
      },
      {
        label: "TFL",
        mono: true,
        aliases: ["TFL", "TFLs", "TFLS"],
      },
      {
        label: "Owner",
        aliases: ["OWNER"],
      },
      {
        label: "Resp. Backup",
        aliases: ["RESP BACKUP", "RESPONSAVEL BACKUP", "RESPONSÁVEL BACKUP"],
      },
    ],
  },
  {
    title: "Link Principal",
    description: "Campos do link principal e dados de roteamento principal.",
    fields: [
      {
        label: "CCTO OI",
        mono: true,
        aliases: ["CCTO OI", "ccto_oi"],
        fallback: (row) => row.ccto_oi,
      },
      {
        label: "Designacao Nova",
        mono: true,
        aliases: ["DESIGINACAO NOVA", "DESIGINAÇÃO NOVA", "DESIGNAÇÃO NOVA", "designacao_nova"],
        fallback: (row) => row.designacao_nova,
      },
      {
        label: "BASE UN",
        mono: true,
        aliases: ["BASE UN"],
      },
      {
        label: "Ponto Logico / Designacao",
        mono: true,
        aliases: ["Ponto Lógico / Designação", "Ponto Lógico / \nDesignação", "PONTO LOGICO / DESIGNACAO"],
      },
      {
        label: "IP NAT",
        mono: true,
        aliases: ["IP NAT", "ip_nat"],
        fallback: (row) => row.ip_nat,
      },
      {
        label: "IP WAN",
        mono: true,
        aliases: ["IP WAN", "ip_wan"],
        fallback: (row) => row.ip_wan,
      },
      {
        label: "Loopback Principal",
        mono: true,
        aliases: ["LOOPBACK PRINCIPAL", "LOOPBACK PRIMARIO", "LOOTPBACK PRIMARIO", "loopback_wan"],
        fallback: (row) => row.loopback_wan,
      },
      {
        label: "IP / Loopback Switch",
        mono: true,
        aliases: ["IP SWITCH", "LOOPBACK SWITCH"],
      },
      {
        label: "Rede LAN",
        mono: true,
        aliases: ["REDE LAN", "REDE_LAN"],
      },
      {
        label: "Perimetro",
        aliases: ["PERIMETRO", "PERÍMETRO", "PERÃMETRO"],
      },
    ],
  },
  {
    title: "Link Secundario e Backup",
    description: "Campos do circuito OEMP e tecnologias de contingencia.",
    fields: [
      {
        label: "CCTO OEMP",
        mono: true,
        aliases: ["CCTO OEMP", "ccto_oemp"],
        fallback: (row) => row.ccto_oemp,
      },
      {
        label: "Empresa OEMP",
        aliases: ["EMPRESA OEMP"],
      },
      {
        label: "Circuito OEMP",
        mono: true,
        aliases: ["CIRCUITO OEMP"],
      },
      {
        label: "Loopback Secundario",
        mono: true,
        aliases: ["LOOPBACK SECUNDARIO", "LOOPBACK SECUNDÃRIO", "LOOPBACK SECUNDÃƒÂRIO", "loopback_lan"],
        fallback: (row) => row.loopback_lan,
      },
      {
        label: "Operadora 4G",
        aliases: ["OPERADORA 4G", "OPERADORA", "operadora"],
        fallback: (row) => row.operadora,
      },
      {
        label: "SIM Card 4G",
        mono: true,
        aliases: ["SIM CARD 4G"],
      },
      {
        label: "VSAT",
        aliases: ["VSAT"],
      },
      {
        label: "Meraki / PA Avancado",
        mono: true,
        aliases: ["PA AVANÃ‡ADO (MERAKI)", "PA AVANCADO (MERAKI)", "MERAKI", "CIRCUITO MERAKI", "CIRCUITOS MERAKI"],
      },
      {
        label: "Regiao",
        aliases: ["REGIÃƒO", "REGIAO", "REGIÃƒÆ’O"],
      },
      {
        label: "CEP",
        mono: true,
        aliases: ["CEP"],
      },
    ],
  },
  {
    title: "Tecnologia e Equipamento",
    description: "Informacoes tecnicas adicionais da infraestrutura da UL.",
    fields: [
      {
        label: "Tecnologia",
        aliases: ["TECNOLOGIA"],
      },
      {
        label: "Modelo Roteador",
        aliases: ["MODELO ROTEADOR"],
      },
      {
        label: "Atualizado em",
        aliases: ["updated_at", "ATUALIZADO EM"],
        fallback: (row) => row.updated_at,
      },
    ],
  },
];

const FieldTile = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-xl border bg-muted/25 p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("mt-1 text-sm break-words", mono ? "font-mono text-xs" : "")}>{value || "-"}</p>
  </div>
);

const MASS_UPDATE_FETCH_BATCH_SIZE = 150;
const MASS_UPDATE_LOOKUP_SELECT =
  "cod_ul,ccto_oi,ccto_oemp,designacao_nova,operadora,loopback_wan,loopback_lan,endereco,contato,status,cidade,uf,raw_data";

const summarizeCodes = (codes: string[], maxItems = 8) => {
  if (codes.length <= maxItems) return codes.join(", ");
  return `${codes.slice(0, maxItems).join(", ")} e mais ${codes.length - maxItems}`;
};

const ConsultaMassaTab = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { setLotericaTab, setOnExport, setOnImportClick } = useSidebarActions();
  const {
    enabled: lotericaUpdatesEnabled,
    loading: lotericaUpdatesLoading,
    error: lotericaUpdatesError,
  } = useLotericaUpdatesAccess();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<TermMatch[]>([]);
  const [selectedRow, setSelectedRow] = useState<LotericaLookupRow | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [uploadingUpdates, setUploadingUpdates] = useState(false);
  const [updateSummary, setUpdateSummary] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const nonAdminUpdatesBlocked = !isAdmin && !lotericaUpdatesEnabled;
  const uploadDisabled = uploadingUpdates || (!isAdmin && (lotericaUpdatesLoading || nonAdminUpdatesBlocked));

  const runLookupForTerms = useCallback(async (terms: string[]) => {
    if (!terms.length) {
      setError("Informe ao menos um codigo UL ou circuito.");
      setMatches([]);
      return false;
    }

    setLoading(true);
    setError("");

    try {
      const lookupRows = await fetchLookupRows(terms);
      const resolved = resolveMatches(terms, lookupRows);
      setMatches(resolved);
      return true;
    } catch (lookupError) {
      setMatches([]);
      setError(String((lookupError as Error)?.message || lookupError || "Falha na consulta em massa."));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const runLookup = useCallback(async () => {
    const terms = dedupeTerms(parseTerms(input));
    await runLookupForTerms(terms);
  }, [input, runLookupForTerms]);

  const downloadTemplate = useCallback(async () => {
    try {
      setUpdateError(null);
      const workbook = createMassUpdateTemplateWorkbook();
      await writeFile(workbook, MASS_UPDATE_TEMPLATE_FILENAME);
    } catch (templateError) {
      setUpdateError(
        `Falha ao gerar o modelo: ${String((templateError as Error)?.message || templateError || "erro desconhecido")}`,
      );
    }
  }, []);

  useLayoutEffect(() => {
    setOnImportClick(() => () => uploadInputRef.current?.click());
    setOnExport(() => () => {
      void downloadTemplate();
    });

    return () => {
      setOnImportClick(undefined);
      setOnExport(undefined);
    };
  }, [downloadTemplate, setOnExport, setOnImportClick]);

  const rows = useMemo<ConsultaMassaRow[]>(() => {
    return matches.map((match) => {
      const primary = buildLookupDisplay(match, "primario");
      const secondary = buildLookupDisplay(match, "secundario");

      const empty: ConsultaMassaRow = {
        query: match.query,
        statusType: "not_found",
        statusText: "Nao encontrado",
        codUl: "-",
        nome: "-",
        endereco: "-",
        cidade: "-",
        uf: "-",
        contato: "-",
        statusUl: "-",
        cctoOi: "-",
        designacaoNova: "-",
        ipNat: "-",
        ipWan: "-",
        loopbackWan: "-",
        loopbackLan: "-",
        cctoOemp: "-",
        operadora: "-",
        tecnologia: "-",
        ipPrimario: "",
        ipSecundario: "",
        matchedBy: "-",
        source: match,
      };

      if (!match.row) return empty;

      const row = match.row;
      const rawLookup = buildRawLookup(row.raw_data);
      const ipPrimario = getLookupIp(row, "primario");
      const ipSecundario = getLookupIp(row, "secundario");
      const hasAnyIp = Boolean(ipPrimario || ipSecundario);

      return {
        query: match.query,
        statusType: hasAnyIp ? "ok" : "missing_ip",
        statusText: hasAnyIp ? "Encontrado" : "Sem IP",
        codUl: normalizeText(row.cod_ul) || "-",
        nome: normalizeText(row.nome_loterica) || "-",
        endereco: normalizeText(row.endereco) || "-",
        cidade: normalizeText(row.cidade) || "-",
        uf: normalizeText(row.uf) || "-",
        contato: normalizeText(row.contato) || "-",
        statusUl: normalizeText(row.status) || "-",
        cctoOi: normalizeText(row.ccto_oi) || "-",
        designacaoNova: normalizeText(row.designacao_nova) || "-",
        ipNat: normalizeText(row.ip_nat) || "-",
        ipWan: normalizeText(row.ip_wan) || "-",
        loopbackWan: normalizeText(row.loopback_wan) || "-",
        loopbackLan: normalizeText(row.loopback_lan) || "-",
        cctoOemp: normalizeText(row.ccto_oemp) || "-",
        operadora: normalizeText(row.operadora) || "-",
        tecnologia: getByAliases(rawLookup, ["TECNOLOGIA"]) || "-",
        ipPrimario,
        ipSecundario,
        matchedBy: primary.matchedBy !== "-" ? primary.matchedBy : secondary.matchedBy,
        source: match,
      };
    });
  }, [matches]);

  const summary = useMemo(() => {
    const ok = rows.filter((row) => row.statusType === "ok").length;
    const missingIp = rows.filter((row) => row.statusType === "missing_ip").length;
    const notFound = rows.filter((row) => row.statusType === "not_found").length;

    return {
      total: rows.length,
      ok,
      missingIp,
      notFound,
    };
  }, [rows]);

  const editableCodes = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter((row) => Boolean(row.source.row) && row.codUl !== "-")
          .map((row) => row.codUl),
      ),
    );
  }, [rows]);

  useEffect(() => {
    setSelectedCodes((prev) => prev.filter((code) => editableCodes.includes(code)));
  }, [editableCodes]);

  const allSelected = editableCodes.length > 0 && selectedCodes.length === editableCodes.length;

  const selectedRawLookup = useMemo(() => {
    if (!selectedRow) return null;
    return buildRawLookup(selectedRow.raw_data);
  }, [selectedRow]);

  const selectedTecnologia = useMemo(() => {
    if (!selectedRawLookup) return "-";
    return getByAliases(selectedRawLookup, ["TECNOLOGIA"]) || "-";
  }, [selectedRawLookup]);

  const modalSections = useMemo(() => {
    if (!selectedRow || !selectedRawLookup) return [] as Array<{ title: string; description: string; items: ModalField[] }>;

    return FIELD_SECTIONS.map((section) => ({
      title: section.title,
      description: section.description,
      items: section.fields.map((field) => ({
        label: field.label,
        mono: field.mono,
        value: getFieldValue(selectedRow, selectedRawLookup, field),
      })),
    }));
  }, [selectedRow, selectedRawLookup]);

  const rawEntries = useMemo(() => selectedRawLookup?.entries || [], [selectedRawLookup]);

  const goToEditByCodes = (codes: string[]) => {
    const normalized = Array.from(new Set(codes.map((code) => normalizeText(code)).filter(Boolean)));

    if (!normalized.length) {
      alert("Nenhuma loterica encontrada para editar.");
      return;
    }

    setLotericaTab("consulta");
    navigate(`/loterica/${encodeURIComponent(normalized.join(","))}`);
  };

  const toggleCodeSelection = (code: string, checked: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(code);
      } else {
        next.delete(code);
      }
      return Array.from(next);
    });
  };

  const handleMassUpdateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingUpdates(true);
    setUpdateSummary(null);
    setUpdateError(null);

    try {
      if (!user?.id) throw new Error("Sessao invalida. Faca login novamente.");
      if (!isAdmin && lotericaUpdatesLoading) throw new Error("Aguarde: validando permissao de atualizacao.");
      if (!isAdmin && !lotericaUpdatesEnabled) throw new Error("Atualizacao de dados bloqueada pelo ADM para usuarios.");

      const parsed = await parseMassUpdateFile(file);
      if (parsed.missingCodeHeader) throw new Error("A planilha precisa ter a coluna COD_UL (ou equivalente).");
      if (!parsed.entries.length) {
        throw new Error("Nenhuma linha valida encontrada. Informe COD_UL e ao menos um campo para atualizar.");
      }

      const requestedCodes = parsed.entries.map((entry) => entry.codUl);
      const existingByCode = new Map<string, MassUpdateExistingRow>();

      for (let index = 0; index < requestedCodes.length; index += MASS_UPDATE_FETCH_BATCH_SIZE) {
        const batch = requestedCodes.slice(index, index + MASS_UPDATE_FETCH_BATCH_SIZE);
        const { data, error: fetchError } = await supabase
          .from("lotericas")
          .select(MASS_UPDATE_LOOKUP_SELECT)
          .in("cod_ul", batch);

        if (fetchError) throw new Error(fetchError.message || "Falha ao carregar as ULs informadas na planilha.");

        (data || []).forEach((row) => {
          const code = normalizeText(row.cod_ul).toUpperCase();
          if (code) existingByCode.set(code, row as MassUpdateExistingRow);
        });
      }

      const preparedChanges: Array<{ code: string; changes: Record<string, unknown>; beforeChanges: Record<string, unknown> }> = [];
      const notFoundCodes: string[] = [];
      const unchangedCodes: string[] = [];

      for (const entry of parsed.entries) {
        const row = existingByCode.get(entry.codUl.toUpperCase());
        if (!row) {
          notFoundCodes.push(entry.codUl);
          continue;
        }

        const { changes, beforeChanges } = buildMassUpdateRowChange(row, entry);
        if (!Object.keys(changes).length) {
          unchangedCodes.push(entry.codUl);
          continue;
        }

        preparedChanges.push({ code: row.cod_ul, changes, beforeChanges });
      }

      const successCodes: string[] = [];
      const failedMessages: string[] = [];

      if (isAdmin) {
        for (const item of preparedChanges) {
          const updatedAt = new Date().toISOString();
          const { error: saveError } = await supabase
            .from("lotericas")
            .update({ ...item.changes, updated_by: user.id, updated_at: updatedAt })
            .eq("cod_ul", item.code);

          if (saveError) {
            failedMessages.push(`${item.code}: ${saveError.message}`);
            continue;
          }

          successCodes.push(item.code);
        }
      } else {
        for (const item of preparedChanges) {
          const { error: requestError } = await (supabase as any).from("loterica_change_requests").insert({
            cod_ul: item.code,
            proposed_by: user.id,
            before_data: item.beforeChanges,
            after_data: item.changes,
            status: "pending",
          } as any);

          if (requestError) {
            const message = String((requestError as any)?.message || "");
            if (message.includes("loterica_change_requests") && message.includes("Could not find the table")) {
              throw new Error(
                "Banco desatualizado: falta a tabela loterica_change_requests.\n" +
                  "Aplique a migracao Supabase '20260213173000_approval_workflow_and_loopback_fix.sql' e tente novamente.",
              );
            }

            if (message.toLowerCase().includes("row-level security")) {
              throw new Error("Atualizacao de dados bloqueada pelo ADM para usuarios.");
            }

            failedMessages.push(`${item.code}: ${message || "Erro ao enviar para aprovacao."}`);
            continue;
          }

          successCodes.push(item.code);
        }
      }

      const summaryLines = [
        `Arquivo: ${file.name}`,
        `Aba utilizada: ${parsed.sheetName}`,
        `ULs lidas na planilha: ${parsed.entries.length}`,
        `${isAdmin ? "Atualizadas" : "Enviadas para aprovacao"}: ${successCodes.length}`,
        `Sem alteracao: ${unchangedCodes.length}`,
        `Nao encontradas: ${notFoundCodes.length}`,
        parsed.ignoredRows.length ? `Linhas ignoradas: ${parsed.ignoredRows.join(", ")}` : "",
        parsed.duplicateCodes.length ? `ULs repetidas mescladas: ${summarizeCodes(parsed.duplicateCodes)}` : "",
        notFoundCodes.length ? `Codigos nao encontrados: ${summarizeCodes(notFoundCodes)}` : "",
        failedMessages.length ? `Erros: ${failedMessages.slice(0, 5).join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      setUpdateSummary(summaryLines);

      if (isAdmin && successCodes.length) {
        setInput(successCodes.join("\n"));
        await runLookupForTerms(successCodes);
      }
    } catch (uploadError) {
      setUpdateError(String((uploadError as Error)?.message || uploadError || "Falha na atualizacao em massa."));
    } finally {
      setUploadingUpdates(false);
      event.target.value = "";
    }
  };

  const consultaCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="w-5 h-5" /> Consulta em Massa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="consulta-massa-input">Codigos UL ou circuitos (um por linha)</Label>
          <Textarea
            id="consulta-massa-input"
            placeholder={"21-000666-8\n21-000666-3\n21-000666-5\n21-000666-1"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runLookup()} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => goToEditByCodes(selectedCodes)}
            disabled={selectedCodes.length === 0}
          >
            <PencilLine className="w-4 h-4 mr-1" />
            Editar selecionadas ({selectedCodes.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => goToEditByCodes(editableCodes)}
            disabled={editableCodes.length === 0}
          >
            Editar encontradas ({editableCodes.length})
          </Button>
          {rows.length > 0 && (
            <Button
              variant="outline"
              onClick={() => void exportConsultaMassaToExcel(rows)}
            >
              <Download className="w-4 h-4 mr-1" />
              Baixar Excel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setInput("");
              setMatches([]);
              setError("");
              setSelectedCodes([]);
            }}
          >
            Limpar
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Total: {summary.total}</Badge>
              <Badge variant="default">Encontrados: {summary.ok}</Badge>
              <Badge variant="secondary">Sem IP: {summary.missingIp}</Badge>
              <Badge variant="outline">Nao encontrados: {summary.notFound}</Badge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Selecione 1 ou mais linhas para editar em lote, ou clique na linha para abrir o detalhe completo.
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={allSelected}
                  disabled={editableCodes.length === 0}
                  onCheckedChange={(checked) => {
                    const shouldSelectAll = checked === true;
                    setSelectedCodes(shouldSelectAll ? editableCodes : []);
                  }}
                  aria-label="Selecionar todas as lotericas encontradas"
                />
                <span className="text-muted-foreground">Selecionar todas</span>
              </div>
            </div>

            <div className="rounded-lg border overflow-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium whitespace-nowrap">Selecionar</th>
                    <th className="p-2 font-medium whitespace-nowrap">Consulta</th>
                    <th className="p-2 font-medium whitespace-nowrap">Status</th>
                    <th className="p-2 font-medium whitespace-nowrap">Codigo UL</th>
                    <th className="p-2 font-medium whitespace-nowrap">Nome</th>
                    <th className="p-2 font-medium whitespace-nowrap">Endereco</th>
                    <th className="p-2 font-medium whitespace-nowrap">Cidade</th>
                    <th className="p-2 font-medium whitespace-nowrap">UF</th>
                    <th className="p-2 font-medium whitespace-nowrap">Tecnologia</th>
                    <th className="p-2 font-medium whitespace-nowrap">Contato</th>
                    <th className="p-2 font-medium whitespace-nowrap">Status UL</th>
                    <th className="p-2 font-medium whitespace-nowrap">CCTO OI</th>
                    <th className="p-2 font-medium whitespace-nowrap">Designacao Nova</th>
                    <th className="p-2 font-medium whitespace-nowrap">IP NAT</th>
                    <th className="p-2 font-medium whitespace-nowrap">IP WAN</th>
                    <th className="p-2 font-medium whitespace-nowrap">Loopback Principal</th>
                    <th className="p-2 font-medium whitespace-nowrap">IP Primario</th>
                    <th className="p-2 font-medium whitespace-nowrap">CCTO OEMP</th>
                    <th className="p-2 font-medium whitespace-nowrap">Loopback Secundario</th>
                    <th className="p-2 font-medium whitespace-nowrap">IP Secundario</th>
                    <th className="p-2 font-medium whitespace-nowrap">Operadora</th>
                    <th className="p-2 font-medium whitespace-nowrap">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const canOpen = Boolean(row.source.row);
                    const canSelect = canOpen && row.codUl !== "-";
                    const isSelected = selectedCodes.includes(row.codUl);

                    return (
                      <tr
                        key={`${row.query}-${idx}`}
                        className={cn("border-t align-top", canOpen ? "cursor-pointer hover:bg-muted/40" : "")}
                        onClick={() => {
                          if (canOpen && row.source.row) setSelectedRow(row.source.row);
                        }}
                      >
                        <td className="p-2 whitespace-nowrap">
                          <Checkbox
                            checked={isSelected}
                            disabled={!canSelect}
                            onCheckedChange={(checked) => {
                              if (!canSelect) return;
                              toggleCodeSelection(row.codUl, checked === true);
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            aria-label={`Selecionar ${row.codUl}`}
                          />
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.query}</td>
                        <td className="p-2 whitespace-nowrap">
                          <Badge
                            variant={row.statusType === "ok" ? "default" : row.statusType === "missing_ip" ? "secondary" : "outline"}
                          >
                            {row.statusText}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.codUl}</td>
                        <td className="p-2 min-w-[220px] whitespace-normal break-words">{row.nome}</td>
                        <td className="p-2 min-w-[280px] whitespace-normal break-words">{row.endereco}</td>
                        <td className="p-2 min-w-[160px] whitespace-normal break-words">{row.cidade}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.uf}</td>
                        <td className="p-2 whitespace-normal break-words">{row.tecnologia}</td>
                        <td className="p-2 min-w-[220px] whitespace-normal break-words">{row.contato}</td>
                        <td className="p-2 whitespace-normal break-words">{row.statusUl}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.cctoOi}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.designacaoNova}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.ipNat}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.ipWan}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.loopbackWan}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.ipPrimario || "-"}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.cctoOemp}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.loopbackLan}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{row.ipSecundario || "-"}</td>
                        <td className="p-2 whitespace-normal break-words">{row.operadora}</td>
                        <td className="p-2 whitespace-nowrap">{row.matchedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
  const updateCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5" /> Atualizacao em Massa por Planilha
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={uploadInputRef}
          type="file"
          accept={MASS_UPDATE_ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(event) => void handleMassUpdateUpload(event)}
          disabled={uploadingUpdates}
        />

        <p className="text-sm text-muted-foreground">
          Suba uma planilha com <span className="font-mono">COD_UL</span> e apenas as colunas que deseja atualizar.
          Campos vazios sao ignorados, e linhas repetidas da mesma UL sao mescladas.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void downloadTemplate()}>
            <Download className="w-4 h-4 mr-1" />
            Baixar modelo .xlsx
          </Button>
          <Button onClick={() => uploadInputRef.current?.click()} disabled={uploadDisabled}>
            <Upload className="w-4 h-4 mr-1" />
            {uploadingUpdates
              ? "Processando planilha..."
              : isAdmin
                ? "Subir atualizacao"
                : nonAdminUpdatesBlocked
                  ? "Bloqueado pelo ADM"
                  : "Enviar planilha p/ aprovacao"}
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Campos aceitos</p>
          <p className="mt-1 whitespace-pre-wrap">{MASS_UPDATE_SUPPORTED_FIELDS.join(", ")}</p>
        </div>

        {!isAdmin && (
          <div className="text-xs">
            {lotericaUpdatesLoading ? (
              <p className="text-muted-foreground">Verificando permissao de atualizacao...</p>
            ) : nonAdminUpdatesBlocked ? (
              <p className="text-destructive">Atualizacao de dados bloqueada pelo ADM para usuarios.</p>
            ) : (
              <p className="text-muted-foreground">
                A planilha gera uma solicitacao individual de aprovacao para cada UL com alteracao.
              </p>
            )}
          </div>
        )}

        {!!lotericaUpdatesError && <p className="text-xs text-destructive whitespace-pre-line">{lotericaUpdatesError}</p>}
        {!!updateError && <p className="text-sm text-destructive whitespace-pre-line">{updateError}</p>}

        {!!updateSummary && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">Resumo da ultima planilha</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line mt-2">{updateSummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
  const detailsDialog = (
    <Dialog
      open={!!selectedRow}
      onOpenChange={(open) => {
        if (!open) setSelectedRow(null);
      }}
    >
      <DialogContent className="max-w-[92vw] p-0 overflow-hidden">
        {selectedRow && (
          <>
            <div className="bg-gradient-to-r from-[#0B5EA8] to-[#0673B7] text-white px-6 py-5 border-b">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/80">SMARTIT - Consulta UL</p>
                  <h3 className="text-xl font-semibold mt-1">{normalizeText(selectedRow.nome_loterica) || "Loterica"}</h3>
                  <p className="text-sm font-mono mt-1">UL: {normalizeText(selectedRow.cod_ul) || "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-white/70 text-white bg-white/10 font-mono">
                    CCTO OI: {normalizeText(selectedRow.ccto_oi) || "-"}
                  </Badge>
                  <Badge variant="outline" className="border-white/70 text-white bg-white/10 font-mono">
                    CCTO OEMP: {normalizeText(selectedRow.ccto_oemp) || "-"}
                  </Badge>
                  <Badge variant="outline" className="border-white/70 text-white bg-white/10">
                    Status: {normalizeText(selectedRow.status) || "-"}
                  </Badge>
                  <Badge variant="outline" className="border-white/70 text-white bg-white/10">
                    Tecnologia: {selectedTecnologia}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto bg-background">
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle className="text-lg">Visao Completa da Planilha</DialogTitle>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const code = normalizeText(selectedRow.cod_ul);
                      goToEditByCodes(code ? [code] : []);
                    }}
                  >
                    <PencilLine className="w-4 h-4 mr-1" />
                    Editar esta loterica
                  </Button>
                </div>
                <DialogDescription>
                  Informacoes consolidadas da UL conforme a base importada da planilha, incluindo campos adicionais.
                </DialogDescription>
              </DialogHeader>

              {modalSections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {section.items.map((field) => (
                      <FieldTile
                        key={`${section.title}-${field.label}`}
                        label={field.label}
                        value={field.value}
                        mono={field.mono}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Campos Brutos da Planilha</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lista completa dos campos recebidos no `raw_data` da importacao.
                  </p>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="max-h-[320px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left">
                          <th className="p-2 font-medium">Campo da Planilha</th>
                          <th className="p-2 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rawEntries.length === 0 ? (
                          <tr className="border-t">
                            <td colSpan={2} className="p-3 text-muted-foreground">
                              Sem dados brutos disponiveis para esta loterica.
                            </td>
                          </tr>
                        ) : (
                          rawEntries.map((entry) => (
                            <tr key={entry.key} className="border-t align-top">
                              <td className="p-2 font-mono text-[11px]">{entry.key}</td>
                              <td className="p-2 break-words">{entry.value}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {consultaCard}
      {updateCard}
      {detailsDialog}
    </div>
  );
};

export default ConsultaMassaTab;
