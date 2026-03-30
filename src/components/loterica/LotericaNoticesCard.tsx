import { AlertTriangle, MessageSquarePlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  selectedCode: string;
  onSelectedCodeChange: (code: string) => void;
  textValue: string;
  onTextValueChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
  saving: boolean;
  clearing: boolean;
  error: string | null;
  successMessage: string | null;
  noticeCount: number;
  isAdmin: boolean;
}

const LotericaNoticesCard = ({
  codes,
  namesByCode,
  selectedCode,
  onSelectedCodeChange,
  textValue,
  onTextValueChange,
  onSubmit,
  onClear,
  loading,
  saving,
  clearing,
  error,
  successMessage,
  noticeCount,
  isAdmin,
}: LotericaNoticesCardProps) => {
  const isMultiCode = codes.length > 1;
  const submitDisabled = saving || clearing || loading || !selectedCode || !textValue.trim();
  const hasNotices = noticeCount > 0;
  const selectedName = (namesByCode[selectedCode] || "").trim();
  const selectedLabel = selectedCode
    ? [selectedCode, selectedName || "Sem nome"].filter(Boolean).join(" - ")
    : "";

  return (
    <Card className={cn("border", hasNotices ? "border-warning/40 bg-warning/10" : "border-dashed")}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {hasNotices ? <AlertTriangle className="h-5 w-5 text-warning" /> : <MessageSquarePlus className="h-5 w-5" />}
              <span>{"Avisos da lot\u00E9rica"}</span>
              {selectedLabel ? <span className="text-sm font-normal text-muted-foreground">{selectedLabel}</span> : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {"Visualize o hist\u00F3rico e adicione a nova informa\u00E7\u00E3o no final da mesma caixa de texto."}
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              hasNotices ? "border-warning/40 bg-warning/15 text-warning" : "border-border bg-background text-muted-foreground",
            )}
          >
            {noticeCount} aviso{noticeCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isMultiCode && (
          <div className="space-y-1.5">
            <Label>{"UL do aviso"}</Label>
            <Select value={selectedCode} onValueChange={onSelectedCodeChange}>
              <SelectTrigger>
                <SelectValue placeholder={"Selecione a UL"} />
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
          <Label htmlFor="loterica-aviso-textarea">{"Informa\u00E7\u00F5es"}</Label>
          <Textarea
            id="loterica-aviso-textarea"
            value={loading ? "Carregando avisos..." : textValue}
            onChange={(event) => onTextValueChange(event.target.value)}
            placeholder={"Digite a primeira informa\u00E7\u00E3o ou acrescente uma nova ao final do texto."}
            className="min-h-[104px] resize-y bg-background/90 text-sm leading-5"
            readOnly={loading}
          />
        </div>

        <div className="flex justify-end gap-2">
          {isAdmin && hasNotices && (
            <Button type="button" variant="outline" onClick={onClear} disabled={clearing || loading || saving}>
              {clearing ? "Apagando..." : "Apagar avisos"}
            </Button>
          )}
          <Button onClick={onSubmit} disabled={submitDisabled}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        {!!error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}
        {!!successMessage && <p className="text-xs text-success whitespace-pre-line">{successMessage}</p>}
      </CardContent>
    </Card>
  );
};

export default LotericaNoticesCard;
