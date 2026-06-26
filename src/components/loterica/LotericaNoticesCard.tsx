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
  historyText: string;
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
  historyText,
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
  const selectedLabel = selectedCode ? [selectedCode, selectedName || "Sem nome"].join(" - ") : "";
  const editorValue = historyText ? `${historyText}\n\n${textValue}` : textValue;
  const handleEditorChange = (value: string) => {
    if (!historyText) {
      onTextValueChange(value);
      return;
    }

    if (value.startsWith(historyText)) {
      onTextValueChange(value.slice(historyText.length).replace(/^\s*\n*/, ""));
      return;
    }

    onTextValueChange(value.trimStart());
  };

  return (
    <Card className={cn("border border-blue-400/30 bg-blue-400/10 backdrop-blur-sm h-full")}>
      <CardHeader className="space-y-1 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {hasNotices ? <AlertTriangle className="h-4 w-4 text-blue-500" /> : <MessageSquarePlus className="h-4 w-4 text-blue-500" />}
              <span>{"Avisos da lot\u00E9rica"}</span>
              {selectedLabel ? <span className="text-xs font-medium text-foreground/80">{selectedLabel}</span> : null}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {"Visualize o hist\u00F3rico e adicione a nova informa\u00E7\u00E3o no final do texto."}
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-xs",
              "border-blue-400/40 bg-blue-400/15 text-blue-600 dark:text-blue-300",
            )}
          >
            {noticeCount} aviso{noticeCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>


      <CardContent className="space-y-3 pb-3">
        {isMultiCode && (
          <div className="space-y-1">
            <Label className="text-xs">{"UL do aviso"}</Label>
            <Select value={selectedCode} onValueChange={onSelectedCodeChange}>
              <SelectTrigger className="h-8 text-xs">
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

        <div className="space-y-1">
          <Label htmlFor="loterica-aviso-textarea" className="text-xs">{"Informa\u00E7\u00F5es"}</Label>
          <Textarea
            id="loterica-aviso-textarea"
            value={loading ? "Carregando avisos..." : editorValue}
            onChange={(event) => handleEditorChange(event.target.value)}
            placeholder={"Digite a primeira informa\u00E7\u00E3o ou acrescente uma nova ao final do texto."}
            className="min-h-[120px] resize-y bg-background/70 text-xs leading-5"
            readOnly={loading}
          />
        </div>

        <div className="flex justify-end gap-2">
          {isAdmin && hasNotices && (
            <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={clearing || loading || saving}>
              {clearing ? "Apagando..." : "Apagar avisos"}
            </Button>
          )}
          <Button size="sm" onClick={onSubmit} disabled={submitDisabled}>
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
