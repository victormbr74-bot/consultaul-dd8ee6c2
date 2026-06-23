import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { KnowledgeBaseReferenceDialog } from "@/components/KnowledgeBaseReferenceDialog";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKnowledgeText, type KnowledgeBaseRow } from "@/lib/knowledgeBase";
import { copyRichTextToClipboard } from "@/lib/richClipboard";
import { buildEmailDraftUrl } from "@/lib/validacaoEmail";
import { isOutlookDraftConfigured, openOutlookHtmlDraft } from "@/lib/outlookDraft";
import { BookOpen, Check, Copy, Mail, Plus, RadioTower, Route, Satellite, Table } from "lucide-react";
import { toast } from "sonner";

type Defeito = {
  value: string;
  desc: string;
};

type MascaraForm = {
  cod_ul?: string | null;
  nome_loterica?: string | null;
  endereco?: string | null;
  contato?: string | null;
  designacao_nova?: string | null;
  ccto_oi?: string | null;
  ccto_oemp?: string | null;
  operadora?: string | null;
  cidade?: string | null;
  uf?: string | null;
  raw_data?: Record<string, unknown> | null;
};

interface MascaraTabProps {
  form: MascaraForm;
}

type GuideScope = "principal" | "backup";

const DEFEITOS_OEMP: Defeito[] = [
  { value: "TROCA DE SWITCH", desc: "FAVOR REALIZAR A TROCA DO SWITCH NA UNIDADE" },
  { value: "TROCA DE NOBREAK", desc: "FAVOR REALIZAR A TROCA DO NOBREAK NA UNIDADE" },
  { value: "PONTO LOGICO", desc: "UL reclama de falha em ponto logico. Favor verificar falha e realizar reparo nos pontos!" },
  { value: "CABO DE REDE", desc: "UL reclama de falha no cabo de rede. Favor verificar falha e realizar reparo ou troca no cabo!" },
  { value: "LINK INOPERANTE", desc: "LINK INOPERANTE, FAVOR VERIFICAR." },
  { value: "LINK INTERMITENTE", desc: "LINK INTERMITENTE" },
  { value: "LINK ALTA LATENCIA", desc: "LINK COM ALTA LATENCIA, FAVOR ANALISAR" },
  { value: "LINK PERCA DE PACOTE", desc: "LINK COM PERCA DE PACOTE, FAVOR ANALISAR" },
  { value: "TROCA DE CPE", desc: "FAVOR VERIFICAR O CABEAMENTO DA PORTA 1 OU 2 DO CPE." },
  { value: "TROCA DE CHIP", desc: "FAVOR REALIZAR A TROCA DO CHIP DE OPERADO NA LOTERICA" },
];

const DEFEITOS_ATIVA: Defeito[] = [
  { value: "INOPERANTE", desc: "CIRCUITO INOPERANTE, FAVOR VERIFICAR." },
  { value: "INTERMITENCIA", desc: "CIRCUITO INTERMITENTE, FAVOR VERIFICAR." },
  { value: "LATENCIA ALTA", desc: "CIRCUITO APRESENTANDO ALTA LATENCIA, FAVOR VERIFICAR." },
  { value: "PERCA DE PACOTE", desc: "CIRCUITO COM PERCA DE PACOTE, FAVOR VERIFICAR." },
  { value: "FALHA DE MTU", desc: "CIRCUITO COM FALHA DE MTU FAVOR VERIFICAR." },
];

const FALHAS_ENCERRAMENTO = [
  "Inoperancia",
  "Intermitencia",
  "Alta Latencia",
  "Perca de Pacote",
];

const CAUSAS_ENCERRAMENTO = [
  "Causa Operadora - Normalizado apos reconfiguracao do circuito na rede SDH",
  "Causa Operadora - Normalizado apos fusao de fibra.",
  "Causa Operadora - Normalizado apos recuperacao da rede metalica.",
  "Causa Operadora - Normalizado apos reset de modem no cliente.",
  "Causa Operadora - Normalizado apos recuperacao de DROP otico.",
  "Causa Cliente - Apos testes realizados no equipamento nao foi identificado falha. Circuito ativo a mais de",
  "Causa Cliente - Normalizado apos retorno de energia no ambiente do cliente.",
  "Causa Operadora - Normalizado apos troca de cabo/conectores na loterica.",
  "Causa Operadora - Falha restabelecida apos reconfiguracao do circuito no Backbone OI (NWB/DATACOM/SDH/RADIO/SATELETE)",
  "Causa Operadora - Normalizado apos troca de nobreak.",
  "Causa Operadora - Normalizado apos troca de SWITCH.",
  "Causa Cliente - Apos testes realizados no equipamento nao foi identificado falha nos terminais ambos os 3 estao trafegando normalmente.",
  "Causa Cliente - Abertura indevida, Falha nao identificada. Link ativo a mais de",
  "Causa Operadora - Link passou por migracao, link ja normalizado.",
  "Apos analise, nao foi identificado falha nos link's e nem de TFL. Favor prosseguir na abertura de reparo com categorizacao correta",
  "Apos analise nao foi identificado a indisponibilidade total da loterica, foi aberto chamado proativo para realizar a tratativa da falha reclamada.",
];

const HORARIO_FUNCIONAMENTO_PADRAO = "Seg a Sex: 08h as 18h Sab: 08h as 12h";
const HORARIO_ACESSO_PADRAO = "09h as 18h";
const CONTATO_VALIDACAO_PADRAO = "61 3464-9700";
const MESES_BR: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  marco: 2,
  março: 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeSignal = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const rawText = (raw: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = String(raw[key] ?? "").trim();
    if (value) return value;
  }
  return "";
};

const hasMeaningfulValue = (value: string) => {
  const normalized = normalizeSignal(value);
  return !!normalized && !["-", "NA", "N/A", "NAO", "NAO SE APLICA", "NULL", "SEM"].includes(normalized);
};

const containsAny = (value: string, terms: string[]) => {
  const normalized = normalizeSignal(value);
  return terms.some((term) => normalized.includes(term));
};

const extractProcedureLines = (content: string) => {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => normalizeKnowledgeText(line).startsWith("procedimento"));
  const relevant = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
  return relevant
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(resumo|contexto|operadora|tipo|gatilhos):/i.test(line));
};

const scoreKnowledgeRow = (row: KnowledgeBaseRow, requiredTerms: string[], preferredTerms: string[]) => {
  const haystack = normalizeKnowledgeText([row.title, row.category, row.summary, row.content, ...(row.tags || [])].join(" "));
  const requiredScore = requiredTerms.reduce((score, term) => {
    if (!term) return score;
    return haystack.includes(normalizeKnowledgeText(term)) ? score + 6 : score;
  }, 0);
  const preferredScore = preferredTerms.reduce((score, term) => {
    if (!term) return score;
    return haystack.includes(normalizeKnowledgeText(term)) ? score + 2 : score;
  }, 0);
  return requiredScore + preferredScore;
};

const MascaraTab = ({ form }: MascaraTabProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeMask, setActiveMask] = useState("oemp");
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [guideScope, setGuideScope] = useState<GuideScope>("principal");
  const [knowledgeRows, setKnowledgeRows] = useState<KnowledgeBaseRow[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeLoadError, setKnowledgeLoadError] = useState("");

  const [defeitoOemp, setDefeitoOemp] = useState("");
  const [defeitoAtiva, setDefeitoAtiva] = useState("");

  const [falhaEnc, setFalhaEnc] = useState("");
  const [horaFalhaEnc, setHoraFalhaEnc] = useState("");
  const [horaNormalizacaoEnc, setHoraNormalizacaoEnc] = useState("");
  const [causaEnc, setCausaEnc] = useState("");
  const [contatoEnc, setContatoEnc] = useState("Manoel Victor - 61 3464-9700");
  const [normAutoMode, setNormAutoMode] = useState(true);
  const [tempoBgp, setTempoBgp] = useState("");

  // Custom items added by user
  const [customFalhas, setCustomFalhas] = useState<string[]>([]);
  const [customCausas, setCustomCausas] = useState<string[]>([]);
  const [newFalha, setNewFalha] = useState("");
  const [newCausa, setNewCausa] = useState("");

  const allFalhas = useMemo(() => [...FALHAS_ENCERRAMENTO, ...customFalhas], [customFalhas]);
  const allCausas = useMemo(() => [...CAUSAS_ENCERRAMENTO, ...customCausas], [customCausas]);

  const addFalha = () => {
    const v = newFalha.trim();
    if (v && !allFalhas.includes(v)) {
      setCustomFalhas((prev) => [...prev, v]);
      setFalhaEnc(v);
    }
    setNewFalha("");
  };

  const addCausa = () => {
    const v = newCausa.trim();
    if (v && !allCausas.includes(v)) {
      setCustomCausas((prev) => [...prev, v]);
      setCausaEnc(v);
    }
    setNewCausa("");
  };

  // Parse "dd/MM/yyyy HH:mm[:ss]" and common PT-BR variants to Date
  const parseDateBr = useCallback((str: string): Date | null => {
    const value = str.trim();
    if (!value) return null;

    const normalizeMonth = (monthText: string) =>
      monthText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const numeric = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (numeric) {
      const [, dd, mm, yyyy, hh, min, sec = "00"] = numeric;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec));
      return isNaN(d.getTime()) ? null : d;
    }

    const slashMes = value.match(/^(\d{2})\/([A-Za-zÀ-ÿ]+)\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (slashMes) {
      const [, dd, mesTxt, yyyy, hh, min, sec = "00"] = slashMes;
      const mes = MESES_BR[normalizeMonth(mesTxt)];
      if (mes == null) return null;
      const d = new Date(Number(yyyy), mes, Number(dd), Number(hh), Number(min), Number(sec));
      return isNaN(d.getTime()) ? null : d;
    }

    const extenso = value.match(
      /^(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})\s+(?:às|as)\s+(\d{2}):(\d{2})(?::(\d{2}))?$/i,
    );
    if (!extenso) return null;

    const [, dd, mesTxt, yyyy, hh, min, sec = "00"] = extenso;
    const mes = MESES_BR[normalizeMonth(mesTxt)];
    if (mes == null) return null;
    const d = new Date(Number(yyyy), mes, Number(dd), Number(hh), Number(min), Number(sec));
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // Format Date to "dd/MM/yyyy HH:mm:ss"
  const formatDateBr = useCallback((d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, []);

  const parseTempoBgp = useCallback((str: string): number | null => {
    const value = str.trim();
    if (!value) return null;

    const hms = value.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hms) {
      const [, hh, mm, ss] = hms;
      return ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 1000;
    }

    const hm = value.match(/^(\d+):(\d{2})$/);
    if (hm) {
      const [, hh, mm] = hm;
      return ((Number(hh) * 60 + Number(mm)) * 60) * 1000;
    }

    const hoursOnly = value.match(/^(\d+)$/);
    if (hoursOnly) {
      return Number(hoursOnly[1]) * 60 * 60 * 1000;
    }

    return null;
  }, []);

  // Auto-calculate for preview only (does not overwrite manual input)
  const horaNormalizacaoEncCalculada = useMemo(() => {
    if (!normAutoMode) return "";
    const tempoBgpMs = parseTempoBgp(tempoBgp);
    if (tempoBgpMs == null) return "";

    const agora = new Date();
    const normDate = new Date(agora.getTime() - tempoBgpMs);
    return formatDateBr(normDate);
  }, [normAutoMode, tempoBgp, parseTempoBgp, formatDateBr]);

  const horaNormalizacaoEncPreview = normAutoMode ? horaNormalizacaoEncCalculada : horaNormalizacaoEnc;

  const raw = form.raw_data || {};
  const codUl = form.cod_ul || "";
  const nomeUl = form.nome_loterica || "";
  const endereco = form.endereco || "";
  const contato = form.contato || "";
  const designacaoOi = form.designacao_nova || form.ccto_oi || "";
  const circuitoOemp = String(form.ccto_oemp || raw["CIRCUITO OEMP"] || "NAO OEMP");
  const operadora = form.operadora || "";
  const simCard = String(raw["SIM CARD 4G"] || "");
  const empresaOemp = rawText(raw, ["EMPRESA OEMP"]);
  const circuitoBackup = rawText(raw, ["CIRCUITO BACKUP", "BACKUP BRISANET", "BRISANET"]) || simCard;
  const operadora4g = rawText(raw, ["OPERADORA 4G"]) || operadora;
  const respBackup = rawText(raw, ["RESP BACKUP", "RESPONSAVEL BACKUP", "RESPONSÁVEL BACKUP"]);
  const vsat = rawText(raw, ["VSAT"]);
  const modeloRoteador = String(raw["MODELO ROTEADOR"] || "");
  const cep = String(raw["CEP"] || "");
  const cidade = String(form.cidade || raw["MUNICIPIO"] || "");
  const uf = form.uf || "";

  const defeitoOempDesc = useMemo(
    () => DEFEITOS_OEMP.find((d) => d.value === defeitoOemp)?.desc || "",
    [defeitoOemp],
  );
  const defeitoAtivaDesc = useMemo(
    () => DEFEITOS_ATIVA.find((d) => d.value === defeitoAtiva)?.desc || "",
    [defeitoAtiva],
  );

  const setCopiedFeedback = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedFeedback(id);
  };

  const buildTableText = (rows: [string, string][]) => rows.map(([label, value]) => `${label}\t${value}`).join("\n");

  const buildTableHtml = (rows: [string, string][]) => `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px;width:100%;max-width:620px;">
${rows.map(([label, value], i) => {
  const bg = i % 2 === 0 ? "#1a1a2e" : "#16213e";
  return `<tr style="background:${bg};">
<td style="padding:6px 12px;font-weight:bold;color:#a8b2d1;border:1px solid #2a2a4a;white-space:nowrap;width:220px;">${escapeHtml(label)}</td>
<td style="padding:6px 12px;color:#e2e8f0;border:1px solid #2a2a4a;">${escapeHtml(value).replace(/\n/g, "<br />")}</td>
</tr>`;
}).join("\n")}
</table>`;

  const copyAsHtmlTable = async (rows: [string, string][], id: string) => {
    await copyRichTextToClipboard({
      html: buildTableHtml(rows),
      text: buildTableText(rows),
    });
    setCopiedFeedback(id);
  };

  const sendByEmail = async (subject: string, body: string, tableRows?: [string, string][], feedbackId?: string) => {
    if (tableRows?.length && isOutlookDraftConfigured()) {
      try {
        await openOutlookHtmlDraft({
          subject,
          html: buildTableHtml(tableRows),
        });
        if (feedbackId) setCopiedFeedback(feedbackId);
        toast.success("Rascunho criado no Outlook com a tabela no corpo do email.");
        return;
      } catch (error) {
        console.error("Falha ao criar rascunho no Outlook", error);
        toast.error("Falha ao criar rascunho no Outlook. Abrindo rascunho padrao.");
      }
    }

    let clipboardReady = false;

    if (tableRows?.length && feedbackId) {
      try {
        await copyAsHtmlTable(tableRows, feedbackId);
        clipboardReady = true;
        toast.success("Tabela copiada. Cole no corpo do email com Ctrl+V.");
      } catch (error) {
        console.error("Falha ao copiar tabela para o email", error);
      }
    }

    window.location.href = buildEmailDraftUrl({ subject, body, clipboardReady });
  };

  const CopyBtn = ({
    text,
    id,
    tableRows,
    emailSubject,
  }: {
    text: string;
    id: string;
    tableRows?: [string, string][];
    emailSubject: string;
  }) => (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={() => void copy(text, id)}>
        {copied === id ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
        {copied === id ? "Copiado!" : "Copiar"}
      </Button>
      {tableRows && (
        <Button variant="outline" size="sm" onClick={() => void copyAsHtmlTable(tableRows, id + "-tbl")}>
          {copied === id + "-tbl" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Table className="w-4 h-4 mr-1" />}
          {copied === id + "-tbl" ? "Copiado!" : "Tabela"}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => void sendByEmail(emailSubject, text, tableRows, id + "-mail")}>
        {copied === id + "-mail" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Mail className="w-4 h-4 mr-1" />}
        {copied === id + "-mail" ? "Tabela pronta" : "Email"}
      </Button>
    </div>
  );

  const DefeitoSelectField = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: Defeito[];
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {options.map((defeito) => (
            <SelectItem key={defeito.value} value={defeito.value}>{defeito.value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const mascaraOempOi = `NOME SOLICITANTE: CEC CAIXA
NOME DO CONTATO LOCAL: ${contato}
RAZAO SOCIAL: OI S/A
CNPJ: CNPJ OI: 76.535.764/0001-43
ENDERECO: ${endereco}
HORARIO DE ATENDIMENTO: ${HORARIO_ACESSO_PADRAO}
AUTORIZACAO DE ACESSO: SIM
CHAMADO INTERNO:
CIRCUITO OEMP: ${circuitoOemp}
CONTATO PARA ACOMPANHAR: ${CONTATO_VALIDACAO_PADRAO}
ATUALIZACAO: SIM POR VOZ A CADA 1 HORA
DEFEITO RECLAMADO: ${defeitoOemp}
${defeitoOempDesc}
NOME DA UL: ${nomeUl}
CODIGO UL: ${codUl}
CIRCUITO OI: ${designacaoOi}`;

  const mascaraMamSct = `CODIGO UL: ${codUl}
NOME DA UL: ${nomeUl}
ENDERECO UL: ${endereco}
CONTATO: ${contato}
HORARIO DE FUNCIONAMENTO: ${HORARIO_FUNCIONAMENTO_PADRAO}
PROBLEMA: ${defeitoOemp}
OPERADORA: ${operadora}
SIM CARD: ${simCard}
MODELO CPE: ${modeloRoteador}
CEP: ${cep}
MUNICIPIO/ESTADO: ${cidade} ${uf}
RECLAMACAO INICIAL: ${defeitoOempDesc}
CONTATO DE VALIDACAO: ${CONTATO_VALIDACAO_PADRAO}
HORARIO DE ACESSO: ${HORARIO_ACESSO_PADRAO}`;

  const mascaraWtTelecom = `Designacao/VLAN: ${circuitoOemp} VLAN:
Cliente Final: ${nomeUl}
Chamado interno:
DEFEITO RECLAMADO: ${defeitoOemp}
${defeitoOempDesc}
Horario do incidente:
Telefone de contato: ${CONTATO_VALIDACAO_PADRAO}
Nome do solicitante:
CIRCUITO OI: ${designacaoOi}`;

  const mascaraAtiva = `DESIGINACAO: ${designacaoOi}
COD, UL: ${codUl}
CLIENTE: OI/SA
PROTOCOLO OI:
TIPO DE SOLICITACAO: ABERTURA
PROVEDOR: ${circuitoOemp}
REICIDENTE: NAO
JA ESCALONADO: N1
DATA E HORA DA QUEDA:
REALIZADO TS COM O CLIENTE: SIM
DEFEITO RECLAMADO: ${defeitoAtiva}
HORARIO DE FUNCIONAMENTO: 08:00 as 18:00 segunda a sexta e sabado das 08:00 as 12:00
CONTATO LOCAL: ${contato}
CONTATO DE VALIDACAO: ${CONTATO_VALIDACAO_PADRAO} op.:1
RECLAMACAO INICIAL: ${defeitoAtivaDesc}`;

  const mascaraEncerramento = `CEC Caixa
Falha: ${falhaEnc}
Horario da falha: ${horaFalhaEnc}
Horario de normalizacao: ${horaNormalizacaoEncPreview}
Causa/Solucao: ${causaEnc}
Contato de Autorizacao: ${contatoEnc}`;

  const rowsOemp: [string, string][] = [
    ["NOME SOLICITANTE", "CEC CAIXA"],
    ["NOME DO CONTATO LOCAL", contato],
    ["RAZAO SOCIAL", "OI S/A"],
    ["CNPJ", "CNPJ OI: 76.535.764/0001-43"],
    ["ENDERECO", endereco],
    ["HORARIO DE ATENDIMENTO", HORARIO_ACESSO_PADRAO],
    ["AUTORIZACAO DE ACESSO?", "SIM"],
    ["CHAMADO INTERNO", ""],
    ["CIRCUITO OEMP", circuitoOemp],
    ["CONTATO PARA ACOMPANHAR", CONTATO_VALIDACAO_PADRAO],
    ["ATUALIZACAO", "SIM POR VOZ A CADA 1 HORA"],
    ["DEFEITO RECLAMADO", `${defeitoOemp}\n${defeitoOempDesc}`],
    ["NOME DA UL", nomeUl],
    ["CODIGO UL", codUl],
    ["CIRCUITO OI", designacaoOi],
  ];

  const rowsMam: [string, string][] = [
    ["CODIGO UL", codUl],
    ["NOME DA UL", nomeUl],
    ["ENDERECO UL", endereco],
    ["CONTATO", contato],
    ["HORARIO DE FUNCIONAMENTO", HORARIO_FUNCIONAMENTO_PADRAO],
    ["PROBLEMA", defeitoOemp],
    ["OPERADORA", operadora],
    ["SIM CARD", simCard],
    ["MODELO CPE", modeloRoteador],
    ["CEP", cep],
    ["MUNICIPIO/ESTADO", `${cidade} ${uf}`],
    ["RECLAMACAO INICIAL", defeitoOempDesc],
    ["CONTATO DE VALIDACAO", CONTATO_VALIDACAO_PADRAO],
    ["HORARIO DE ACESSO", HORARIO_ACESSO_PADRAO],
  ];

  const rowsWt: [string, string][] = [
    ["Designacao/VLAN", `${circuitoOemp} VLAN:`],
    ["Cliente Final", nomeUl],
    ["Chamado interno", ""],
    ["DEFEITO RECLAMADO", `${defeitoOemp}\n${defeitoOempDesc}`],
    ["Horario do incidente", ""],
    ["Telefone de contato", CONTATO_VALIDACAO_PADRAO],
    ["Nome do solicitante", ""],
    ["CIRCUITO OI", designacaoOi],
  ];

  const rowsAtiva: [string, string][] = [
    ["DESIGINACAO", designacaoOi],
    ["COD, UL", codUl],
    ["CLIENTE", "OI/SA"],
    ["PROTOCOLO OI", ""],
    ["TIPO DE SOLICITACAO", "ABERTURA"],
    ["PROVEDOR", circuitoOemp],
    ["REICIDENTE", "NAO"],
    ["JA ESCALONADO", "N1"],
    ["DATA E HORA DA QUEDA", ""],
    ["REALIZADO TS COM O CLIENTE", "SIM"],
    ["DEFEITO RECLAMADO", defeitoAtiva],
    ["HORARIO DE FUNCIONAMENTO", "08:00 as 18:00 segunda a sexta e sabado das 08:00 as 12:00"],
    ["CONTATO LOCAL", contato],
    ["CONTATO DE VALIDACAO", `${CONTATO_VALIDACAO_PADRAO} op.:1`],
    ["RECLAMACAO INICIAL", defeitoAtivaDesc],
  ];

  const rowsEnc: [string, string][] = [
    ["", "CEC Caixa"],
    ["Falha", falhaEnc],
    ["Horario da falha", horaFalhaEnc],
    ["Horario de normalizacao", horaNormalizacaoEncPreview],
    ["Causa/Solucao", causaEnc],
    ["Contato de Autorizacao", contatoEnc],
  ];

  const maskLabelByValue: Record<string, string> = {
    oemp: "OEMP OI",
    mam: "MAM/SCT",
    wt: "WT Telecom",
    ativa: "ATIVA",
    enc: "Encerramento",
  };

  useEffect(() => {
    let cancelled = false;

    const loadKnowledgeRows = async () => {
      setKnowledgeLoading(true);
      setKnowledgeLoadError("");
      const { data, error } = await (supabase as any)
        .from("knowledge_base")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (cancelled) return;

      setKnowledgeLoading(false);
      if (error) {
        setKnowledgeRows([]);
        setKnowledgeLoadError("Base de conhecimento nao encontrada ou nao carregada.");
        return;
      }

      setKnowledgeRows((data as KnowledgeBaseRow[]) || []);
    };

    void loadKnowledgeRows();

    return () => {
      cancelled = true;
    };
  }, []);

  const aberturaSignal = [empresaOemp, circuitoOemp, circuitoBackup, simCard, operadora4g, respBackup, vsat, modeloRoteador].join(" ");
  const hasOemp = hasMeaningfulValue(circuitoOemp) && normalizeSignal(circuitoOemp) !== "NAO OEMP";
  const hasVsat = hasMeaningfulValue(vsat) || containsAny(aberturaSignal, ["VSAT", "SATELITE", "SATELITE"]);
  const has4g = hasMeaningfulValue(simCard) || containsAny(aberturaSignal, ["4G", "SIM CARD", "LTE", "VIVO", "TIM", "ARQIA", "CLARO", "BRISANET"]);
  const backupType = hasVsat ? "VSAT" : has4g ? "4G" : "Backup";

  const knowledgeKeywords = [
    "mascara",
    maskLabelByValue[activeMask],
    activeMask === "enc" ? "encerramento" : "abertura",
    guideScope,
    guideScope === "principal" ? "principal oemp" : `backup ${backupType}`,
    operadora,
    operadora4g,
    circuitoOemp,
    circuitoBackup,
    designacaoOi,
    defeitoOemp,
    defeitoAtiva,
  ].filter(Boolean);

  const selectedKnowledgeGuide = useMemo(() => {
    if (!knowledgeRows.length) return null;

    const requiredTerms =
      guideScope === "principal"
        ? ["principal", "oemp", empresaOemp, operadora].filter(Boolean)
        : ["backup", backupType, operadora4g, respBackup].filter(Boolean);

    const preferredTerms =
      guideScope === "principal"
        ? ["mascara", "abertura", "chamado", circuitoOemp, designacaoOi].filter(Boolean)
        : ["mascara", "abertura", "chamado", circuitoBackup, simCard, "operadora 4g"].filter(Boolean);

    const ranked = knowledgeRows
      .map((row) => ({ row, score: scoreKnowledgeRow(row, requiredTerms, preferredTerms) }))
      .filter((item) => item.score >= 4)
      .sort((a, b) => b.score - a.score || new Date(b.row.updated_at).getTime() - new Date(a.row.updated_at).getTime());

    return ranked[0]?.row || null;
  }, [
    backupType,
    circuitoBackup,
    circuitoOemp,
    designacaoOi,
    empresaOemp,
    guideScope,
    knowledgeRows,
    operadora,
    operadora4g,
    respBackup,
    simCard,
  ]);

  const activeGuide = selectedKnowledgeGuide
    ? {
        title: selectedKnowledgeGuide.title,
        icon: guideScope === "principal" ? Route : hasVsat ? Satellite : RadioTower,
        badge:
          guideScope === "principal"
            ? empresaOemp || operadora || selectedKnowledgeGuide.category || "Principal"
            : operadora4g || respBackup || selectedKnowledgeGuide.category || backupType,
        reference:
          guideScope === "principal"
            ? circuitoOemp || designacaoOi
            : circuitoBackup || simCard || vsat,
        summary: selectedKnowledgeGuide.summary || "",
        steps: extractProcedureLines(selectedKnowledgeGuide.content),
      }
    : null;

  const AberturaGuidePanel = () => {
    const Icon = activeGuide?.icon || BookOpen;
    return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <CardTitle className="text-base">Orientacao de abertura</CardTitle>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-1">
          <Button
            type="button"
            size="sm"
            variant={guideScope === "principal" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setGuideScope("principal")}
          >
            Principal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={guideScope === "backup" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setGuideScope("backup")}
          >
            Backup
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {empresaOemp ? <Badge variant="outline">OEMP: {empresaOemp}</Badge> : null}
          {hasVsat ? <Badge variant="secondary">VSAT</Badge> : null}
          {has4g ? <Badge variant="secondary">4G: {operadora4g || "-"}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {guideScope === "principal"
            ? `Referencia principal: ${circuitoOemp || designacaoOi || "-"}`
            : `Referencia backup: ${backupType}${circuitoBackup ? ` / ${circuitoBackup}` : ""}`}
        </div>

        {knowledgeLoading ? (
          <div className="text-xs text-muted-foreground">Carregando base de conhecimento...</div>
        ) : null}

        {activeGuide ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{activeGuide.title}</h3>
                <Badge variant="secondary" className="text-[10px]">Base</Badge>
              </div>
              {activeGuide.summary ? (
                <p className="rounded-md bg-muted/40 p-2 text-xs leading-5 text-muted-foreground">{activeGuide.summary}</p>
              ) : null}
              <div className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Responsavel/operadora</span>
                <span className="font-medium">{activeGuide.badge}</span>
                <span className="text-muted-foreground">Referencia</span>
                <span className="font-mono text-[11px]">{activeGuide.reference || "-"}</span>
              </div>
            </div>
            <Separator />
            <ol className="space-y-2">
              {activeGuide.steps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-2 text-xs leading-5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step.replace(/^\d+[\).\s-]+/, "")}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : !knowledgeLoading ? (
          <div className="rounded-md border border-dashed p-4 text-xs leading-5 text-muted-foreground">
            {knowledgeLoadError || "Nenhuma orientacao cadastrada na base para esta opcao."}
          </div>
        ) : null}

        <Button variant="outline" size="sm" className="w-full" onClick={() => setKnowledgeOpen(true)}>
          <BookOpen className="h-4 w-4" />
          Ver base completa
        </Button>
      </CardContent>
    </Card>
    );
  };

  return (
    <>
    <KnowledgeBaseReferenceDialog
      open={knowledgeOpen}
      onOpenChange={setKnowledgeOpen}
      context="Mascara"
      keywords={knowledgeKeywords}
      title={`Base de conhecimento - ${maskLabelByValue[activeMask] || "Mascara"}`}
    />

    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <AberturaGuidePanel />

      <Tabs value={activeMask} onValueChange={setActiveMask} className="min-w-0 space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="oemp" className="text-xs">OEMP OI</TabsTrigger>
          <TabsTrigger value="mam" className="text-xs">MAM/SCT</TabsTrigger>
          <TabsTrigger value="wt" className="text-xs">WT Telecom</TabsTrigger>
          <TabsTrigger value="ativa" className="text-xs">ATIVA</TabsTrigger>
          <TabsTrigger value="enc" className="text-xs">Encerramento</TabsTrigger>
        </TabsList>

      <TabsContent value="oemp">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara OEMP OI</CardTitle>
            <CopyBtn text={mascaraOempOi} id="oemp" tableRows={rowsOemp} emailSubject={`Mascara OEMP OI - ${codUl || nomeUl || "UL"}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            <DefeitoSelectField
              label="Defeito Reclamado"
              options={DEFEITOS_OEMP}
              value={defeitoOemp}
              onChange={setDefeitoOemp}
            />
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraOempOi}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mam">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Abertura MAM/SCT</CardTitle>
            <CopyBtn text={mascaraMamSct} id="mam" tableRows={rowsMam} emailSubject={`Mascara MAM SCT - ${codUl || nomeUl || "UL"}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            <DefeitoSelectField
              label="Problema"
              options={DEFEITOS_OEMP}
              value={defeitoOemp}
              onChange={setDefeitoOemp}
            />
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraMamSct}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="wt">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara WT Telecom</CardTitle>
            <CopyBtn text={mascaraWtTelecom} id="wt" tableRows={rowsWt} emailSubject={`Mascara WT Telecom - ${codUl || nomeUl || "UL"}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            <DefeitoSelectField
              label="Defeito Reclamado"
              options={DEFEITOS_OEMP}
              value={defeitoOemp}
              onChange={setDefeitoOemp}
            />
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraWtTelecom}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ativa">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara ATIVA</CardTitle>
            <CopyBtn text={mascaraAtiva} id="ativa" tableRows={rowsAtiva} emailSubject={`Mascara ATIVA - ${codUl || nomeUl || "UL"}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            <DefeitoSelectField
              label="Defeito Reclamado"
              options={DEFEITOS_ATIVA}
              value={defeitoAtiva}
              onChange={setDefeitoAtiva}
            />
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraAtiva}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="enc">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara de Encerramento</CardTitle>
            <CopyBtn text={mascaraEncerramento} id="enc" tableRows={rowsEnc} emailSubject={`Mascara de Encerramento - ${codUl || nomeUl || "UL"}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DefeitoSelectField
                label="Defeito Reclamado OEMP/MAM/WT"
                options={DEFEITOS_OEMP}
                value={defeitoOemp}
                onChange={setDefeitoOemp}
              />
              <DefeitoSelectField
                label="Defeito Reclamado ATIVA"
                options={DEFEITOS_ATIVA}
                value={defeitoAtiva}
                onChange={setDefeitoAtiva}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Falha</Label>
                <Select value={falhaEnc} onValueChange={setFalhaEnc}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {allFalhas.map((falha) => (
                      <SelectItem key={falha} value={falha}>{falha}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 mt-1">
                  <Input
                    value={newFalha}
                    onChange={(e) => setNewFalha(e.target.value)}
                    placeholder="Nova falha..."
                    className="text-xs h-7"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFalha())}
                  />
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={addFalha} disabled={!newFalha.trim()}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {/* Auto/Manual toggle */}
              <div className="md:col-span-2 flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Switch checked={normAutoMode} onCheckedChange={setNormAutoMode} id="norm-mode" />
                <Label htmlFor="norm-mode" className="text-xs cursor-pointer">
                  {normAutoMode ? "Automático — calcular normalização por (agora - tempo BGP)" : "Manual — digitar todos os horários"}
                </Label>
              </div>

              <div>
                <Label className="text-xs">Horário da falha</Label>
                <Input
                  value={horaFalhaEnc}
                  onChange={(e) => setHoraFalhaEnc(e.target.value)}
                  placeholder="Ex: 26/11/2024 14:45:57"
                />
              </div>

              <div>
                <Label className="text-xs">Horário de normalização</Label>
                <Input
                  value={horaNormalizacaoEncPreview}
                  onChange={(e) => setHoraNormalizacaoEnc(e.target.value)}
                  placeholder="Ex: 26/11/2024 17:12:00"
                  disabled={normAutoMode}
                  className={normAutoMode ? "bg-muted" : ""}
                />
                {normAutoMode && horaNormalizacaoEncCalculada && (
                  <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente pelo tempo BGP</p>
                )}
              </div>

              {normAutoMode ? (
                <div>
                  <Label className="text-xs">Tempo BGP (HH:MM:SS)</Label>
                  <Input
                    value={tempoBgp}
                    onChange={(e) => setTempoBgp(e.target.value)}
                    placeholder="Ex: 00:00:00"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Subtrai da data/hora atual. Ex: 48:00:00 = 2 dias antes
                  </p>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <Label className="text-xs">Causa/Solução</Label>
                <Select value={causaEnc} onValueChange={setCausaEnc}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {allCausas.map((causa) => (
                      <SelectItem key={causa} value={causa} className="text-xs">{causa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 mt-1">
                  <Input
                    value={newCausa}
                    onChange={(e) => setNewCausa(e.target.value)}
                    placeholder="Nova causa/solução..."
                    className="text-xs h-7"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCausa())}
                  />
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={addCausa} disabled={!newCausa.trim()}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Contato de Autorização</Label>
                <Input value={contatoEnc} onChange={(e) => setContatoEnc(e.target.value)} />
              </div>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraEncerramento}</pre>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
    </>
  );
};

export default MascaraTab;
