import { useMemo } from "react";
import { AlertTriangle, MessageSquarePlus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface LotericaNoticeView {
  id: string;
  cod_ul: string;
  observacao: string;
  created_at: string;
  created_by: string;
  creator_name?: string | null;
  creator_code?: string | null;
}

interface LotericaNoticesCardProps {
  codes: string[];
  namesByCode: Record<string, string>;
  notices: LotericaNoticeView[];
  selectedCode: string;
  onSelectedCodeChange: (code: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: (notice: LotericaNoticeView) => void;
  loading: boolean;
  saving: boolean;
  deletingNoticeId: string | null;
  error: string | null;
  successMessage: string | null;
  isAdmin: boolean;
}

const formatNoticeDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
};

const buildCreatorLabel = (notice: LotericaNoticeView) => {
  const parts = [notice.creator_code, notice.creator_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" - ");
  return "Usuario";
};

const LotericaNoticesCard = ({
  codes,
  namesByCode,
  notices,
  selectedCode,
  onSelectedCodeChange,
  draft,
  onDraftChange,
  onSubmit,
  onDelete,
  loading,
  saving,
  deletingNoticeId,
  error,
  successMessage,
  isAdmin,
}: LotericaNoticesCardProps) => {
  const hasNotices = notices.length > 0;
  const groupedNotices = useMemo(() => {
    const byCode = new Map<string, LotericaNoticeView[]>();

    codes.forEach((code) => {
      byCode.set(code, []);
    });

    notices.forEach((notice) => {
      const code = String(notice.cod_ul || "").trim();
      if (!code) return;

      const current = byCode.get(code) || [];
      current.push(notice);
      byCode.set(code, current);
    });

    return [...byCode.entries()]
      .filter(([, items]) => items.length > 0)
      .map(([code, items]) => ({ code, items }));
  }, [codes, notices]);

  const isMultiCode = codes.length > 1;
  const submitDisabled = saving || !selectedCode || !draft.trim();

  return (
    <Card className={cn("border", hasNotices ? "border-warning/40 bg-warning/10" : "border-dashed")}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {hasNotices ? <AlertTriangle className="h-5 w-5 text-warning" /> : <MessageSquarePlus className="h-5 w-5" />}
              Avisos da lotérica
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Observações compartilhadas que ficam visíveis para todos ao consultar a UL.
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              hasNotices ? "border-warning/40 bg-warning/15 text-warning" : "border-border bg-background text-muted-foreground",
            )}
          >
            {notices.length} aviso{notices.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={cn("grid gap-3", isMultiCode ? "lg:grid-cols-[220px_minmax(0,1fr)_auto]" : "lg:grid-cols-[minmax(0,1fr)_auto]")}>
          {isMultiCode && (
            <div className="space-y-1.5">
              <Label>UL do aviso</Label>
              <Select value={selectedCode} onValueChange={onSelectedCodeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a UL" />
                </SelectTrigger>
                <SelectContent>
                  {codes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} - {namesByCode[code] || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="loterica-aviso-input">Observação</Label>
            <Input
              id="loterica-aviso-input"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Ex.: cliente informou problema recorrente no local, validar atendimento antes de acionar campo."
              className="bg-background/90"
            />
          </div>

          <Button className="lg:self-end" onClick={onSubmit} disabled={submitDisabled}>
            {saving ? "Salvando..." : "Salvar aviso"}
          </Button>
        </div>

        {!!error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}
        {!!successMessage && <p className="text-xs text-success whitespace-pre-line">{successMessage}</p>}

        {loading ? (
          <div className="rounded-lg border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
            Carregando avisos compartilhados...
          </div>
        ) : groupedNotices.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
            Nenhum aviso compartilhado para as ULs consultadas.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedNotices.map(({ code, items }) => (
              <section key={code} className="space-y-2">
                {isMultiCode && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono bg-background/70">
                      {code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{namesByCode[code] || "Sem nome cadastrado"}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {items.map((notice) => {
                    const canDelete = isAdmin;

                    return (
                      <div key={notice.id} className="rounded-lg border bg-background/85 p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{buildCreatorLabel(notice)}</span>
                              <span>{formatNoticeDate(notice.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-line break-words text-sm text-foreground">{notice.observacao}</p>
                          </div>

                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              title="Excluir aviso"
                              onClick={() => onDelete(notice)}
                              disabled={deletingNoticeId === notice.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LotericaNoticesCard;
