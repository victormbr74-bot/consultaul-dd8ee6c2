import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Massiva, ProcessedRow } from "@/modules/consulta-massiva/lib/gis-types";
import type { DbEscalonamento } from "@/modules/consulta-massiva/lib/db-types";
import { MassivaBadge } from "./MassivaBadge";
import { SituacaoBadge } from "./SituacaoBadge";
import { Sinalizacao60kmBadge } from "./Sinalizacao60kmBadge";
import { MascaraOcorrenciaDialog } from "./MascaraOcorrenciaDialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Mail, Phone, ShieldAlert, AlertOctagon, MapPin, FileSignature } from "lucide-react";
import { exportToPdf, exportToXlsx, processedRowsForExport } from "@/modules/consulta-massiva/lib/excel";
import { SINALIZACAO_MSG } from "@/modules/consulta-massiva/lib/geo";

interface Props {
  open: boolean;
  onClose: () => void;
  massiva: Massiva | null;
  rows: ProcessedRow[];
  escalonamento?: DbEscalonamento | null;
}

export function DrillDownModal({ open, onClose, massiva, rows, escalonamento }: Props) {
  const [mascaraOpen, setMascaraOpen] = useState(false);
  if (!massiva) return null;
  const set = new Set(massiva.rowIds);
  const matching = rows.filter((r) => set.has(r.__rowId));
  const exportData = processedRowsForExport(matching);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>

      <DialogContent className="max-w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="border-b border-border p-4 space-y-2">
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base">{massiva.id_massiva}</span>
            <MassivaBadge tipo={massiva.tipo_massiva} />
            <span className="text-sm font-normal text-muted-foreground">
              {massiva.uf} · {massiva.operadora}
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" onClick={() => setMascaraOpen(true)}>
                <FileSignature className="h-4 w-4" /> Máscara
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportToXlsx(exportData, `${massiva.id_massiva}.xlsx`)}>
                <Download className="h-4 w-4" /> XLSX
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportToPdf(exportData, `${massiva.id_massiva}.pdf`, `Massiva ${massiva.id_massiva} — ${massiva.tipo_massiva}`)}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>Detalhamento dos circuitos afetados pela massiva selecionada.</DialogDescription>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              Massiva <span className="font-semibold text-foreground">{massiva.tipo_massiva.replace("_", " ")}</span> ·{" "}
              <span className="font-semibold text-foreground">{massiva.qtd_circuitos} circuitos</span>
              {massiva.qtd_lotericas_isoladas ? (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1 rounded bg-noc-yellow/15 px-1.5 py-0.5 font-semibold text-noc-yellow">
                    <AlertOctagon className="h-3 w-3" />
                    {massiva.qtd_lotericas_isoladas} lotérica{massiva.qtd_lotericas_isoladas > 1 ? "s" : ""} isolada{massiva.qtd_lotericas_isoladas > 1 ? "s" : ""}
                  </span>
                </>
              ) : null}
            </div>
            <div>
              Período identificado: <span className="font-mono text-foreground">{massiva.primeiro_alarme}</span> até{" "}
              <span className="font-mono text-foreground">{massiva.ultimo_alarme}</span>
            </div>
            <div className="text-[11px]">
              Regra aplicada: 5 ou mais circuitos da mesma UF dentro de janela de correlação de 15 minutos.
            </div>
          </div>
        </DialogHeader>


        {escalonamento ? (
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4 text-noc-yellow" />
              Escalonamento — {escalonamento.operadora}
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
              <NivelBlock label="Nível 1" nome={escalonamento.n1_nome} tel={escalonamento.n1_telefone} email={escalonamento.n1_email} />
              <NivelBlock label="Nível 2" nome={escalonamento.n2_nome} tel={escalonamento.n2_telefone} email={escalonamento.n2_email} />
              <NivelBlock label="Nível 3" nome={escalonamento.n3_nome} tel={escalonamento.n3_telefone} email={escalonamento.n3_email} />
              <NivelBlock label="Nível 4" nome={escalonamento.n4_nome} tel={escalonamento.n4_telefone} email={escalonamento.n4_email} />
            </div>
            {escalonamento.observacao && (
              <div className="mt-2 text-[11px] text-muted-foreground">{escalonamento.observacao}</div>
            )}
          </div>
        ) : massiva.parceira ? (
          <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            Sem matriz de escalonamento cadastrada para <span className="font-semibold text-foreground">{massiva.parceira}</span>.
          </div>
        ) : null}

        {massiva.sinalizacao_60km ? (
          <div className="border-b border-border bg-muted/20 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <MapPin className="h-4 w-4 text-noc-blue" />
              Análise Geográfica — Raio de 60 KM
              <Sinalizacao60kmBadge sinalizacao={massiva.sinalizacao_60km} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] md:grid-cols-4">
              <GeoField label="Cidade Epicentro" value={massiva.cidade_epicentro || "-"} />
              <GeoField label="UF Epicentro" value={massiva.uf_epicentro || "-"} />
              <GeoField label="Raio Máximo" value={massiva.sinalizacao_60km === "SEM_GEO" ? "-" : `${massiva.raio_maximo_km ?? 0} km`} />
              <GeoField label="% Dentro de 60 KM" value={massiva.sinalizacao_60km === "SEM_GEO" ? "-" : `${massiva.percentual_dentro_60km ?? 0}%`} />
              <GeoField label="Circuitos Dentro" value={String(massiva.qtd_circuitos_dentro_60km ?? 0)} />
              <GeoField label="Circuitos Fora" value={String(massiva.qtd_circuitos_fora_60km ?? 0)} />
              <GeoField label="Cidades Afetadas" value={String(massiva.qtd_cidades_afetadas ?? 0)} />
              <GeoField label="Total Circuitos" value={String(massiva.qtd_circuitos)} />
            </div>
            {massiva.cidades_afetadas && massiva.cidades_afetadas.length > 0 && (
              <div className="mt-2 text-[11px]">
                <span className="text-muted-foreground">Cidades: </span>
                <span className="font-mono">
                  {massiva.cidades_afetadas.map((c) => `${c.cidade}/${c.uf} (${c.qtd})`).join(" · ")}
                </span>
              </div>
            )}
            <div className="mt-2 rounded border border-border bg-card/50 p-2 text-[11px] italic text-muted-foreground">
              {SINALIZACAO_MSG[massiva.sinalizacao_60km]}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-semibold">Código</th>
                <th className="px-3 py-2 font-semibold">Lotérica</th>
                <th className="px-3 py-2 font-semibold">Cidade</th>
                <th className="px-3 py-2 font-semibold">UF</th>
                <th className="px-3 py-2 font-semibold">Designação</th>
                <th className="px-3 py-2 font-semibold">IP Loopback</th>
                <th className="px-3 py-2 font-semibold">Link</th>
                <th className="px-3 py-2 font-semibold">Operadora</th>
                <th className="px-3 py-2 font-semibold">Tipo Emp.</th>
                <th className="px-3 py-2 font-semibold">Chamado</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold text-right">Dist. Epicentro</th>
                <th className="px-3 py-2 font-semibold">60 KM</th>
                <th className="px-3 py-2 font-semibold">Mensagem</th>
                <th className="px-3 py-2 font-semibold">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {matching.map((r) => {
                const chamado = String(r["Chamado"] ?? "").trim();
                return (
                  <tr key={r.__rowId} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{String(r["Cód. da Lotérica"] ?? "")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{String(r["Lotérica"] ?? "")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{String(r["Cidade"] ?? "")}</td>
                    <td className="px-3 py-2 font-mono">{r.__uf}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{String(r["Designação"] ?? "")}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{String(r["IP Loopback"] ?? "")}</td>
                    <td className="px-3 py-2 font-mono">{r.__tipoLink}</td>
                    <td className="px-3 py-2 font-mono">{r.__operadora}</td>
                    <td className="px-3 py-2 font-mono">{r.__tipoEmp || r.__classificacao}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {chamado ? (
                        <span className="inline-flex items-center gap-1 rounded bg-noc-green/15 px-1.5 py-0.5 text-[11px] font-semibold text-noc-green">
                          🟢 <span className="font-mono">{chamado}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-noc-red/15 px-1.5 py-0.5 text-[11px] font-semibold text-noc-red">
                          🔴 SEM CHAMADO
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2"><SituacaoBadge situacao={r.__situacao} /></td>
                    <td className="px-3 py-2 text-right font-mono">{r.__distanciaEpicentroKm == null ? "-" : `${r.__distanciaEpicentroKm} km`}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{r.__dentro60km === "SIM" ? <span className="text-noc-green font-semibold">SIM</span> : r.__dentro60km === "NAO" ? <span className="text-noc-red font-semibold">NAO</span> : <span className="text-muted-foreground">SEM GEO</span>}</td>
                    <td className="px-3 py-2 max-w-[280px] truncate">{String(r["Mensagem"] ?? "")}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">{r.__dataHora}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
    <MascaraOcorrenciaDialog open={mascaraOpen} onClose={() => setMascaraOpen(false)} massiva={massiva} rows={rows} />
    </>
  );
}

function NivelBlock({ label, nome, tel, email }: { label: string; nome: string; tel: string; email: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{nome || "-"}</div>
      {tel && (
        <div className="mt-1 flex items-start gap-1 text-[11px]">
          <Phone className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-mono break-all">{tel}</span>
        </div>
      )}
      {email && (
        <div className="mt-0.5 flex items-start gap-1 text-[11px]">
          <Mail className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-mono break-all">{email}</span>
        </div>
      )}
    </div>
  );
}

function GeoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
