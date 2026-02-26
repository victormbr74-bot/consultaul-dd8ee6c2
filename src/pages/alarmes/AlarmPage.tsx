import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertTriangle, RefreshCw, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { formatImportBasePlanilhaSummary, importBasePlanilhaFile } from "@/lib/importBasePlanilha";
import {
  AlarmPreset,
  AlarmRecord,
  TimeBucketKey,
  buildAlarmRecords,
  fetchAlarmDatasets,
  formatDateTime,
  matchesPreset,
  matchesTimeBucket,
  searchAlarmRecord,
  summarizeOffenders,
  timeBucketCounts,
} from "./alarmData";

type MetricTone = "primary" | "info" | "warning" | "danger" | "success" | "muted";

const toneText: Record<MetricTone, string> = {
  primary: "text-primary",
  info: "text-blue-400",
  warning: "text-amber-400",
  danger: "text-red-500",
  success: "text-emerald-400",
  muted: "text-foreground",
};

const toneActive: Record<MetricTone, string> = {
  primary: "border-primary/60 ring-primary/40",
  info: "border-blue-400/60 ring-blue-400/40",
  warning: "border-amber-400/60 ring-amber-400/40",
  danger: "border-red-500/60 ring-red-500/40",
  success: "border-emerald-400/60 ring-emerald-400/40",
  muted: "border-primary/40 ring-primary/30",
};

function MetricCard({
  label,
  value,
  tone = "muted",
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  tone?: MetricTone;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="w-full text-left" onClick={onClick}>
      <Card
        className={[
          "border border-border/80 bg-card shadow-sm transition-all duration-200 h-full",
          "hover:border-border hover:-translate-y-0.5",
          active ? `ring-1 ${toneActive[tone]}` : "",
        ].join(" ")}
      >
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className={`text-3xl font-bold mt-2 leading-none ${toneText[tone]}`}>{value}</p>
        </CardContent>
      </Card>
    </button>
  );
}

interface AlarmPageProps {
  preset: AlarmPreset;
  title: string;
  description: string;
}

type SourceFilter = "all" | "jira" | "gis";

function sourceLabel(source: AlarmRecord["source"]) {
  return source === "jira" ? "Jira" : "GIS";
}

function sourceBadgeClass(source: AlarmRecord["source"]) {
  return source === "jira"
    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
    : "border-amber-500/30 bg-amber-500/10 text-amber-400";
}

function statusPreview(record: AlarmRecord) {
  return [record.status, record.statusAux].filter(Boolean).join(" | ") || "-";
}

function getTableMode(preset: AlarmPreset) {
  return {
    showOemp: preset === "principal_oemp",
    showOi: preset === "principal_oi",
    showBackupOperator: preset === "backup_4g" || preset === "backup_sencinet",
  };
}

export default function AlarmPage({ preset, title, description }: AlarmPageProps) {
  const navigate = useNavigate();
  const { setOnImportClick, setOnExport } = useSidebarActions();
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeBucketKey>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [uploadingBase, setUploadingBase] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["alarme-dados", "v2"],
    queryFn: fetchAlarmDatasets,
    staleTime: 60_000,
  });

  const records = useMemo(() => {
    if (!query.data) return [] as AlarmRecord[];
    return buildAlarmRecords(query.data);
  }, [query.data]);

  const presetRecords = useMemo(
    () => records.filter((record) => matchesPreset(record, preset)),
    [records, preset],
  );

  const sourceAndSearchRecords = useMemo(() => {
    return presetRecords.filter((record) => {
      if (sourceFilter !== "all" && record.source !== sourceFilter) return false;
      return searchAlarmRecord(record, search);
    });
  }, [presetRecords, sourceFilter, search]);

  const visibleRecords = useMemo(
    () => sourceAndSearchRecords.filter((record) => matchesTimeBucket(record.tempoHoras, timeFilter)),
    [sourceAndSearchRecords, timeFilter],
  );

  const stats = useMemo(() => timeBucketCounts(sourceAndSearchRecords), [sourceAndSearchRecords]);
  const offenders = useMemo(() => summarizeOffenders(sourceAndSearchRecords), [sourceAndSearchRecords]);
  const tableMode = getTableMode(preset);

  const errorMessage = query.error ? String((query.error as any)?.message || query.error) : "";
  const hasMissingTablesHint =
    /jira_abertos|falhas_gis|macro_base_alarmes/i.test(errorMessage) &&
    /find the table|does not exist/i.test(errorMessage);

  useLayoutEffect(() => {
    setOnExport(undefined);
    setOnImportClick(() => () => importRef.current?.click());
    return () => {
      setOnImportClick(undefined);
      setOnExport(undefined);
    };
  }, [setOnExport, setOnImportClick]);

  const handleBaseImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBase(true);
    try {
      const result = await importBasePlanilhaFile(file, {
        strictBase: true,
        preserveLotericas: true,
        macroTarget: "macro_base_alarmes",
      });
      alert(formatImportBasePlanilhaSummary(result));
      await query.refetch();
    } catch (error) {
      console.error("Falha ao subir base de alarmes", error);
      alert("Falha ao subir base de alarmes: " + String((error as any)?.message || error));
    } finally {
      setUploadingBase(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <input
        ref={importRef}
        type="file"
        accept=".xlsm,.xlsx,.xls"
        className="hidden"
        onChange={handleBaseImport}
        disabled={uploadingBase}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Estes menus usam somente a base importada da planilha (abas `MACRO`, `Jira Abertos`, `Falhas GIS`).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => importRef.current?.click()}
            disabled={uploadingBase}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadingBase ? "Subindo Base..." : "Subir Base (.xlsm)"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching || uploadingBase}>
            <RefreshCw className={`w-4 h-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {query.isLoading && (
        <Card className="border-border/80">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando alarmes e chamados...</CardContent>
        </Card>
      )}

      {query.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>Erro ao carregar dados de alarmes/chamados.</span>
            </div>
            <p className="text-muted-foreground break-words">{errorMessage}</p>
            {hasMissingTablesHint && (
              <p className="text-muted-foreground">
                Aplique as migrations de `macro_base_alarmes`, `jira_abertos` e `falhas_gis`, depois reimporte a planilha `.xlsm` (abas `MACRO`, `Jira Abertos`, `Falhas GIS`).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!query.isLoading && !query.isError && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard label="TOTAL" value={stats.total} tone="muted" active={timeFilter === "all"} onClick={() => setTimeFilter("all")} />
            <MetricCard label="JIRA" value={stats.jira} tone="info" />
            <MetricCard label="GIS" value={stats.gis} tone="warning" />
            <MetricCard label="ATE 100H" value={stats.ate_100} tone="success" active={timeFilter === "ate_100"} onClick={() => setTimeFilter((f) => (f === "ate_100" ? "all" : "ate_100"))} />
            <MetricCard label=">100H" value={stats.acima_100} tone="warning" active={timeFilter === "acima_100"} onClick={() => setTimeFilter((f) => (f === "acima_100" ? "all" : "acima_100"))} />
            <MetricCard label=">300H" value={stats.acima_300} tone="warning" active={timeFilter === "acima_300"} onClick={() => setTimeFilter((f) => (f === "acima_300" ? "all" : "acima_300"))} />
            <MetricCard label=">500H" value={stats.acima_500} tone="danger" active={timeFilter === "acima_500"} onClick={() => setTimeFilter((f) => (f === "acima_500" ? "all" : "acima_500"))} />
            <MetricCard label=">1000H" value={stats.acima_1000} tone="danger" active={timeFilter === "acima_1000"} onClick={() => setTimeFilter((f) => (f === "acima_1000" ? "all" : "acima_1000"))} />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por UL, circuito, status, falha, ticket..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={sourceFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setSourceFilter("all")}>Todos</Button>
              <Button variant={sourceFilter === "jira" ? "default" : "outline"} size="sm" onClick={() => setSourceFilter("jira")}>Jira</Button>
              <Button variant={sourceFilter === "gis" ? "default" : "outline"} size="sm" onClick={() => setSourceFilter("gis")}>GIS</Button>
            </div>
          </div>

          <Card className="border-border overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm text-muted-foreground">{visibleRecords.length} registro(s) exibidos</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fonte</TableHead>
                    <TableHead className="text-xs">UL</TableHead>
                    <TableHead className="text-xs">Lotérica</TableHead>
                    <TableHead className="text-xs">Link/Circuito</TableHead>
                    {tableMode.showOemp && <TableHead className="text-xs">Empresa OEMP</TableHead>}
                    {tableMode.showOemp && <TableHead className="text-xs">Nº Incidente MAM</TableHead>}
                    {tableMode.showOi && <TableHead className="text-xs">CCTO OI</TableHead>}
                    {tableMode.showOi && <TableHead className="text-xs">Designação</TableHead>}
                    {tableMode.showBackupOperator && <TableHead className="text-xs">Operadora 4G</TableHead>}
                    {tableMode.showBackupOperator && <TableHead className="text-xs">Resp. Backup</TableHead>}
                    <TableHead className="text-xs">Tipo de Falha</TableHead>
                    <TableHead className="text-xs min-w-[280px]">Status</TableHead>
                    <TableHead className="text-xs">Criado</TableHead>
                    <TableHead className="text-xs text-right">Tempo (h)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.slice(0, 300).map((record) => (
                    <TableRow
                      key={record.key}
                      className={record.codUl ? "cursor-pointer hover:bg-muted/30" : ""}
                      onClick={() => {
                        if (record.codUl) navigate(`/loterica/${encodeURIComponent(record.codUl)}`);
                      }}
                    >
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${sourceBadgeClass(record.source)}`}>
                          {sourceLabel(record.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{record.codUl || "-"}</TableCell>
                      <TableCell className="text-xs">{record.nomeLoterica || "-"}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[220px] truncate" title={record.linkOfensor || record.resumo || ""}>
                        {record.linkOfensor || "-"}
                      </TableCell>
                      {tableMode.showOemp && <TableCell className="text-xs">{record.empresaOemp || "-"}</TableCell>}
                      {tableMode.showOemp && <TableCell className="text-xs font-mono">{record.nIncidenteMam || "-"}</TableCell>}
                      {tableMode.showOi && <TableCell className="text-xs font-mono">{record.cctoOi || "-"}</TableCell>}
                      {tableMode.showOi && <TableCell className="text-xs font-mono">{record.designacao || "-"}</TableCell>}
                      {tableMode.showBackupOperator && <TableCell className="text-xs">{record.operadora4g || "-"}</TableCell>}
                      {tableMode.showBackupOperator && <TableCell className="text-xs">{record.respBackup || "-"}</TableCell>}
                      <TableCell className="text-xs max-w-[220px] truncate" title={record.tipoFalha}>{record.tipoFalha || "-"}</TableCell>
                      <TableCell className="text-xs whitespace-pre-wrap min-w-[280px]">{statusPreview(record)}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(record.createdAt)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        <Badge variant="outline" className={record.tempoHoras > 1000 ? "border-red-500/30 text-red-500" : record.tempoHoras > 500 ? "border-orange-500/30 text-orange-500" : record.tempoHoras > 100 ? "border-amber-500/30 text-amber-500" : ""}>
                          {record.tempoHoras}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {visibleRecords.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={
                          8 +
                          (tableMode.showOemp ? 2 : 0) +
                          (tableMode.showOi ? 2 : 0) +
                          (tableMode.showBackupOperator ? 2 : 0)
                        }
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {visibleRecords.length > 300 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                Mostrando os 300 maiores tempos. Refine a busca/filtros para ver menos registros.
              </div>
            )}
          </Card>

          <Card className="border-border/80">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm">Links ofensores acima de 200h</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {offenders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum link ofensor acima de 200h para os filtros atuais.</p>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                  {offenders.slice(0, 200).map((record) => (
                    <div key={`off:${record.key}`} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${sourceBadgeClass(record.source)}`}>{sourceLabel(record.source)}</Badge>
                          <span className="text-xs font-mono">{record.codUl || "-"}</span>
                          <span className="text-xs text-foreground truncate" title={record.linkOfensor}>{record.linkOfensor}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate" title={record.tipoFalha}>{record.tipoFalha || "-"}</p>
                        <p className="text-xs text-muted-foreground truncate" title={statusPreview(record)}>{statusPreview(record) || "-"}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">Criado: {formatDateTime(record.createdAt)}</span>
                        <Badge variant="outline" className="border-red-500/30 text-red-500 font-mono">{record.tempoHoras}h</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
