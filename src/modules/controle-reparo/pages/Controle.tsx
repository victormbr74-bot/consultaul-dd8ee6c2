import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/controle-reparo/hooks/use-auth";
import { fetchAllControle, fetchControleDatas, fetchControleVersoes } from "@/modules/controle-reparo/lib/db";
import {
  CONTROL_DATE_SESSION_KEY,
  CONTROL_VERSION_SESSION_KEY,
  formatDateBR,
  processingDate,
  zonedDateTimeToIso,
} from "@/modules/controle-reparo/lib/date";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import { STATUS_PLANILHA_OPCOES, isLinkBackup } from "@/modules/controle-reparo/lib/processing";
import { getFaixa, formatHoras, formatDataHora, computeHoras } from "@/modules/controle-reparo/lib/tempo";
import { exportControle } from "@/modules/controle-reparo/lib/controleExport";
import {
  normalizeControleDisplayName,
  normalizeControleFilterText,
} from "@/modules/controle-reparo/lib/displayNormalization";
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
  Database,
  RefreshCw,
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
  { id: "tipo_falha", label: "Tipo de Falha", kind: "text", text: (r) => r.tipo_falha ?? "" },
  {
    id: "previsao",
    label: "Previsão de Atendimento",
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
  if (field === "status_planilha") return opts;
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
    const value = zonedDateTimeToIso({
      year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
      hour: Number(m[4] ?? "00"), minute: Number(m[5] ?? "00"), second: Number(m[6] ?? "00"),
    });
    if (value) return value;
  }

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const value = zonedDateTimeToIso({
      year: Number(yr), month: Number(m[2]), day: Number(m[1]),
      hour: Number(m[4] ?? "00"), minute: Number(m[5] ?? "00"), second: Number(m[6] ?? "00"),
    });
    if (value) return value;
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

function canEditField(_field: string, _canWrite: boolean, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return TREATMENT_EDITABLE_IDS.has(_field);
}

function parseEditableValue(field: string, raw: string): EditableValue {
  const config = EDITABLE_FIELD_CONFIG[field];
  if (!config) throw new Error("Campo não editável.");
  if (config.parse) return config.parse(raw);
  const value = raw.trim();
  if (config.required && !value) throw new Error("Este campo não pode ficar vazio.");
  if (field === "status_planilha" && !STATUS_PLANILHA_OPCOES.includes(value as (typeof STATUS_PLANILHA_OPCOES)[number])) {
    throw new Error("Selecione um Status Planilha da lista oficial.");
  }
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

function historyValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function displayText(col: ColumnDef, row: RowT): string {
  return normalizeControleDisplayName(col.text(row));
}

function filterText(col: ColumnDef, row: RowT): string {
  return normalizeControleFilterText(col.text(row));
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
  tipo_falha: "min-w-[220px]",
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

const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  codigo_loterica: "132px",
  loterica: "220px",
  tipo_link: "112px",
  uf: "72px",
  designacao: "150px",
  ip_loopback: "140px",
  inicio: "178px",
  tempo: "104px",
  chamado: "124px",
  tipo_falha: "220px",
  previsao: "178px",
  ultimo_comentario: "380px",
  ordem: "140px",
  novo_circuito: "190px",
  grafana: "120px",
  empresa: "160px",
  designacao_parceiro: "210px",
  responsavel_backup: "190px",
  situacao: "190px",
  status_planilha: "260px",
  status_jira: "160px",
  obs: "320px",
  responsavel: "180px",
  fila_jira: "150px",
  inc_snow: "140px",
  incidente_mam: "150px",
  status_zabbix: "160px",
};

const STORAGE_KEY_COL_WIDTHS = "controle-col-widths-v1";

function loadColumnWidths(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
    if (!raw) return DEFAULT_COLUMN_WIDTHS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

function persistColumnWidths(widths: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(widths));
  } catch {
    /* ignore */
  }
}

function columnLayoutClass(id: string, widths: Record<string, string>): string {
  return COLUMN_LAYOUT[id] ?? "min-w-[130px]";
}

function columnStyle(id: string, widths: Record<string, string>): React.CSSProperties | undefined {
  const fallback = widths[id] ?? DEFAULT_COLUMN_WIDTHS[id] ?? "130px";
  const value = `var(${columnCssVar(id)}, ${fallback})`;
  return { width: value, minWidth: value };
}

function columnCssVar(id: string): string {
  return `--controle-col-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
  const queryClient = useQueryClient();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [rows, setRows] = useState<RowT[]>([]);
  const [dataRef, setDataRef] = useState<string>(() => initialDataRef());
  const [versao, setVersao] = useState<number | null>(() => initialVersion());
  const [histCodigo, setHistCodigo] = useState<string | null>(null);
  const [histLot, setHistLot] = useState<string | null>(null);
  const [syncingLotericas, setSyncingLotericas] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => loadColumnWidths());
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startWidth: number;
    frame: number | null;
    latestWidth: number;
  } | null>(null);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const ref = resizingRef.current;
      if (!ref) return;
      const dx = event.clientX - ref.startX;
      ref.latestWidth = Math.max(72, Math.round(ref.startWidth + dx));
      if (ref.frame !== null) return;
      ref.frame = window.requestAnimationFrame(() => {
        const currentRef = resizingRef.current;
        if (!currentRef) return;
        currentRef.frame = null;
        tableRef.current?.style.setProperty(columnCssVar(currentRef.id), `${currentRef.latestWidth}px`);
      });
    };

    const onUp = () => {
      const ref = resizingRef.current;
      if (ref && ref.frame !== null) {
        window.cancelAnimationFrame(ref.frame);
        tableRef.current?.style.setProperty(columnCssVar(ref.id), `${ref.latestWidth}px`);
      }
      if (ref) {
        setColumnWidths((current) => ({ ...current, [ref.id]: `${ref.latestWidth}px` }));
      }
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const startResize = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest("th");
    if (!th) return;
    const startWidth = th.getBoundingClientRect().width;
    resizingRef.current = { id, startX: event.clientX, startWidth, frame: null, latestWidth: startWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // ---- estado persistido (item 5) ----
  const [st, setSt] = useState<PersistedState>(() => normalizePersistedState(loadState()));
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = (state: PersistedState) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistState(state);
      persistTimerRef.current = null;
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const updateState = (updater: (state: PersistedState) => PersistedState) => {
    setSt((current) => {
      const next = updater(current);
      schedulePersist(next);
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
  const resetColumnWidths = () => setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  const tableColumnStyle = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(columnWidths).map(([id, width]) => [columnCssVar(id), width]),
      ) as React.CSSProperties,
    [columnWidths],
  );

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
      for (const r of baseRows) set.add(displayText(c, r));
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
        const v = displayText(col, r);
        const normalizedSearch = normalizeControleFilterText(f.search);
        if (normalizedSearch && !filterText(col, r).includes(normalizedSearch))
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

    const { error: historyError } = await supabase.from("historico_tratativas").insert({
      controle_id: row.id,
      codigo_loterica: row.codigo_loterica,
      usuario: nome,
      campo: dbField,
      valor_anterior: historyValue(oldVal),
      valor_novo: historyValue(newVal),
    } as never);
    if (historyError) {
      console.warn("Falha ao gravar histórico da edição", {
        endpoint: "historico_tratativas",
        method: "POST",
        table: "historico_tratativas",
        controleId: row.id,
        codigoLoterica: row.codigo_loterica,
        field,
        dbField,
        code: historyError.code,
        message: historyError.message,
        details: historyError.details,
        hint: historyError.hint,
      });
    }
  };

  const exportar = (fmt: "xlsx" | "csv") => {
    exportControle(
      filteredRows,
      fmt,
      `${meusCasos ? "meus_casos" : "controle_reparo"}_${dataRef}_v${versao ?? 1}`,
    );
  };

  const syncControleFromLotericas = async () => {
    if (meusCasos) return;
    if (!isAdmin) {
      toast.error("Você não tem permissão para sincronizar a base do Consulta UL.");
      return;
    }
    if (!dataRef || !versao) {
      toast.info("Selecione uma data e versão para sincronizar.");
      return;
    }
    if (!rows.length) {
      toast.info("Nenhum registro carregado para sincronizar.");
      return;
    }

    setSyncingLotericas(true);
    try {
      const { data, error } = await supabase.rpc("sync_controle_lotericas_export", {
        _data_referencia: dataRef,
        _versao: versao,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["controle-rows", dataRef, versao] });
      await queryClient.invalidateQueries({ queryKey: ["controle-datas"] });
      await queryClient.invalidateQueries({ queryKey: ["controle-versoes", dataRef] });

      const report = (data ?? {}) as {
        atualizados?: number;
        campos_atualizados?: number;
        sem_correspondencia?: number;
      };

      toast.success("Base Consulta UL sincronizada com sucesso para a versão atual.", {
        description: `${report.atualizados ?? 0} registro(s), ${report.campos_atualizados ?? 0} campo(s), ${report.sem_correspondencia ?? 0} sem correspondência.`,
      });
    } catch (error) {
      console.error("Falha ao sincronizar controle com lotericas", error);
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      toast.error(message.includes("permissão") || message.includes("permissao") ? message : "Falha ao sincronizar base Consulta UL", {
        description: message,
      });
    } finally {
      setSyncingLotericas(false);
    }
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

  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const bottomScroll = bottomScrollRef.current;
    const table = tableRef.current;
    if (!tableScroll || !bottomScroll || !table) return;

    let syncing = false;
    const syncBottomSize = () => {
      const spacer = bottomScroll.firstElementChild as HTMLDivElement | null;
      if (spacer) spacer.style.width = `${table.scrollWidth}px`;
      bottomScroll.scrollLeft = tableScroll.scrollLeft;
    };
    const onTableScroll = () => {
      if (syncing) return;
      syncing = true;
      bottomScroll.scrollLeft = tableScroll.scrollLeft;
      syncing = false;
    };
    const onBottomScroll = () => {
      if (syncing) return;
      syncing = true;
      tableScroll.scrollLeft = bottomScroll.scrollLeft;
      syncing = false;
    };

    syncBottomSize();
    tableScroll.addEventListener("scroll", onTableScroll, { passive: true });
    bottomScroll.addEventListener("scroll", onBottomScroll, { passive: true });
    const resizeObserver = new ResizeObserver(syncBottomSize);
    resizeObserver.observe(table);
    resizeObserver.observe(tableScroll);

    return () => {
      tableScroll.removeEventListener("scroll", onTableScroll);
      bottomScroll.removeEventListener("scroll", onBottomScroll);
      resizeObserver.disconnect();
    };
  }, [visibleColumns.length, pageRows.length, st.hiddenColumns]);

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
            {!meusCasos && isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={syncControleFromLotericas}
                disabled={syncingLotericas || isFetching || rows.length === 0}
              >
                {syncingLotericas ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Sincronizar Base
              </Button>
            )}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetColumnWidths}>Resetar larguras</DropdownMenuItem>
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

      <div
        ref={tableScrollRef}
        onWheel={(event) => {
          const el = tableScrollRef.current;
          if (!el || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          const before = el.scrollTop;
          el.scrollTop += event.deltaY;
          if (el.scrollTop !== before) event.stopPropagation();
        }}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-auto [scrollbar-gutter:stable]"
      >
        <table
          ref={tableRef}
          style={tableColumnStyle}
          className="w-max min-w-full table-fixed border-separate border-spacing-0 border border-border text-sm"
        >
          <colgroup>
            <col style={{ width: "48px", minWidth: "48px" }} />
            {visibleColumns.map((c) => (
              <col key={c.id} style={columnStyle(c.id, columnWidths)} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground shadow-sm">
            <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
              <th style={{ width: "48px", minWidth: "48px" }}></th>
              {visibleColumns.map((c) => (
                <th
                  key={c.id}
                  style={columnStyle(c.id, columnWidths)}
                  className={`${columnLayoutClass(c.id, columnWidths)} ${c.accent ? "bg-accent" : ""} relative`}
                >
                  <ColumnFilterHeader
                    label={c.label}
                    options={optionsByCol[c.id] ?? []}
                    filter={st.colFilters[c.id] ?? EMPTY_FILTER}
                    onFilterChange={(f) => setColFilter(c.id, f)}
                    sortDir={st.sort.col === c.id ? st.sort.dir : null}
                    onSort={(dir) => setSort(c.id, dir)}
                  />
                  <div
                    className="absolute right-0 top-0 h-full w-2 translate-x-1 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/25"
                    onPointerDown={(event) => startResize(c.id, event)}
                    title="Arraste para redimensionar"
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
                <td style={{ width: "48px", minWidth: "48px" }} className="text-center">
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
                  <td
                    key={c.id}
                    style={columnStyle(c.id, columnWidths)}
                    className={`${columnLayoutClass(c.id, columnWidths)} ${c.accent ? "bg-accent/30" : ""}`}
                  >
                    <Cell
                      col={c}
                      row={r}
                      onSave={saveField}
                      canEdit={canEditField(c.id, canWrite, isAdmin)}
                    />
                  </td>
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
      <div className="sticky bottom-0 z-20 shrink-0 border-t bg-card shadow-[0_-8px_18px_rgba(0,0,0,0.18)]">
      {filteredRows.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6">
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

      <div
        ref={bottomScrollRef}
        className="overflow-x-auto overflow-y-hidden border-t border-border/70"
        aria-label="Rolagem horizontal da tabela"
      >
        <div className="h-4" />
      </div>
      </div>

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
  const current = col.text(row);
  const selectOptions = fixedSelectOptions(col.id, current);

  if (selectOptions) {
    return (
      <Select value={current} onValueChange={(v) => onSave(row, col.id, v)} disabled={!canEdit}>
        <SelectTrigger className="h-9 w-full min-w-0 text-sm">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {selectOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (canEdit) {
    return (
      <EditCell
        initialValue={editDisplayValue(row, col)}
        onSave={(value) => onSave(row, col.id, value)}
      />
    );
  }

  if (col.kind === "tempo") {
    const fx = getFaixa(row.data_hora_inicial, row.duracao_h);
    return (
      <Badge className={`${fx.badgeClass} px-2.5 py-1 tabular-nums`}>
        {formatHoras(fx.horas)}
      </Badge>
    );
  }
  if (col.kind === "inicio") {
    return <span className="tabular-nums">{formatDataHora(row.data_hora_inicial)}</span>;
  }
  if (col.kind === "previsao") {
    return <span className="tabular-nums">{formatDataHora(row.previsao_atendimento)}</span>;
  }
  if (col.kind === "comentario") {
    return (
      <div className="whitespace-pre-wrap break-words align-top leading-6 text-foreground">
        {row.ultimo_comentario}
      </div>
    );
  }
  // text / default
  const v = displayText(col, row);
  if (col.id === "codigo_loterica") {
    return (
      <div className="flex items-center gap-1.5 font-medium">
        {row.codigo_loterica}
        {row.pendente_enriquecimento && <AlertTriangle className="h-3 w-3 text-faixa-medio" />}
      </div>
    );
  }
  if (col.id === "grafana") {
    return row.grafana ? <Badge variant="secondary">{row.grafana}</Badge> : null;
  }
  if (col.id === "loterica" || col.id === "designacao_parceiro") {
    return (
      <div className="max-w-full whitespace-normal break-words leading-6" title={v}>
        {v}
      </div>
    );
  }
  return <>{v}</>;
}

function EditCell({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (val: string) => void;
}) {
  const [val, setVal] = useState(initialValue);
  useEffect(() => setVal(initialValue), [initialValue]);
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      className="h-9 w-full min-w-0 rounded border border-transparent bg-transparent px-2.5 text-sm text-foreground hover:border-input focus:border-ring focus:bg-card focus:outline-none disabled:cursor-not-allowed disabled:opacity-80"
    />
  );
}
