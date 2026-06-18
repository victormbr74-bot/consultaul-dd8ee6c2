import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/controle-reparo/hooks/use-auth";
import { fetchAllControle, fetchControleDatas, fetchControleVersoes } from "@/modules/controle-reparo/lib/db";
import {
  CONTROL_DATE_SESSION_KEY,
  CONTROL_VERSION_SESSION_KEY,
  formatDateBR,
  processingDate,
} from "@/modules/controle-reparo/lib/date";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import { STATUS_PLANILHA_OPCOES, isLinkBackup } from "@/modules/controle-reparo/lib/processing";
import { getFaixa, formatHoras, formatDataHora, computeHoras } from "@/modules/controle-reparo/lib/tempo";
import { exportControle } from "@/modules/controle-reparo/lib/controleExport";
import {
  ColumnFilterHeader,
  EMPTY_FILTER,
  type ColFilter,
} from "@/modules/controle-reparo/components/controle/ColumnFilterHeader";
import { HistoricoDialog } from "@/modules/controle-reparo/components/controle/HistoricoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  History,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns3,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RowT = ControleRow & { id: string };

const PAGE_SIZE = 100;
const STORAGE_KEY = "controle-table-state-v1";

type SortState = { col: string; dir: "asc" | "desc" };

interface ColumnDef {
  id: string;
  label: string;
  kind:
    | "text"
    | "edit"
    | "wideEdit"
    | "statusPlanilha"
    | "tempo"
    | "inicio"
    | "previsao"
    | "comentario";
  text: (r: RowT) => string;
  num?: (r: RowT) => number;
  accent?: boolean;
}

type ControleField = keyof ControleRow;
type EditableValue = string | number | null;

interface EditableFieldConfig {
  dbField: ControleField;
  required?: boolean;
  parse?: (raw: string) => EditableValue;
}

const COLUMNS: ColumnDef[] = [
  { id: "codigo_loterica", label: "Código", kind: "text", text: (r) => r.codigo_loterica ?? "" },
  { id: "loterica", label: "Lotérica", kind: "text", text: (r) => r.loterica ?? "" },
  { id: "tipo_link", label: "Tipo", kind: "text", text: (r) => r.tipo_link ?? "" },
  { id: "uf", label: "UF", kind: "text", text: (r) => r.uf ?? "" },
  { id: "designacao", label: "Designação", kind: "text", text: (r) => r.designacao ?? "" },
  { id: "ip_loopback", label: "IP Loopback", kind: "text", text: (r) => r.ip_loopback ?? "" },
  {
    id: "inicio",
    label: "Início",
    kind: "inicio",
    text: (r) => formatDataHora(r.data_hora_inicial),
    num: (r) => (r.data_hora_inicial ? new Date(r.data_hora_inicial).getTime() : 0),
  },
  {
    id: "tempo",
    label: "Tempo",
    kind: "tempo",
    text: (r) => getFaixa(r.data_hora_inicial, r.duracao_h).label,
    num: (r) => computeHoras(r.data_hora_inicial, r.duracao_h),
  },
  { id: "chamado", label: "Chamado", kind: "text", text: (r) => r.chamado ?? "" },
  {
    id: "previsao",
    label: "Previsão",
    kind: "previsao",
    text: (r) => formatDataHora(r.previsao_atendimento),
    num: (r) => (r.previsao_atendimento ? new Date(r.previsao_atendimento).getTime() : 0),
  },
  {
    id: "ultimo_comentario",
    label: "Último Comentário",
    kind: "comentario",
    text: (r) => r.ultimo_comentario ?? "",
  },
  { id: "ordem", label: "Ordem", kind: "edit", text: (r) => r.ordem ?? "", accent: true },
  {
    id: "novo_circuito",
    label: "Novo Circuito",
    kind: "edit",
    text: (r) => r.novo_circuito ?? "",
    accent: true,
  },
  { id: "grafana", label: "Grafana", kind: "text", text: (r) => r.grafana ?? "" },
  { id: "empresa", label: "Empresa", kind: "text", text: (r) => r.empresa ?? "" },
  {
    id: "designacao_parceiro",
    label: "Desig. Parceiro",
    kind: "text",
    text: (r) => r.designacao_parceiro ?? "",
  },
  {
    id: "responsavel_backup",
    label: "Responsável Backup",
    kind: "text",
    text: (r) => r.responsavel_backup ?? "",
  },
  { id: "situacao", label: "Situação", kind: "edit", text: (r) => r.situacao ?? "", accent: true },
  {
    id: "status_planilha",
    label: "Status Planilha",
    kind: "statusPlanilha",
    text: (r) => r.status_planilha ?? "",
    accent: true,
  },
  {
    id: "status_jira",
    label: "Status Jira",
    kind: "edit",
    text: (r) => r.status_jira ?? "",
    accent: true,
  },
  { id: "obs", label: "Obs", kind: "wideEdit", text: (r) => r.obs ?? "", accent: true },
  {
    id: "responsavel",
    label: "Responsável",
    kind: "edit",
    text: (r) => r.responsavel ?? "",
    accent: true,
  },
  { id: "fila_jira", label: "Fila Jira", kind: "text", text: (r) => r.fila_jira ?? "" },
  { id: "inc_snow", label: "INC Snow", kind: "text", text: (r) => r.inc_snow ?? "" },
  { id: "incidente_mam", label: "Incid. MAM", kind: "text", text: (r) => r.incidente_mam ?? "" },
  {
    id: "status_zabbix",
    label: "Status Zabbix",
    kind: "edit",
    text: (r) => r.status_zabbix ?? "",
    accent: true,
  },
];

const ORDEM_OPCOES = [
  "AG EXEC. OS NOVA",
  "AGUARDA MIGRAÇÃO",
  "AGUARDANDO ABERTURA DE O.S",
  "ALTCTEC",
  "ALTMEIO",
  "DEFINIÇÃO U.N",
  "LINK OK, FALTA CPE",
  "MIGRAÇÃO EM ANDAMENTO",
  "REPARO",
  "SOLICITAR U.N",
  "CONCLUÍDO",
] as const;

const SITUACAO_OPCOES = [
  "AG EXEC. OS NOVA",
  "AGUARDANDO ABERTURA DE O.S",
  "AGUARDANDO ABERTURA DE OS",
  "INSTALAÇÃO DO CPE",
  "LINK OK, FALTA CPE",
  "MIGRAÇAO COBRE PARA FIBRA",
  "MIGRAÇÃO COBRE PARA FIBRA",
  "MIGRAÇÃO DE COBRE PARA FIBRA",
  "MIGRAÇÃO EM ANDAMENTO",
  "REPARO",
  "CONCLUÍDO",
] as const;

const FIXED_SELECT_OPTIONS: Record<string, readonly string[]> = {
  ordem: ORDEM_OPCOES,
  situacao: SITUACAO_OPCOES,
  status_planilha: STATUS_PLANILHA_OPCOES,
};

function fixedSelectOptions(field: string, current: string): string[] | null {
  const base = FIXED_SELECT_OPTIONS[field];
  if (!base) return null;
  const opts = [...base];
  if (current && !opts.includes(current)) opts.unshift(current);
  return opts;
}

const TREATMENT_EDITABLE_IDS = new Set([
  "ordem",
  "novo_circuito",
  "situacao",
  "status_planilha",
  "status_jira",
  "obs",
  "responsavel",
  "status_zabbix",
]);

const ADMIN_EDITABLE_IDS = new Set([
  "codigo_loterica",
  "loterica",
  "tipo_link",
  "uf",
  "designacao",
  "ip_loopback",
  "inicio",
  "tempo",
  "chamado",
  "previsao",
  "ultimo_comentario",
  "ordem",
  "novo_circuito",
  "grafana",
  "empresa",
  "designacao_parceiro",
  "responsavel_backup",
  "situacao",
  "status_planilha",
  "status_jira",
  "obs",
  "responsavel",
  "fila_jira",
  "inc_snow",
  "incidente_mam",
  "status_zabbix",
]);

function parseDateTimeInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(iso.getTime())) {
    return iso.toISOString();
  }

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(`${yr}-${m[2]}-${m[1]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  if (!isNaN(iso.getTime())) return iso.toISOString();
  throw new Error("Informe uma data válida.");
}

function parseHoursInput(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/horas?/gi, "")
    .replace(/h/gi, "")
    .replace(/\s+/g, "");
  if (!s) return null;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, "")
      : s;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Informe um tempo válido em horas.");
  }
  return value;
}

const EDITABLE_FIELD_CONFIG: Record<string, EditableFieldConfig> = {
  codigo_loterica: { dbField: "codigo_loterica", required: true },
  loterica: { dbField: "loterica" },
  tipo_link: { dbField: "tipo_link" },
  uf: { dbField: "uf" },
  designacao: { dbField: "designacao" },
  ip_loopback: { dbField: "ip_loopback" },
  inicio: { dbField: "data_hora_inicial", parse: parseDateTimeInput },
  tempo: { dbField: "duracao_h", parse: parseHoursInput },
  chamado: { dbField: "chamado" },
  previsao: { dbField: "previsao_atendimento", parse: parseDateTimeInput },
  ultimo_comentario: { dbField: "ultimo_comentario" },
  ordem: { dbField: "ordem" },
  novo_circuito: { dbField: "novo_circuito" },
  grafana: { dbField: "grafana" },
  empresa: { dbField: "empresa" },
  designacao_parceiro: { dbField: "designacao_parceiro" },
  responsavel_backup: { dbField: "responsavel_backup" },
  situacao: { dbField: "situacao" },
  status_planilha: { dbField: "status_planilha" },
  status_jira: { dbField: "status_jira" },
  obs: { dbField: "obs" },
  responsavel: { dbField: "responsavel" },
  fila_jira: { dbField: "fila_jira" },
  inc_snow: { dbField: "inc_snow" },
  incidente_mam: { dbField: "incidente_mam" },
  status_zabbix: { dbField: "status_zabbix" },
};

function canEditField(field: string, canWrite: boolean, isAdmin: boolean): boolean {
  if (isAdmin) return ADMIN_EDITABLE_IDS.has(field);
  return canWrite && TREATMENT_EDITABLE_IDS.has(field);
}

function parseEditableValue(field: string, raw: string): EditableValue {
  const config = EDITABLE_FIELD_CONFIG[field];
  if (!config) throw new Error("Campo não editável.");
  if (config.parse) return config.parse(raw);
  const value = raw.trim();
  if (config.required && !value) throw new Error("Este campo não pode ficar vazio.");
  return value === "" ? null : value;
}

function sameEditableValue(field: string, oldValue: unknown, newValue: EditableValue): boolean {
  const dbField = EDITABLE_FIELD_CONFIG[field]?.dbField;
  if (dbField === "duracao_h") {
    if (oldValue == null && newValue == null) return true;
    return Number(oldValue) === Number(newValue);
  }
  if (dbField === "data_hora_inicial" || dbField === "previsao_atendimento") {
    if (oldValue == null && newValue == null) return true;
    if (oldValue == null || newValue == null) return false;
    return new Date(String(oldValue)).getTime() === new Date(String(newValue)).getTime();
  }
  return (oldValue ?? "") === (newValue ?? "");
}

function editDisplayValue(row: RowT, col: ColumnDef): string {
  if (col.id === "inicio") return formatDataHora(row.data_hora_inicial);
  if (col.id === "previsao") return formatDataHora(row.previsao_atendimento);
  if (col.id === "tempo") {
    const horas = row.duracao_h ?? Math.round(computeHoras(row.data_hora_inicial, row.duracao_h));
    return String(horas);
  }
  return col.text(row);
}

const COLUMN_LAYOUT: Record<string, string> = {
  codigo_loterica: "min-w-[132px]",
  loterica: "min-w-[220px]",
  tipo_link: "min-w-[112px]",
  uf: "min-w-[72px]",
  designacao: "min-w-[150px]",
  ip_loopback: "min-w-[140px]",
  inicio: "min-w-[178px]",
  tempo: "min-w-[104px]",
  chamado: "min-w-[124px]",
  previsao: "min-w-[178px]",
  ultimo_comentario: "min-w-[380px] max-w-[560px]",
  ordem: "min-w-[140px]",
  novo_circuito: "min-w-[190px]",
  grafana: "min-w-[120px]",
  empresa: "min-w-[160px]",
  designacao_parceiro: "min-w-[210px]",
  responsavel_backup: "min-w-[190px]",
  situacao: "min-w-[190px]",
  status_planilha: "min-w-[260px]",
  status_jira: "min-w-[160px]",
  obs: "min-w-[320px]",
  responsavel: "min-w-[180px]",
  fila_jira: "min-w-[150px]",
  inc_snow: "min-w-[140px]",
  incidente_mam: "min-w-[150px]",
  status_zabbix: "min-w-[160px]",
};

function columnLayoutClass(id: string): string {
  return COLUMN_LAYOUT[id] ?? "min-w-[130px]";
}

interface QuickFilter {
  id: string;
  label: string;
  test: (r: RowT) => boolean;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: "qf1000",
    label: "Acima de 1000h",
    test: (r) => computeHoras(r.data_hora_inicial, r.duracao_h) >= 1000,
  },
  { id: "qfSemResp", label: "Sem Responsável", test: (r) => !r.responsavel?.trim() },
  {
    id: "qfSemJira",
    label: "Sem Jira",
    test: (r) => !r.status_jira?.trim() && !r.fila_jira?.trim(),
  },
  { id: "qfSemGrafana", label: "Sem Grafana", test: (r) => !r.grafana?.trim() },
  {
    id: "qfCec",
    label: "CEC Analisando",
    test: (r) => (r.status_planilha ?? "").toLowerCase().includes("cec"),
  },
  { id: "qfPrincipal", label: "Link Principal", test: (r) => !isLinkBackup(r.tipo_link) },
  { id: "qfBackup", label: "Link Secundário", test: (r) => isLinkBackup(r.tipo_link) },
];

interface PersistedState {
  colFilters: Record<string, ColFilter>;
  hiddenColumns: string[];
  sort: SortState;
  search: string;
  showNorm: boolean;
  quick: string[];
  page: number;
}

const DEFAULT_STATE: PersistedState = {
  colFilters: {},
  hiddenColumns: [],
  sort: { col: "tempo", dir: "desc" },
  search: "",
  showNorm: false,
  quick: [],
  page: 1,
};

function initialDataRef(): string {
  if (typeof window === "undefined") return processingDate();
  const processed = window.sessionStorage.getItem(CONTROL_DATE_SESSION_KEY);
  if (processed) {
    window.sessionStorage.removeItem(CONTROL_DATE_SESSION_KEY);
    return processed;
  }
  return processingDate();
}

function initialVersion(): number | null {
  if (typeof window === "undefined") return null;
  const processed = window.sessionStorage.getItem(CONTROL_VERSION_SESSION_KEY);
  if (processed) {
    window.sessionStorage.removeItem(CONTROL_VERSION_SESSION_KEY);
    const parsed = Number(processed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function persistState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function normalizePersistedState(state: PersistedState): PersistedState {
  const validIds = new Set(COLUMNS.map((c) => c.id));
  return {
    ...state,
    hiddenColumns: (state.hiddenColumns ?? []).filter((id) => validIds.has(id)),
  };
}

export default function ControlePage() {
  return <ControleView />;
}

export function ControleView({ meusCasos = false }: { meusCasos?: boolean } = {}) {
  const { canWrite, isAdmin, nome } = useAuth();
  const [rows, setRows] = useState<RowT[]>([]);
  const [dataRef, setDataRef] = useState<string>(() => initialDataRef());
  const [versao, setVersao] = useState<number | null>(() => initialVersion());
  const [histCodigo, setHistCodigo] = useState<string | null>(null);
  const [histLot, setHistLot] = useState<string | null>(null);

  // ---- estado persistido (item 5) ----
  const [st, setSt] = useState<PersistedState>(() => normalizePersistedState(loadState()));
  useEffect(() => {
    persistState(st);
  }, [st]);

  const updateState = (updater: (state: PersistedState) => PersistedState) => {
    setSt((current) => {
      const next = updater(current);
      persistState(next);
      return next;
    });
  };

  const setColFilter = (id: string, f: ColFilter) =>
    updateState((s) => ({ ...s, colFilters: { ...s.colFilters, [id]: f }, page: 1 }));
  const setSort = (col: string, dir: "asc" | "desc") =>
    updateState((s) => ({ ...s, sort: { col, dir } }));
  const toggleQuick = (id: string) =>
    updateState((s) => ({
      ...s,
      quick: s.quick.includes(id) ? s.quick.filter((q) => q !== id) : [...s.quick, id],
      page: 1,
    }));
  const toggleColumn = (id: string) =>
    updateState((s) => ({
      ...s,
      hiddenColumns: s.hiddenColumns.includes(id)
        ? s.hiddenColumns.filter((colId) => colId !== id)
        : [...s.hiddenColumns, id],
    }));
  const showAllColumns = () => updateState((s) => ({ ...s, hiddenColumns: [] }));

  const { data: datas } = useQuery({
    queryKey: ["controle-datas"],
    queryFn: fetchControleDatas,
  });

  const { data: versoes = [] } = useQuery({
    queryKey: ["controle-versoes", dataRef],
    enabled: !!dataRef,
    queryFn: () => fetchControleVersoes(dataRef),
  });

  useEffect(() => {
    if (datas && datas.length > 0 && !dataRef) {
      const hoje = processingDate();
      // item 2: abrir sempre a DATA_REFERENCIA atual; se ainda não houver, usar a mais recente
      setDataRef(datas.includes(hoje) ? hoje : datas[0]);
    }
  }, [datas, dataRef]);

  useEffect(() => {
    if (!dataRef || versoes.length === 0) return;
    if (!versao || !versoes.includes(versao)) {
      setVersao(versoes[0]);
    }
  }, [dataRef, versoes, versao]);

  const { data: fetched, isFetching } = useQuery({
    queryKey: ["controle-rows", dataRef, versao, meusCasos ? nome : null],
    enabled: !!dataRef && !!versao && (!meusCasos || !!nome),
    queryFn: () =>
      fetchAllControle({
        dataReferencia: dataRef,
        versao: versao ?? undefined,
        responsavel: meusCasos ? (nome ?? undefined) : undefined,
      }) as Promise<RowT[]>,
  });

  useEffect(() => {
    if (!fetched) return;
    setRows(fetched);
  }, [fetched]);

  const allRowsForDate = rows;
  const meNome = (nome ?? "").trim().toLowerCase();
  const baseRows = useMemo(
    () =>
      allRowsForDate.filter((r) => {
        const statusOk = st.showNorm
          ? r.status_normalizacao === "NORMALIZADO"
          : r.status_normalizacao === "ATIVO";
        if (!statusOk) return false;
        // Item "Meus Casos": restringir ao responsável logado (nome completo).
        if (meusCasos) {
          if (!meNome) return false;
          if ((r.responsavel ?? "").trim().toLowerCase() !== meNome) return false;
        }
        return true;
      }),
    [allRowsForDate, st.showNorm, meusCasos, meNome],
  );

  // distinct options per column (item 3)
  const optionsByCol = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of COLUMNS) {
      const set = new Set<string>();
      for (const r of baseRows) set.add(c.text(r));
      map[c.id] = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    return map;
  }, [baseRows]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !st.hiddenColumns.includes(c.id)),
    [st.hiddenColumns],
  );

  const filteredRows = useMemo(() => {
    const colDefById = new Map(COLUMNS.map((c) => [c.id, c]));
    const s = st.search.trim().toLowerCase();
    const quickTests = QUICK_FILTERS.filter((q) => st.quick.includes(q.id));

    let out = baseRows.filter((r) => {
      if (
        s &&
        !`${r.codigo_loterica} ${r.loterica ?? ""} ${r.designacao ?? ""} ${r.chamado ?? ""}`
          .toLowerCase()
          .includes(s)
      )
        return false;
      // per-column filters
      for (const [colId, f] of Object.entries(st.colFilters)) {
        if (!f) continue;
        const col = colDefById.get(colId);
        if (!col) continue;
        const v = col.text(r);
        if (f.search.trim() && !v.toLowerCase().includes(f.search.trim().toLowerCase()))
          return false;
        if (f.selected.length > 0 && !f.selected.includes(v)) return false;
      }
      // quick filters (item 19)
      for (const q of quickTests) if (!q.test(r)) return false;
      return true;
    });

    // Ordenacao padrao: alarmes mais antigos primeiro (maior tempo no topo).
    const col = colDefById.get(st.sort.col);
    if (col) {
      const dir = st.sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        if (col.num) return (col.num(a) - col.num(b)) * dir;
        return col.text(a).localeCompare(col.text(b), "pt-BR") * dir;
      });
    }
    return out;
  }, [baseRows, st]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(st.page, totalPages);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveField = async (row: RowT, field: string, newValRaw: string) => {
    if (!canWrite) {
      toast.error("Sem permissão para editar.");
      return;
    }
    if (!canEditField(field, canWrite, isAdmin)) {
      toast.error("Campo não editável.");
      return;
    }
    const config = EDITABLE_FIELD_CONFIG[field];
    if (!config) {
      toast.error("Campo não editável.");
      return;
    }
    let newVal: EditableValue;
    try {
      newVal = parseEditableValue(field, newValRaw);
    } catch (err) {
      toast.error("Valor inválido", {
        description: err instanceof Error ? err.message : "Revise o valor informado.",
      });
      return;
    }
    const dbField = config.dbField;
    const oldVal = (row as unknown as Record<string, unknown>)[dbField];
    if (sameEditableValue(field, oldVal, newVal)) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [dbField]: newVal } : r)));
    const payload: Record<string, EditableValue> = { [dbField]: newVal };
    const { error } = await supabase
      .from("controle_diario")
      .update(payload as never)
      .eq("id", row.id);
    if (error) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [dbField]: oldVal ?? null } : r)),
      );
      console.error("Falha no update de controle_diario", {
        endpoint: "controle_diario",
        method: "PATCH",
        table: "controle_diario",
        rowId: row.id,
        field,
        dbField,
        payload,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Erro ao salvar", {
        description: [error.code, error.message].filter(Boolean).join(" - "),
      });
      return;
    }
  };

  const exportar = (fmt: "xlsx" | "csv") => {
    exportControle(
      filteredRows,
      fmt,
      `${meusCasos ? "meus_casos" : "controle_reparo"}_${dataRef}_v${versao ?? 1}`,
    );
  };

  const columnFilterCount = Object.values(st.colFilters).filter(
    (f) => f && (f.search.trim() || f.selected.length),
  ).length;
  const activeQuickCount = QUICK_FILTERS.filter((q) => st.quick.includes(q.id)).length;
  const hiddenColumnCount = st.hiddenColumns.length;
  const hasSearchFilter = st.search.trim().length > 0;
  const activeFilterCount = columnFilterCount + activeQuickCount + (hasSearchFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
  const baseUnit = meusCasos ? "meus casos" : `circuitos ${st.showNorm ? "normalizados" : "down"}`;
  const summaryText = hasActiveFilters
    ? `${filteredRows.length} registros filtrados de ${baseRows.length} ${baseUnit}`
    : `${baseRows.length} ${baseUnit}`;
  const dataOptions = useMemo(
    () => Array.from(new Set([dataRef, ...(datas ?? [])])).filter(Boolean),
    [dataRef, datas],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {meusCasos ? "Meus Casos" : "Controle Operacional"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {summaryText}
              {versao ? ` · V${versao}` : ""}
              {isFetching && rows.length === 0 && " · carregando..."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dataRef}
              onValueChange={(value) => {
                setDataRef(value);
                setVersao(null);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Data" />
              </SelectTrigger>
              <SelectContent>
                {dataOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDateBR(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={versao ? String(versao) : ""}
              onValueChange={(value) => setVersao(Number(value))}
              disabled={versoes.length === 0}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Versão" />
              </SelectTrigger>
              <SelectContent>
                {versoes.map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    V{v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => exportar("xlsx")}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportar("csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código, lotérica, designação..."
              value={st.search}
              onChange={(e) => updateState((s) => ({ ...s, search: e.target.value, page: 1 }))}
              className="w-full pl-8 sm:w-72"
            />
          </div>
          <Button
            variant={st.showNorm ? "default" : "outline"}
            size="sm"
            onClick={() => updateState((s) => ({ ...s, showNorm: !s.showNorm, page: 1 }))}
          >
            {st.showNorm ? "Ver down" : "Ver normalizados"}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateState((s) => ({ ...s, colFilters: {}, search: "", quick: [], page: 1 }))
              }
            >
              <X className="mr-1 h-4 w-4" /> Limpar filtros ({activeFilterCount})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-1 h-4 w-4" />
                Colunas
                {hiddenColumnCount > 0 ? ` (${hiddenColumnCount} ocultas)` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
              <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!st.hiddenColumns.includes(c.id)}
                  onCheckedChange={() => toggleColumn(c.id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={showAllColumns}>Mostrar todas</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filtros rápidos (item 19) */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {QUICK_FILTERS.map((q) => (
            <button
              key={q.id}
              onClick={() => toggleQuick(q.id)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                st.quick.includes(q.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-max min-w-full border-separate border-spacing-0 border border-border text-sm">
          <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground shadow-sm">
            <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
              <th className="min-w-12 w-12"></th>
              {visibleColumns.map((c) => (
                <th
                  key={c.id}
                  className={`${columnLayoutClass(c.id)} ${c.accent ? "bg-accent" : ""}`}
                >
                  <ColumnFilterHeader
                    label={c.label}
                    options={optionsByCol[c.id] ?? []}
                    filter={st.colFilters[c.id] ?? EMPTY_FILTER}
                    onFilterChange={(f) => setColFilter(c.id, f)}
                    sortDir={st.sort.col === c.id ? st.sort.dir : null}
                    onSort={(dir) => setSort(c.id, dir)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr
                key={r.id}
                className="border-b bg-card/60 transition-colors hover:bg-muted/60 [&>td]:border-b [&>td]:border-r [&>td]:border-border/80 [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle [&>td]:leading-6 [&>td:last-child]:border-r-0"
              >
                <td className="w-12 min-w-12 text-center">
                  <button
                    onClick={() => {
                      setHistCodigo(r.codigo_loterica);
                      setHistLot(r.loterica);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/70 hover:text-primary"
                    title="Histórico"
                  >
                    <History className="h-4 w-4" />
                  </button>
                </td>
                {visibleColumns.map((c) => (
                  <Cell
                    key={c.id}
                    col={c}
                    row={r}
                    onSave={saveField}
                    canEdit={canEditField(c.id, canWrite, isAdmin)}
                  />
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="py-16 text-center text-muted-foreground"
                >
                  {dataRef
                    ? "Nenhum circuito encontrado."
                    : "Gere o controle diário na aba Importações."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação (item 5 — página atual persistida) */}
      {filteredRows.length > PAGE_SIZE && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t bg-card px-4 py-2 text-sm sm:px-6">
          <span className="text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} de{" "}
            {filteredRows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateState((s) => ({ ...s, page: page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateState((s) => ({ ...s, page: page + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <HistoricoDialog
        codigo={histCodigo}
        loterica={histLot}
        open={!!histCodigo}
        onOpenChange={(v) => !v && setHistCodigo(null)}
      />
    </div>
  );
}

function Cell({
  col,
  row,
  onSave,
  canEdit,
}: {
  col: ColumnDef;
  row: RowT;
  onSave: (row: RowT, field: string, val: string) => void;
  canEdit: boolean;
}) {
  const accent = col.accent ? "bg-accent/30" : "";
  const current = col.text(row);
  const selectOptions = fixedSelectOptions(col.id, current);

  if (selectOptions) {
    return (
      <td className={`${columnLayoutClass(col.id)} ${accent}`}>
        <Select value={current} onValueChange={(v) => onSave(row, col.id, v)} disabled={!canEdit}>
          <SelectTrigger className="h-9 w-60 text-sm">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {selectOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    );
  }

  if (canEdit) {
    return (
      <EditCell
        field={col.id}
        initialValue={editDisplayValue(row, col)}
        onSave={(value) => onSave(row, col.id, value)}
        wide={col.kind === "wideEdit" || col.kind === "comentario"}
      />
    );
  }

  if (col.kind === "tempo") {
    const fx = getFaixa(row.data_hora_inicial, row.duracao_h);
    return (
      <td className={columnLayoutClass(col.id)}>
        <Badge className={`${fx.badgeClass} px-2.5 py-1 tabular-nums`}>
          {formatHoras(fx.horas)}
        </Badge>
      </td>
    );
  }
  if (col.kind === "inicio") {
    return (
      <td className={`${columnLayoutClass(col.id)} tabular-nums`}>
        {formatDataHora(row.data_hora_inicial)}
      </td>
    );
  }
  if (col.kind === "previsao") {
    return (
      <td className={`${columnLayoutClass(col.id)} tabular-nums`}>
        {formatDataHora(row.previsao_atendimento)}
      </td>
    );
  }
  if (col.kind === "comentario") {
    return (
      <td
        className={`${columnLayoutClass(col.id)} whitespace-pre-wrap break-words align-top leading-6 text-foreground`}
      >
        {row.ultimo_comentario}
      </td>
    );
  }
  // text / default
  const v = col.text(row);
  if (col.id === "codigo_loterica") {
    return (
      <td className={`${columnLayoutClass(col.id)} font-medium`}>
        <div className="flex items-center gap-1.5">
          {row.codigo_loterica}
          {row.pendente_enriquecimento && <AlertTriangle className="h-3 w-3 text-faixa-medio" />}
        </div>
      </td>
    );
  }
  if (col.id === "grafana") {
    return (
      <td className={columnLayoutClass(col.id)}>
        {row.grafana && <Badge variant="secondary">{row.grafana}</Badge>}
      </td>
    );
  }
  if (col.id === "loterica" || col.id === "designacao_parceiro") {
    return (
      <td
        className={`${columnLayoutClass(col.id)} max-w-[280px] whitespace-normal break-words leading-6`}
        title={v}
      >
        {v}
      </td>
    );
  }
  return <td className={columnLayoutClass(col.id)}>{v}</td>;
}

function EditCell({
  field,
  initialValue,
  onSave,
  wide,
}: {
  field: string;
  initialValue: string;
  onSave: (val: string) => void;
  wide?: boolean;
}) {
  const [val, setVal] = useState(initialValue);
  useEffect(() => setVal(initialValue), [initialValue]);
  return (
    <td className={`${columnLayoutClass(field)} bg-accent/25`}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        className={`h-9 ${wide ? "w-80" : "w-44"} rounded border border-transparent bg-transparent px-2.5 text-sm text-foreground hover:border-input focus:border-ring focus:bg-card focus:outline-none disabled:cursor-not-allowed disabled:opacity-80`}
      />
    </td>
  );
}
