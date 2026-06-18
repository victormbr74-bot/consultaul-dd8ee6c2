import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Massiva, ProcessedRow } from "@/modules/consulta-massiva/lib/gis-types";
import {
  buildMascaraFromMassiva,
  copyMascaraToClipboard,
  downloadMascaraHtml,
  exportMascaraPdf,
  STATUS_PADRAO,
} from "@/modules/consulta-massiva/lib/mascara";
import { logAudit } from "@/modules/consulta-massiva/lib/audit";

interface Props {
  open: boolean;
  onClose: () => void;
  massiva: Massiva | null;
  rows: ProcessedRow[];
}

export function MascaraOcorrenciaDialog({ open, onClose, massiva, rows }: Props) {
  const base = useMemo(
    () => (massiva ? buildMascaraFromMassiva(massiva, rows) : null),
    [massiva, rows],
  );
  const [normalizacao, setNormalizacao] = useState("PENDENTE");
  const [causa, setCausa] = useState("PENDENTE");
  const [statusTxt, setStatusTxt] = useState(STATUS_PADRAO);

  useEffect(() => {
    if (open) {
      setNormalizacao("PENDENTE");
      setCausa("PENDENTE");
      setStatusTxt(STATUS_PADRAO);
    }
  }, [open, massiva?.id_massiva]);

  if (!base || !massiva) return null;

  const data = {
    ...base,
    horario_normalizacao: normalizacao || "PENDENTE",
    causa_solucao: causa || "PENDENTE",
    status_texto: statusTxt,
  };

  const handleCopy = async () => {
    await copyMascaraToClipboard(data);
    await logAudit("MASCARA_COPIADA", "massivas", { id: massiva.id_massiva });
    toast.success("Mascara copiada para a area de transferencia");
  };
  const handleHtml = () => {
    downloadMascaraHtml(data);
    logAudit("MASCARA_HTML_GERADA", "massivas", { id: massiva.id_massiva });
  };
  const handlePdf = () => {
    exportMascaraPdf(data);
    logAudit("MASCARA_PDF_GERADA", "massivas", { id: massiva.id_massiva });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-noc-blue" />
            Mascara de Evento Massivo - {massiva.id_massiva}
          </DialogTitle>
          <DialogDescription>
            Dados da mascara do evento massivo sem alterar a massiva detectada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Info label="Cliente" value={base.cliente ?? ""} />
          <Info label="INC da Massiva" value={base.inc_massiva} mono />
          <Info label="Chamado interno" value={base.chamado_interno} mono />
          <Info label="Caso Pai" value={base.caso_pai} mono />
          <Info label="Tipo" value={base.tipo_label} />
          <Info label="UF" value={base.uf_label} />
          <Info label="Qtd. total" value={String(base.qtd_total)} mono />
          <Info label="Qtd. isoladas" value={String(base.qtd_isoladas)} mono />
          <Info label="Horario da falha" value={base.horario_falha} mono />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Horario de normalizacao</Label>
              <Input value={normalizacao} onChange={(e) => setNormalizacao(e.target.value)} placeholder="PENDENTE ou dd/mm/aaaa hh:mm" />
            </div>
            <div>
              <Label className="text-xs">Causa / Solucao</Label>
              <Input value={causa} onChange={(e) => setCausa(e.target.value)} placeholder="PENDENTE ou descricao" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Textarea rows={4} value={statusTxt} onChange={(e) => setStatusTxt(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Lotericas isoladas na mascara: {base.qtd_isoladas}. A lista exportada mostra somente Codigo e Loterica.
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button variant="outline" onClick={handleCopy}><Copy className="h-4 w-4" /> Copiar</Button>
          <Button variant="outline" onClick={handleHtml}><Download className="h-4 w-4" /> HTML</Button>
          <Button onClick={handlePdf}><FileText className="h-4 w-4" /> PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border bg-card/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value || "-"}</div>
    </div>
  );
}
