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
import { fetchAllControle, fetchControleDatas, fetchControleVersoes } from "@/modules/controle-reparo/lib/db";
import {
  CONTROL_DATE_SESSION_KEY,
  CONTROL_VERSION_SESSION_KEY,
  formatDateBR,
  processingDate,
} from "@/modules/controle-reparo/lib/date";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import { isLinkBackup } from "@/modules/controle-reparo/lib/processing";
import { FAIXAS, getFaixa } from "@/modules/controle-reparo/lib/tempo";
import { exportControle } from "@/modules/controle-reparo/lib/controleExport";
import { DrillDownDialog, type DrillData } from "@/modules/controle-reparo/components/controle/DrillDownDialog";
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
  rows: ControleRow[];
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
  const open = (title: string, rows: ControleRow[]) => setDrill({ title, rows });

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
        <Select
          value={versao ? String(versao) : ""}
          onValueChange={(value) => setVersao(Number(value))}
          disabled={versoes.length === 0}
        >
          <SelectTrigger className="w-28">
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
          <Indicadores rows={rows} fullRows={rows} versao={versao ?? 1} showLinks onOpen={open} />
        </TabsContent>

        <TabsContent value="principal" className="mt-4">
          <Indicadores
            rows={principalRows}
            fullRows={principalRows}
            versao={versao ?? 1}
            onOpen={open}
          />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Indicadores rows={backupRows} fullRows={backupRows} versao={versao ?? 1} onOpen={open} />
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
}: {
  rows: ControleRow[];
  fullRows: ControleRow[];
  versao: number;
  showLinks?: boolean;
  onOpen: (title: string, rows: ControleRow[]) => void;
}) {
  const g = useMemo(() => computeGroups(rows, fullRows), [rows, fullRows]);
  const [selectedMetricKey, setSelectedMetricKey] = useState("ativos");

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
        key: "principalAll",
        label: "Total Link Principal",
        rows: g.principalAll,
        icon: Network,
        tone: "primary",
      },
      {
        key: "backupAll",
        label: "Total Link Secundário",
        rows: g.backupAll,
        icon: Radio,
        tone: "primary",
      },
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
    ];
  }, [g, showLinks]);

  const selectedMetric = metrics.find((metric) => metric.key === selectedMetricKey) ?? metrics[0];
  const exportRows = selectedMetric.rows;
  const exportFileBase = `dashboard_${slugify(selectedMetric.label)}_v${versao}`;

  return (
    <div className="grid min-w-0 gap-4">
      <DashboardToolbar
        selectedLabel={selectedMetric.label}
        exportRows={exportRows}
        exportFileBase={exportFileBase}
      />

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

      <FaixaPanel
        title="Faixas de Tempo"
        subtitle={selectedMetric.label}
        rows={selectedMetric.rows}
        onOpen={onOpen}
      />
    </div>
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
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filtro ativo
          </div>
          <div className="truncate text-sm font-semibold">{selectedLabel}</div>
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
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </Card>
  );
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  baixo: "bg-faixa-baixo/20 text-faixa-baixo",
  medio: "bg-faixa-medio/25 text-faixa-medio",
  atencao: "bg-faixa-atencao/30 text-faixa-atencao",
  ok: "bg-faixa-ok/20 text-faixa-ok",
  critico: "bg-faixa-critico/20 text-faixa-critico",
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
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="min-w-0 text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={`flex min-h-[126px] min-w-0 flex-col justify-between rounded-md border bg-background/45 p-4 transition-colors hover:border-primary/50 ${
          active ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30" : ""
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-3xl font-semibold tabular-nums leading-none">{value}</div>
            <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">{label}</div>
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONES[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${active ? "bg-primary" : "bg-muted-foreground/35"}`}
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
        <div className="min-h-[350px] min-w-0 rounded-md border bg-background px-3 pb-3 pt-4">
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
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                width={38}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as FaixaChartRow;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow">
                      <div className="font-semibold">{item.label}</div>
                      <div className="mt-1 text-muted-foreground">
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
          <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-xs font-semibold">{item.label}</span>
                  </div>
                  <div className="ml-4 mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold tabular-nums">{item.value}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
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

function ordemKey(v: string | null | undefined): string {
  return normTxt(v).replace(/[^A-Z0-9]+/g, "");
}

const AGUARDANDO_ABERTURA_OS_KEYS = new Set([
  "AGUARDANDOABERTURADEOS",
  "DEFINICAOUN",
  "SOLICITARUN",
  "SOICITARUN",
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

function computeGroups(rows: ControleRow[], fullRows: ControleRow[]) {
  const ativos = rows.filter((r) => !isNormalizado(r));
  const normalizados = rows.filter(isNormalizado);

  const principalAll = fullRows.filter((r) => !isLinkBackup(r.tipo_link));
  const backupAll = fullRows.filter((r) => isLinkBackup(r.tipo_link));

  return {
    ativos,
    normalizados,
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
