import { Link, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/controle-reparo/hooks/use-auth";
import { parseFile } from "@/modules/controle-reparo/lib/parse";
import { TIPOS_BASE, type ProcessReport, type TipoBase } from "@/modules/controle-reparo/lib/processing";
import { runDailyProcessing } from "@/modules/controle-reparo/lib/db";
import {
  CONTROL_DATE_SESSION_KEY,
  CONTROL_VERSION_SESSION_KEY,
  formatDateBR,
  processingDate,
} from "@/modules/controle-reparo/lib/date";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Play,
  Clock,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_BASE.map((t) => [t.tipo, t.label]),
);

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function describeDbError(error: unknown): string {
  const e = error as DbErrorLike;
  return [e.code, e.message, e.details, e.hint].filter(Boolean).join(" - ") || String(error);
}

function isUniqueConflict(error: unknown): boolean {
  const e = error as DbErrorLike;
  const text = describeDbError(error).toLowerCase();
  return (
    e.code === "23505" ||
    text.includes("duplicate key") ||
    text.includes("unique constraint") ||
    text.includes("violates unique")
  );
}

function formatProcessingReport(report: ProcessReport): string {
  const jiraColumns = report.jira.colunasDetectadas.length
    ? report.jira.colunasDetectadas.join(", ")
    : "nenhuma";
  const incSnowOrigin = report.jira.incSnowColunaOrigem ?? "não localizada";
  const postoOrigin = report.grafana.colunaPosto ?? "não localizada";
  const filaVaziaExemplos = report.jira.filaJiraVaziaExemplos.length
    ? report.jira.filaJiraVaziaExemplos
        .map((e) => `${e.codigo_loterica}/${e.chamado ?? "sem chamado"}: ${e.motivo}`)
        .join(" | ")
    : "nenhum";
  const grafanaExemplos = report.grafana.exemplosPosto.length
    ? report.grafana.exemplosPosto.join(" | ")
    : "nenhum";
  const r = report.resultado;
  const resp = report.responsaveis;
  const planta = report.planta;
  const plantaExemplos = planta.exemplosEnriquecidos.length
    ? planta.exemplosEnriquecidos
        .map(
          (e) =>
            `${e.codigo_loterica}/${e.tipo_link ?? "-"}: Empresa=${e.empresa ?? "-"}, Parceiro=${e.designacao_parceiro ?? "-"}, Novo=${e.novo_circuito ?? "-"}, 4G=${e.responsavel_backup ?? "-"}`,
        )
        .join(" | ")
    : "nenhum";
  const dist = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ") || "—";
  return [
    `Processamento: ${report.processamento.processadoEmLocal || report.processamento.processadoEm}; timezone ${report.processamento.timezone}; DATA_REFERENCIA ${formatDateBR(report.processamento.dataReferencia)}.`,
    `GIS: ${report.gis.gis1} GIS 1 + ${report.gis.gis2} GIS 2 = ${report.gis.bruto} bruto; circuitos down ${report.gis.finalAtivos}; diferença ${report.gis.diferenca}; colisões evitadas ${report.gis.colisoesEvitadas}.`,
    `D-1: ${report.d1.total} registros; cruzados por Código+Tipo ${report.d1.cruzados}; Situação herdada ${report.d1.situacaoHerdada}; fallback REPARO ${report.d1.situacaoFallbackReparo}; Situação=REPARO na D-1 ${report.d1.situacaoReparo}; Ordem=REPARO na D-1 ${report.d1.ordemReparo}.`,
    `Jira: ${report.jira.total} registros; INC válida ${report.jira.incValidos}; cruzados por INC ${report.jira.cruzados}; SEM INC ${report.jira.semInc}; Fila Jira preenchida ${report.jira.filaJiraPreenchida}; Fila Jira vazia ${report.jira.filaJiraVazia}; Fila Jira=SEM INC ${report.jira.filaJiraSemInc}; colunas detectadas: ${jiraColumns}.`,
    `Fila Jira vazia: ${filaVaziaExemplos}.`,
    `INC Snow: coluna usada ${incSnowOrigin}; preenchido ${report.jira.incSnowPreenchido}; vazio ${report.jira.incSnowVazio}; inválidos ignorados ${report.jira.incSnowIgnoradoInvalido}; sem fallback para Chave.`,
    report.jira.incSnowColunaNaoLocalizada
      ? "INC Snow: coluna real não localizada na base Jira; campo não preenchido para evitar dado incorreto."
      : "INC Snow: preenchido somente pela coluna Snow detectada, sem fallback para Chave.",
    `Grafana: cruzados por Circuito ${report.grafana.cruzados}; com Postos ${report.grafana.comPostos}; coluna Posto usada ${postoOrigin}; exemplos ${grafanaExemplos}.`,
    `Planta: origem ${planta.origem}; registros lidos ${planta.total}; cruzados ${planta.cruzados}; Empresa preenchida ${planta.empresaPreenchida}; Desig. Parceiro preenchida ${planta.designacaoParceiroPreenchida}; Novo Circuito preenchido ${planta.novoCircuitoPreenchido}; Operadora localizada ${planta.operadoraPreenchida}; OPERADORA 4G/Resp. Backup preenchida ${planta.operadora4gPreenchida}; sem correspondencia ${planta.semCorrespondencia}.`,
    `Planta exemplos: ${plantaExemplos}.`,
    `Responsáveis Secundário (${resp.secundarioTotal}): ${dist(resp.secundario)} | preservados D-1 ${resp.secundarioPreservadoD1}.`,
    `Responsáveis OI/OI Legado (${resp.oiTotal}): ${dist(resp.oi)} | preservados D-1 ${resp.oiPreservadoD1}.`,
    `Responsáveis OEMP Principal (${resp.oempTotal} | distribuídos ${resp.oempDistribuidos}): ${dist(resp.oemp)}.`,
    `SEM INC: ${resp.semInc}.`,
    `Resultado: controle ${r.totalControle}; circuitos down ${report.gis.finalAtivos}; Situação=REPARO ${r.situacaoReparo}; Ordem=REPARO ${r.ordemReparo} (convertidos ${r.ordemConvertidaReparo}); Status Planilha=CEC ANALISANDO ${r.statusPlanilhaCecAnalisando}; Principal ${r.principal}; Secundário ${r.secundario}; Normalizados ${r.normalizados}.`,
  ].join("\n");
}

export default function ImportacoesPage() {
  const { canWrite, user, nome } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState<string | null>(null);
  const [dataRef, setDataRef] = useState(() => processingDate());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewTipo, setViewTipo] = useState<TipoBase | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: importacoes } = useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacoes")
        .select("*")
        .order("data_importacao", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["staging-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staging_bases")
        .select("tipo, criado_em")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      const latest: Record<string, string> = {};
      for (const r of data ?? []) if (!latest[r.tipo]) latest[r.tipo] = r.criado_em;
      return latest;
    },
  });

  const clearBase = async (tipo: TipoBase) => {
    const { error: stErr } = await supabase.from("staging_bases").delete().eq("tipo", tipo);
    if (stErr) throw stErr;
    const { error: impErr } = await supabase.from("importacoes").delete().eq("tipo", tipo);
    if (impErr) throw impErr;
  };

  const insertStagingRows = async (
    tipo: TipoBase,
    rows: Record<string, unknown>[],
    importacaoId: string | null,
  ) => {
    // Same timestamp keeps fallback chunks grouped when importacao_id is unavailable.
    const criadoEm = new Date().toISOString();
    const CHUNK = 2000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("staging_bases").insert({
        tipo,
        importacao_id: importacaoId,
        linhas: slice as never,
        criado_em: criadoEm,
      } as never);
      if (error) throw error;
    }
  };

  const persistBase = async (tipo: TipoBase, fileName: string, rows: Record<string, unknown>[]) => {
    const { data: imp, error: impErr } = await supabase
      .from("importacoes")
      .insert({
        arquivo: fileName,
        tipo,
        usuario_id: user?.id,
        usuario_nome: nome,
        registros: rows.length,
        status: "carregado",
      })
      .select("id")
      .single();

    if (impErr) {
      if (!isUniqueConflict(impErr)) throw impErr;
      await insertStagingRows(tipo, rows, null);
      return;
    }

    await insertStagingRows(tipo, rows, imp.id);
  };

  const handleFile = async (tipo: TipoBase, file: File) => {
    if (!canWrite) {
      toast.error("Sem permissão", { description: "Seu usuário não pode subir bases." });
      return;
    }
    setUploading(tipo);
    try {
      const { rows } = await parseFile(file, tipo);
      if (rows.length === 0) throw new Error("Nenhum registro encontrado no arquivo.");

      const replaceExisting = Boolean(counts?.[tipo]);
      if (replaceExisting) await clearBase(tipo);

      try {
        await persistBase(tipo, file.name, rows);
      } catch (error) {
        if (!replaceExisting && isUniqueConflict(error)) {
          await clearBase(tipo);
          await persistBase(tipo, file.name, rows);
        } else {
          throw error;
        }
      }

      toast.success(`${TIPO_LABEL[tipo]} importado`, {
        description: `${rows.length} registros carregados.`,
      });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries({ queryKey: ["staging-counts"] });
    } catch (e) {
      toast.error("Erro ao importar", { description: describeDbError(e) });
    } finally {
      setUploading(null);
      if (inputs.current[tipo]) inputs.current[tipo]!.value = "";
    }
  };

  // item 16 — excluir base carregada
  const handleDelete = async (tipo: TipoBase) => {
    if (!canWrite) {
      toast.error("Sem permissão", { description: "Seu usuário não pode excluir bases." });
      return;
    }
    setDeleting(tipo);
    try {
      await clearBase(tipo);
      toast.success(`${TIPO_LABEL[tipo]} removido`, {
        description: "Arquivo e dados temporários excluídos. Você pode importar novamente.",
      });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries({ queryKey: ["staging-counts"] });
    } catch (e) {
      toast.error("Erro ao excluir", { description: describeDbError(e) });
    } finally {
      setDeleting(null);
    }
  };

  // item 16 — visualizar arquivo carregado
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ["staging-preview", viewTipo],
    enabled: !!viewTipo,
    queryFn: async () => {
      const { data: latest, error: latestError } = await supabase
        .from("staging_bases")
        .select("importacao_id, criado_em")
        .eq("tipo", viewTipo!)
        .order("criado_em", { ascending: false })
        .limit(1);
      if (latestError) throw latestError;
      if (!latest || latest.length === 0) return [];

      let query = supabase
        .from("staging_bases")
        .select("linhas")
        .eq("tipo", viewTipo!)
        .order("id", { ascending: true })
        .range(0, 4);
      if (latest[0].importacao_id) {
        query = query.eq("importacao_id", latest[0].importacao_id);
      } else {
        query = query.eq("criado_em", latest[0].criado_em);
      }

      const { data, error } = await query;
      if (error) throw error;
      const linhas = (data ?? []).flatMap(
        (item) => (item.linhas as Record<string, unknown>[]) ?? [],
      );
      return linhas.slice(0, 50);
    },
  });

  const [processingLog, setProcessingLog] = useState<string | null>(null);

  const processMut = useMutation({
    mutationFn: async () => {
      const hoje = processingDate();
      setDataRef(hoje);
      const result = await runDailyProcessing();
      setProcessingLog(
        [`Versão gerada: V${result.versao}.`, formatProcessingReport(result.stats.report)].join(
          "\n",
        ),
      );
      return result;
    },
    onSuccess: (res) => {
      setDataRef(res.dataReferencia);
      window.sessionStorage.setItem(CONTROL_DATE_SESSION_KEY, res.dataReferencia);
      window.sessionStorage.setItem(CONTROL_VERSION_SESSION_KEY, String(res.versao));
      toast.success("Controle diário gerado!", {
        description: `${res.inserted} circuitos down • ${res.stats.normalizados} normalizados • Jira: ${res.stats.comJira} • Grafana: ${res.stats.comGrafana}`,
      });
      qc.invalidateQueries({ queryKey: ["controle-datas"] });
      qc.invalidateQueries({ queryKey: ["controle-versoes", res.dataReferencia] });
      qc.invalidateQueries({ queryKey: ["controle-rows"] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      navigate("/projetos/controle-reparo/dashboard");
    },
    onError: (e) => {
      const msg = describeDbError(e);
      setProcessingLog(`Erro: ${msg}`);
      toast.error("Falha no processamento", { description: msg });
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importações</h1>
          <p className="text-sm text-muted-foreground">
            Carregue as bases do dia e gere o Controle Operacional automaticamente.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" asChild>
            <Link to="/projetos/controle-reparo/controle">Abrir Controle</Link>
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={!canWrite || processMut.isPending}
            onClick={() => processMut.mutate()}
          >
            {processMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Play className="mr-2 h-4 w-4 shrink-0" />
            )}
            <span className="sm:hidden">Processar</span>
            <span className="hidden sm:inline">Processar Controle Diário</span>
          </Button>
        </div>
      </div>

      {!canWrite && (
        <div className="mb-6 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário não pode subir bases nem gerar o controle diário. Você pode
          visualizar o histórico abaixo.
        </div>
      )}

      {processingLog && (
        <Card className="mb-6 p-4">
          <h2 className="mb-2 text-sm font-semibold">Relatório do processamento</h2>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {processingLog}
          </pre>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TIPOS_BASE.map((t) => {
          const loaded = counts?.[t.tipo];
          return (
            <Card key={t.tipo} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                {loaded ? (
                  <Badge className="bg-faixa-ok text-faixa-ok-foreground gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Carregado
                  </Badge>
                ) : (
                  <Badge variant="outline">Pendente</Badge>
                )}
              </div>
              <h3 className="mt-3 font-semibold">{t.label}</h3>
              {t.obrigatorio && <span className="text-xs text-muted-foreground">Obrigatório</span>}
              {loaded && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(loaded).toLocaleString("pt-BR")}
                </p>
              )}
              <input
                ref={(el) => {
                  inputs.current[t.tipo] = el;
                }}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(t.tipo, f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                disabled={!canWrite || uploading === t.tipo}
                onClick={() => inputs.current[t.tipo]?.click()}
              >
                {uploading === t.tipo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {loaded ? "Importar nova base" : "Carregar"}
              </Button>
              {loaded && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewTipo(t.tipo)}>
                    <Eye className="mr-2 h-4 w-4" /> Visualizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-faixa-critico hover:text-faixa-critico"
                    disabled={!canWrite || deleting === t.tipo}
                    onClick={() => handleDelete(t.tipo)}
                  >
                    {deleting === t.tipo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Excluir
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <div className="border-b p-4">
          <h2 className="font-semibold">Histórico de importações</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(importacoes ?? []).map((imp) => (
              <TableRow key={imp.id}>
                <TableCell className="font-medium">{imp.arquivo}</TableCell>
                <TableCell>{TIPO_LABEL[imp.tipo] ?? imp.tipo}</TableCell>
                <TableCell>{imp.usuario_nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{imp.registros}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{imp.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(imp.data_importacao).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
            {(importacoes ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhuma importação ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* item 16 — visualização do arquivo carregado */}
      <Dialog open={!!viewTipo} onOpenChange={(v) => !v && setViewTipo(null)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Visualizar base — {viewTipo ? TIPO_LABEL[viewTipo] : ""}</DialogTitle>
            <DialogDescription>Exibindo as primeiras 50 linhas carregadas.</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto rounded border" style={{ maxHeight: "65vh" }}>
            {previewLoading ? (
              <div className="flex items-center justify-center p-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : preview && preview.length > 0 ? (
              <table className="w-max min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
                  <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold">
                    {Object.keys(preview[0]).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((linha, i) => (
                    <tr
                      key={i}
                      className="border-b [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-1"
                    >
                      {Object.keys(preview[0]).map((k) => (
                        <td
                          key={k}
                          className="max-w-[260px] truncate"
                          title={String(linha[k] ?? "")}
                        >
                          {String(linha[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                Nenhum dado carregado para esta base.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
