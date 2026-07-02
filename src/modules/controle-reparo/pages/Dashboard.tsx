import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAllControle, fetchControleDatas, fetchControleVersoes, fetchJiraControleRows } from "@/modules/controle-reparo/lib/db";
import {
  CONTROL_DATE_SESSION_KEY,
  CONTROL_VERSION_SESSION_KEY,
  formatDateBR,
  processingDate,
} from "@/modules/controle-reparo/lib/date";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import { isLinkBackup, normalizeIncidentValue } from "@/modules/controle-reparo/lib/processing";
import type { Row } from "@/modules/controle-reparo/lib/parse";
import { getVal, cleanText } from "@/modules/controle-reparo/lib/parse";
import {
  getJiraAlarmType,
  getJiraIncident,
  isJiraAlarmRow,
  jiraRowsWithoutControleIncident,
} from "@/modules/controle-reparo/lib/dashboardJira";
import { FAIXAS, formatDataHora, getFaixa } from "@/modules/controle-reparo/lib/tempo";
import { exportControle, exportGenericRows } from "@/modules/controle-reparo/lib/controleExport";
import { DrillDownDialog, type DrillData } from "@/modules/controle-reparo/components/controle/DrillDownDialog";
import { useAuth } from "@/modules/controle-reparo/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Network,
  Radio,
  RefreshCw,
  Router,
  Upload,
  Wrench,
} from "lucide-react";

type Metric = {
  key: string;
  label: string;
  rows: ControleRow[] | Row[];
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
};

type FaixaChartRow = {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  pct: number;
  rows: ControleRow[];
  color: string;
};

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [dataRef, setDataRef] = useState(() => {
    if (typeof window === "undefined") return processingDate();
    return window.sessionStorage.getItem(CONTROL_DATE_SESSION_KEY) || processingDate();
  });
  const [versao, setVersao] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = Number(window.sessionStorage.getItem(CONTROL_VERSION_SESSION_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  });
  const [drill, setDrill] = useState<DrillData | null>(null);
  const open = (title: string, rows: ControleRow[] | Row[]) => setDrill({ title, rows: rows as Row[] });

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
    if (!datas?.length || datas.includes(dataRef)) return;
    const stored =
      typeof window === "undefined" ? null : window.sessionStorage.getItem(CONTROL_DATE_SESSION_KEY);
    if (!stored || !datas.includes(stored)) setDataRef(datas[0]);
  }, [dataRef, datas]);

  useEffect(() => {
    if (versoes.length > 0 && (!versao || !versoes.includes(versao))) {
      setVersao(versoes[0]);
    }
  }, [versoes, versao]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dataRef) window.sessionStorage.setItem(CONTROL_DATE_SESSION_KEY, dataRef);
    if (versao) window.sessionStorage.setItem(CONTROL_VERSION_SESSION_KEY, String(versao));
  }, [dataRef, versao]);

  const { data: rows = [] } = useQuery({
    queryKey: ["controle-rows", dataRef, versao],
    enabled: !!dataRef && !!versao,
    queryFn: () =>
      fetchAllControle({ dataReferencia: dataRef, versao: versao ?? undefined }) as Promise<
        ControleRow[]
      >,
  });

  const { data: jiraRows = [] } = useQuery({
    queryKey: ["jira-controle-dashboard"],
    queryFn: () => fetchJiraControleRows(),
  });

  const CLOSED_JIRA_STATUSES = new Set([
    "FECHADO", "RESOLVIDO", "CANCELADO", "ENCERRADO", "CLOSED", "DONE", "RESOLVED", "CANCELLED",
  ]);

  const jiraIncStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of jiraRows) {
      const inc = getJiraIncident(r);
      if (!inc) continue;
      const status = cleanText(getVal(r, "Status"));
      if (!map.has(inc)) map.set(inc, status);
    }
    return map;
  }, [jiraRows]);

  const principalRows = useMemo(() => rows.filter((r) => !isLinkBackup(r.tipo_link)), [rows]);
  const backupRows = useMemo(() => rows.filter((r) => isLinkBackup(r.tipo_link)), [rows]);

  if (rows.length === 0 && datas && !datas.includes(dataRef)) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 p-6 text-center lg:min-h-screen">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <div className="max-w-md">
          <h1 className="text-xl font-bold">
            Nenhum controle gerado para {dataRef ? formatDateBR(dataRef) : "esta data"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe as bases do dia e gere o controle diário para ver os indicadores.
          </p>
        </div>
        <Button asChild>
          <Link to="/projetos/controle-reparo/importacoes">
            <Upload className="mr-2 h-4 w-4" /> Ir para Importações
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-5 lg:p-6">
      <div className="flex min-w-0 flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Dashboards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Referência: {dataRef ? formatDateBR(dataRef) : "—"} · clique em um card para filtrar o
            gráfico de faixas.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Select
            value={dataRef}
            onValueChange={(value) => {
              setDataRef(value);
              setVersao(null);
            }}
            disabled={!datas?.length}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              {(datas ?? []).map((data) => (
                <SelectItem key={data} value={data}>
                  {formatDateBR(data)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={versao ? String(versao) : ""}
            onValueChange={(value) => setVersao(Number(value))}
            disabled={versoes.length === 0}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Versão" />
            </SelectTrigger>
            <SelectContent>
              {versoes.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  V{v} · {dataRef ? formatDateBR(dataRef) : "sem data"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="operacional" className="min-w-0">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
            <TabsTrigger value="principal">Link Principal</TabsTrigger>
            <TabsTrigger value="backup">Link Secundário</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operacional" className="mt-4">
          <Indicadores rows={rows} fullRows={rows} versao={versao ?? 1} showLinks onOpen={open} jiraIncStatusMap={jiraIncStatusMap} jiraRows={jiraRows} />
        </TabsContent>

        <TabsContent value="principal" className="mt-4">
          <Indicadores
            rows={principalRows}
            fullRows={principalRows}
            versao={versao ?? 1}
            onOpen={open}
            jiraIncStatusMap={jiraIncStatusMap}
            jiraRows={jiraRows}
          />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Indicadores rows={backupRows} fullRows={backupRows} versao={versao ?? 1} onOpen={open} jiraIncStatusMap={jiraIncStatusMap} jiraRows={jiraRows} />
        </TabsContent>
      </Tabs>

      <DrillDownDialog data={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function Indicadores({
  rows,
  fullRows,
  versao,
  showLinks,
  onOpen,
  jiraIncStatusMap,
  jiraRows,
}: {
  rows: ControleRow[];
  fullRows: ControleRow[];
  versao: number;
  showLinks?: boolean;
  onOpen: (title: string, rows: ControleRow[] | Row[]) => void;
  jiraIncStatusMap: Map<string, string>;
  jiraRows: Row[];
}) {
  const g = useMemo(() => computeGroups(rows, fullRows, jiraIncStatusMap), [rows, fullRows, jiraIncStatusMap]);
  const [selectedMetricKey, setSelectedMetricKey] = useState("ativos");

  const controleIncs = useMemo(() => {
    const incs = new Set<string>();
    for (const r of fullRows) {
      if (isNormalizado(r)) continue;
      const inc = normalizeIncidentValue(r.chamado) || normalizeIncidentValue(r.inc_snow);
      if (inc) incs.add(inc);
    }
    return incs;
  }, [fullRows]);

  const controleLinkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of fullRows) {
      if (isNormalizado(r)) continue;
      const key = buildCodeTypeDashboardKey(r.codigo_loterica, r.tipo_link);
      if (key) keys.add(key);
    }
    return keys;
  }, [fullRows]);

  const jiraAlarmRows = useMemo(() => {
    if (!jiraRows.length) return [] as Row[];
    return jiraRows.filter(isJiraAlarmRow);
  }, [jiraRows]);

  const incSemAlarmeRows = useMemo(() => {
    return jiraRowsWithoutControleIncident(jiraRows, controleIncs);
  }, [controleIncs, jiraRows]);

  const metrics = useMemo<Metric[]>(() => {
    const general: Metric[] = [
      { key: "ativos", label: "Circuitos Down", rows: g.ativos, icon: Activity, tone: "primary" },
      { key: "reparo", label: "Em Reparo", rows: g.reparo, icon: Wrench, tone: "medio" },
      {
        key: "normalizados",
        label: "Normalizados",
        rows: g.normalizados,
        icon: CheckCircle2,
        tone: "ok",
      },
      {
        key: "incSemAlarmeJira",
        label: "INC SEM ALARME - GIS",
        rows: incSemAlarmeRows,
        icon: AlertTriangle,
        tone: "atencao",
      },
      {
        key: "aguardandoAberturaOs",
        label: "Aguardando Abertura de O.S",
        rows: g.aguardandoAberturaOs,
        icon: ClipboardList,
        tone: "baixo",
      },
      {
        key: "migracaoEmAndamento",
        label: "Migração em Andamento",
        rows: g.migracaoEmAndamento,
        icon: RefreshCw,
        tone: "atencao",
      },
      {
        key: "instalacaoRoteador",
        label: "Instalação de Roteador",
        rows: g.instalacaoRoteador,
        icon: Router,
        tone: "critico",
      },
    ];

    if (!showLinks) return general;

    return [
      ...general,
      {
        key: "principalFora",
        label: "Principal Down",
        rows: g.principalFora,
        icon: Network,
        tone: "critico",
      },
      {
        key: "backupFora",
        label: "Secundário Down",
        rows: g.backupFora,
        icon: Radio,
        tone: "critico",
      },
      {
        key: "principalNorm",
        label: "Principal Normalizado",
        rows: g.principalNorm,
        icon: Network,
        tone: "ok",
      },
      {
        key: "backupNorm",
        label: "Secundário Normalizado",
        rows: g.backupNorm,
        icon: Radio,
        tone: "ok",
      },
      {
        key: "alarmesJira",
        label: "Alarmes do Jira",
        rows: jiraAlarmRows,
        icon: AlertTriangle,
        tone: "atencao",
      },
    ];
  }, [g, showLinks, jiraAlarmRows, incSemAlarmeRows]);

  const selectedMetric = metrics.find((metric) => metric.key === selectedMetricKey) ?? metrics[0];
  const exportRows = selectedMetric.rows;
  const exportFileBase = `dashboard_${slugify(selectedMetric.label)}_v${versao}`;
  const isJiraMetric = selectedMetricKey === "alarmesJira" || selectedMetricKey === "incSemAlarmeJira";

  return (
    <div className="grid min-w-0 gap-4">
      {!isJiraMetric && (
        <DashboardToolbar
          selectedLabel={selectedMetric.label}
          exportRows={exportRows}
          exportFileBase={exportFileBase}
        />
      )}

      <Panel title="Indicadores Gerais" subtitle="Cards clicáveis aplicam filtro no gráfico">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {metrics.slice(0, 6).map((metric) => (
            <Kpi
              key={metric.key}
              label={metric.label}
              value={metric.rows.length}
              icon={metric.icon}
              tone={metric.tone}
              active={selectedMetric.key === metric.key}
              onClick={() => setSelectedMetricKey(metric.key)}
            />
          ))}
        </div>
      </Panel>

      {showLinks && (
        <Panel title="Indicadores de Link" subtitle="Visão por principal e secundário">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {metrics.slice(6).map((metric) => (
              <Kpi
                key={metric.key}
                label={metric.label}
                value={metric.rows.length}
                icon={metric.icon}
                tone={metric.tone}
                active={selectedMetric.key === metric.key}
                onClick={() => setSelectedMetricKey(metric.key)}
              />
            ))}
          </div>
        </Panel>
      )}

      {isJiraMetric ? (
        <JiraPanel
          title={selectedMetric.label}
          rows={exportRows as Row[]}
          onOpen={(title, rows) => onOpen(title, rows as Row[])}
          controleIncs={controleIncs}
          controleLinkKeys={controleLinkKeys}
        />
      ) : (
        <>
          <FaixaPanel
            title="Faixas de Tempo"
            subtitle={selectedMetric.label}
            rows={exportRows as ControleRow[]}
            onOpen={onOpen}
          />

          <ChamadosPanel
            title="Chamados do Filtro"
            subtitle={selectedMetric.label}
            rows={exportRows as ControleRow[]}
            onOpen={onOpen}
          />
        </>
      )}
    </div>
  );
}

function JiraPanel({
  title,
  rows,
  onOpen,
  controleIncs,
  controleLinkKeys,
}: {
  title: string;
  rows: Row[];
  onOpen: (title: string, rows: Row[]) => void;
  controleIncs: Set<string>;
  controleLinkKeys: Set<string>;
}) {
  const visibleRows = rows.slice(0, 12);

  return (
    <Panel title={title} subtitle="Base Jira importada">
      <div className="min-w-0 overflow-hidden rounded-md border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-separate border-spacing-0 text-xs">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
                <th>INC / Chave</th>
                <th>Status Jira</th>
                <th>Tipo do Alarme</th>
                <th>Resumo / Descrição</th>
                <th>Fila Jira</th>
                <th>Tipo de Falha</th>
                <th>Último Comentário Cliente</th>
                <th>Último Comentário Interno</th>
                <th>Sem Correspondência</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const inc = getJiraIncident(row);
                const texto = alarmNorm(
                  getVal(
                    row,
                    "Resumo",
                    "Summary",
                    "Título",
                    "Titulo",
                    "Assunto",
                    "Descrição",
                    "Descricao",
                    "Descripcion",
                    "Mensagem",
                    "Tipo",
                    "Chamado",
                    "Chave",
                    "Key",
                    "Descrição do problema",
                    "Descrição do Problema",
                  ),
                );
                const tipoAlarme = getJiraAlarmType(row) || "-";
                const linkKey = buildCodeTypeDashboardKey(
                  getJiraCodigoLoterica(row),
                  inferJiraLinkTypeForGisCompare(row),
                );
                const semCorrespondencia = linkKey
                  ? !controleLinkKeys.has(linkKey)
                  : inc
                    ? !controleIncs.has(inc)
                    : true;

                return (
                  <tr
                    key={`${inc ?? String(index)}-${index}`}
                    className="bg-card/40 hover:bg-muted/45 [&>td]:border-b [&>td]:border-r [&>td]:border-border/80 [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle [&>td:last-child]:border-r-0"
                  >
                    <td className="whitespace-nowrap font-semibold">{inc || "—"}</td>
                    <td className="max-w-[160px] truncate" title={String(getVal(row, "Status") ?? "")}>
                      {getVal(row, "Status")}
                    </td>
                    <td className="whitespace-nowrap">{tipoAlarme}</td>
                    <td className="max-w-[260px] truncate" title={String(texto)}>
                      {getVal(row, "Resumo", "Summary", "Descrição", "Descricao")}
                    </td>
                    <td className="max-w-[160px] truncate">{getVal(row, "Fila", "Fila Jira")}</td>
                    <td className="max-w-[160px] truncate">{getJiraTipoFalha(row)}</td>
                    <td className="max-w-[260px] truncate whitespace-pre-wrap break-words">
                      {getVal(row, "Último Comentário", "Ultimo Comentario")}
                    </td>
                    <td className="max-w-[260px] truncate whitespace-pre-wrap break-words">
                      {getVal(row, "Último Comentário Interno", "Ultimo Comentario Interno")}
                    </td>
                    <td className="whitespace-nowrap">{semCorrespondencia ? "SIM" : "NÃO"}</td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted-foreground">
                    Nenhum alarme Jira encontrado no filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Mostrando {visibleRows.length} de {rows.length} registros
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportGenericRows(rows, "xlsx", `jira_${slugify(title)}`)}
            >
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportGenericRows(rows, "csv", `jira_${slugify(title)}`)}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DashboardToolbar({
  selectedLabel,
  exportRows,
  exportFileBase,
}: {
  selectedLabel: string;
  exportRows: ControleRow[];
  exportFileBase: string;
}) {
  return (
    <Card className="rounded-md border bg-card/95 p-3 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
            Filtro ativo
          </div>
          <div className="truncate text-sm font-bold text-foreground">{selectedLabel}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exportRows.length === 0}
            onClick={() => exportControle(exportRows, "xlsx", exportFileBase)}
          >
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exportRows.length === 0}
            onClick={() => exportControle(exportRows, "csv", exportFileBase)}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 rounded-md border bg-card shadow-sm">
      <div className="flex min-h-11 min-w-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-xs font-medium text-foreground/70">{subtitle}</p>}
        </div>
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </Card>
  );
}

const TONES = {
  primary: {
    card: "border-sky-500/35 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-sky-400/80 shadow-[0_0_22px_rgba(14,165,233,0.24)] ring-1 ring-sky-400/40",
    icon: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20",
    bar: "bg-sky-400",
  },
  baixo: {
    card: "border-cyan-500/30 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-cyan-300/75 shadow-[0_0_22px_rgba(34,211,238,0.20)] ring-1 ring-cyan-300/35",
    icon: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20",
    bar: "bg-cyan-300",
  },
  medio: {
    card: "border-amber-500/30 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-amber-300/75 shadow-[0_0_22px_rgba(245,158,11,0.22)] ring-1 ring-amber-300/35",
    icon: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20",
    bar: "bg-amber-300",
  },
  atencao: {
    card: "border-violet-500/30 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-violet-300/75 shadow-[0_0_22px_rgba(139,92,246,0.22)] ring-1 ring-violet-300/35",
    icon: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20",
    bar: "bg-violet-300",
  },
  ok: {
    card: "border-emerald-500/30 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-emerald-300/75 shadow-[0_0_22px_rgba(16,185,129,0.22)] ring-1 ring-emerald-300/35",
    icon: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20",
    bar: "bg-emerald-300",
  },
  critico: {
    card: "border-rose-500/35 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.28))]",
    active: "border-rose-300/80 shadow-[0_0_22px_rgba(244,63,94,0.24)] ring-1 ring-rose-300/40",
    icon: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20",
    bar: "bg-rose-300",
  },
};

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyle = TONES[tone];

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="min-w-0 text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={`relative flex min-h-[126px] min-w-0 flex-col justify-between overflow-hidden rounded-md border p-4 transition-all duration-200 hover:brightness-110 ${
          toneStyle.card
        } ${
          active ? toneStyle.active : "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        }`}
      >
        <div className={`absolute inset-x-0 top-0 h-px opacity-80 ${toneStyle.bar}`} />
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-3xl font-semibold tabular-nums leading-none text-foreground">{value}</div>
            <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground/80">{label}</div>
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneStyle.icon}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/70">
          <div
            className={`h-full rounded-full ${toneStyle.bar} ${active ? "w-full" : "w-[78%] opacity-75"}`}
          />
        </div>
      </div>
    </button>
  );
}

function FaixaPanel({
  title,
  subtitle,
  rows,
  onOpen,
}: {
  title: string;
  subtitle: string;
  rows: ControleRow[];
  onOpen: (title: string, rows: ControleRow[]) => void;
}) {
  const chartData = useMemo(() => buildFaixaRows(rows), [rows]);

  return (
    <Panel title={title} subtitle={`Filtro: ${subtitle}`}>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_254px]">
        <div className="faixa-chart text-foreground min-h-[350px] min-w-0 rounded-md border bg-background px-3 pb-3 pt-4">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 8, right: 14, left: 0, bottom: 22 }}>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.75}
              />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                interval={0}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                allowDecimals={false}
                width={42}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as FaixaChartRow;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow">
                      <div className="font-semibold text-foreground">{item.label}</div>
                      <div className="mt-1 text-foreground/70">
                        {item.value} registros · {item.pct.toFixed(1)}%
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={56}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      <div className="min-w-0 rounded-md border bg-background">
        <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Distribuição
        </div>
          <div className="px-3 py-3">
            {chartData.map((item) => (
              <button
                key={item.key}
                onClick={() => onOpen(`${title} · ${subtitle} · ${item.label}`, item.rows)}
                className="mb-3 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_54px] items-start gap-3 rounded-sm text-left outline-none last:mb-0 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
              >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-xs font-semibold text-foreground">{item.label}</span>
                    </div>
                    <div className="ml-4 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tabular-nums text-foreground">{item.value}</div>
                    <div className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {item.pct.toFixed(0)}%
                    </div>
                  </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ChamadosPanel({
  title,
  subtitle,
  rows,
  onOpen,
}: {
  title: string;
  subtitle: string;
  rows: ControleRow[];
  onOpen: (title: string, rows: ControleRow[]) => void;
}) {
  const visibleRows = rows.slice(0, 12);

  return (
    <Panel title={title} subtitle={`Filtro: ${subtitle}`}>
      <div className="min-w-0 overflow-hidden rounded-md border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-separate border-spacing-0 text-xs">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
                <th>Código</th>
                <th>Lotérica</th>
                <th>Tipo</th>
                <th>UF</th>
                <th>Chamado</th>
                <th>Início</th>
                <th>Situação</th>
                <th>Responsável</th>
                <th>Status Jira</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  key={`${row.id ?? row.codigo_loterica}-${index}`}
                  className="bg-card/40 hover:bg-muted/45 [&>td]:border-b [&>td]:border-r [&>td]:border-border/80 [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle [&>td:last-child]:border-r-0"
                >
                  <td className="whitespace-nowrap font-semibold">{row.codigo_loterica}</td>
                  <td className="max-w-[220px] truncate" title={row.loterica ?? undefined}>
                    {row.loterica}
                  </td>
                  <td className="whitespace-nowrap">{row.tipo_link}</td>
                  <td className="whitespace-nowrap">{row.uf}</td>
                  <td className="whitespace-nowrap font-medium">{row.chamado || row.inc_snow || "—"}</td>
                  <td className="whitespace-nowrap tabular-nums">{formatDataHora(row.data_hora_inicial)}</td>
                  <td className="max-w-[190px] truncate" title={(row.situacao || row.ordem) ?? undefined}>
                    {row.situacao || row.ordem}
                  </td>
                  <td className="max-w-[180px] truncate" title={row.responsavel ?? undefined}>
                    {row.responsavel}
                  </td>
                  <td className="max-w-[160px] truncate" title={row.status_jira ?? undefined}>
                    {row.status_jira}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted-foreground">
                    Nenhum chamado no filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Mostrando {visibleRows.length} de {rows.length} registros
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportControle(rows, "xlsx", `chamados_${slugify(subtitle)}`)}
            >
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => onOpen(`${title} · ${subtitle}`, rows)}
            >
              Ver todos
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

const FAIXA_COLORS: Record<string, string> = {
  critico: "#e60019",
  alto: "#f35b04",
  medio: "#f39c12",
  atencao: "#f4c430",
  moderado: "#9bd66f",
  baixo: "#22c4d6",
  ok: "#2fbf71",
};

function buildFaixaRows(rows: ControleRow[]): FaixaChartRow[] {
  const map: Record<string, ControleRow[]> = {};
  for (const r of rows) {
    const fx = getFaixa(r.data_hora_inicial, r.duracao_h);
    (map[fx.key] ??= []).push(r);
  }

  const total = rows.length;
  return FAIXAS.map((faixa) => {
    const faixaRows = map[faixa.key] ?? [];
    return {
      key: faixa.key,
      label: faixa.label,
      shortLabel: faixa.label.replace("Acima de ", ">").replace("Até ", "<="),
      value: faixaRows.length,
      pct: total ? (faixaRows.length / total) * 100 : 0,
      rows: faixaRows,
      color: FAIXA_COLORS[faixa.key] ?? "var(--primary)",
    };
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normTxt(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function alarmNorm(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const JIRA_GIS_COMPARE_TERMS = [
  "LINK BACKUP INOPERANTE",
  "LINK PRINCIPAL INOPERANTE",
  "INTERMITENCIA BACKUP",
  "INTERMITENCIA PRINCIPAL",
];

function normalizeDashboardCode(value: string | null | undefined): string {
  return cleanText(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeDashboardTipoLink(value: string | null | undefined): "PRINCIPAL" | "SECUNDÁRIO" | "" {
  const key = alarmNorm(value);
  if (!key) return "";
  if (key.includes("BACKUP") || key.includes("SECUNDARIO") || key.includes("SECUNDÁRIO")) return "SECUNDÁRIO";
  if (key.includes("PRINCIPAL") || key.includes("PRIMARIO") || key.includes("PRIMÁRIO")) return "PRINCIPAL";
  return "";
}

function buildCodeTypeDashboardKey(
  codigo: string | null | undefined,
  tipoLink: string | null | undefined,
): string {
  const code = normalizeDashboardCode(codigo);
  const tipo = normalizeDashboardTipoLink(tipoLink);
  return code && tipo ? `${code}|${tipo}` : "";
}

function getJiraCodigoLoterica(row: Row): string {
  return getVal(
    row,
    "Código da Lotérica",
    "Codigo da Loterica",
    "Cód. da Lotérica",
    "Cod. da Loterica",
    "Código UL",
    "Codigo UL",
    "cod_ul",
    "codigo_loterica",
  );
}

function getJiraResumo(row: Row): string {
  return getVal(
    row,
    "Resumo",
    "Summary",
    "Titulo",
    "Assunto",
    "Descricao",
    "Descripcion",
    "Mensagem",
    "Tipo",
    "Chamado",
    "Chave",
    "Key",
    "Descricao do problema",
    "Descricao do Problema",
  );
}

function getJiraTipoFalha(row: Row): string {
  return getVal(row, "Tipo de Falha", "tipo_falha", "Tipo Falha", "TIPO DE FALHA", "Tipo da falha");
}

function getJiraDescricao(row: Row): string {
  return getVal(
    row,
    "Descrição",
    "Descricao",
    "Descripcion",
    "Description",
    "Categoria e Sintoma",
    "categoria_sintoma",
  );
}

function getJiraTipoLink(row: Row): string {
  return getVal(row, "Tipo de Link", "Tipo de link", "Tipo Link", "Tipo do Link", "Link", "tipo_link");
}

function inferJiraLinkTypeForGisCompare(row: Row): "PRINCIPAL" | "SECUNDÁRIO" | "" {
  const joined = alarmNorm([getJiraResumo(row), getJiraTipoFalha(row), getJiraDescricao(row)].filter(Boolean).join(" | "));
  const term = JIRA_GIS_COMPARE_TERMS.find((candidate) => joined.includes(candidate));
  if (term) return normalizeDashboardTipoLink(term);
  return normalizeDashboardTipoLink(getJiraTipoLink(row));
}

function ordemKey(v: string | null | undefined): string {
  return normTxt(v).replace(/[^A-Z0-9]+/g, "");
}

const AGUARDANDO_ABERTURA_OS_KEYS = new Set([
  "AGUARDANDOABERTURADEOS",
  "DEFINICAOUN",
  "SOLICITARUN",
]);

const MIGRACAO_EM_ANDAMENTO_KEYS = new Set([
  "AGEXECOSNOVA",
  "AGEXEOSNOVA",
  "AGUARDAMIGRACAO",
  "ALTCTEC",
  "ALTTEC",
  "ALTMEIO",
  "MIGRACAOEMANDAMENTO",
]);

const INSTALACAO_ROTEADOR_KEYS = new Set(["LINKOKFALTACPE"]);

function isReparoLike(r: ControleRow): boolean {
  const situacao = normTxt(r.situacao);
  return situacao ? situacao === "REPARO" : normTxt(r.ordem) === "REPARO";
}

function isAguardandoAberturaOs(r: ControleRow): boolean {
  return AGUARDANDO_ABERTURA_OS_KEYS.has(ordemKey(r.ordem));
}

function isMigracaoEmAndamento(r: ControleRow): boolean {
  return MIGRACAO_EM_ANDAMENTO_KEYS.has(ordemKey(r.ordem));
}

function isInstalacaoRoteador(r: ControleRow): boolean {
  return INSTALACAO_ROTEADOR_KEYS.has(ordemKey(r.ordem));
}

function isNormalizado(r: ControleRow): boolean {
  return r.status_normalizacao === "NORMALIZADO" || normTxt(r.status_planilha) === "NORMALIZADO";
}

const CLOSED_JIRA_STATUSES = new Set([
  "FECHADO", "RESOLVIDO", "CANCELADO", "ENCERRADO", "CLOSED", "DONE", "RESOLVED", "CANCELLED",
]);

function isJiraOpen(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toUpperCase();
  return s.length > 0 && !CLOSED_JIRA_STATUSES.has(s);
}

function computeGroups(rows: ControleRow[], fullRows: ControleRow[], jiraMap: Map<string, string>) {
  const ativos = rows.filter((r) => !isNormalizado(r));
  const normalizados = rows.filter(isNormalizado);

  const principalAll = fullRows.filter((r) => !isLinkBackup(r.tipo_link));
  const backupAll = fullRows.filter((r) => isLinkBackup(r.tipo_link));

  const normalizadosComInc = normalizados.filter((r) => {
    const inc = normalizeIncidentValue(r.chamado) || normalizeIncidentValue(r.inc_snow);
    if (!inc) return false;
    const jiraStatus = jiraMap.get(inc);
    return isJiraOpen(jiraStatus);
  });

  return {
    ativos,
    normalizados,
    normalizadosComInc,
    reparo: ativos.filter((r) => isReparoLike(r)),
    aguardandoAberturaOs: ativos.filter((r) => isAguardandoAberturaOs(r)),
    migracaoEmAndamento: ativos.filter((r) => isMigracaoEmAndamento(r)),
    instalacaoRoteador: ativos.filter((r) => isInstalacaoRoteador(r)),
    principalAll,
    backupAll,
    principalFora: principalAll.filter((r) => !isNormalizado(r)),
    backupFora: backupAll.filter((r) => !isNormalizado(r)),
    principalNorm: principalAll.filter(isNormalizado),
    backupNorm: backupAll.filter(isNormalizado),
  };
}
